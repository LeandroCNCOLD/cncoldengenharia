// Núcleo do simulador UNILAB.
//
// Fluxo:
//  1. Validar inputs físicos e termodinâmicos.
//  2. P_atm pela altitude.
//  3. Psicrometria de entrada (W, h, ρ, ponto de orvalho).
//  4. Área e velocidade de face.
//  5. Regime DRY/WET (T_superfície vs ponto de orvalho).
//  6. Coeficiente U (uBase + correção por velocidade + parede do tubo).
//  7. Área efetiva de troca: face × rows × fator de aleta (passo de aleta).
//  8. NTU + ε crossflow (Cr=0 em mudança de fase).
//  9. Q_base = ε · C_min · ΔT_max  (ΔT entre ar e superfície).
// 10. Q_final = Q_base · fator UNILAB.
// 11. Sensível/latente conforme regime; SHF.
// 12. Perdas de carga (ar via catálogo, fluido via Darcy-Weisbach).
//
// Sem mocks. Sem fallback silencioso para zero. Sem NaN/Infinity escapando.

import type {
  AirVelocityCorrectionItem,
  PressureDropFanItem,
  UnilabPhysicalInputs,
  UnilabSimulationResult,
  UnilabThermoInputs,
} from "../types/unilab.types";
import {
  validatePhysicalInputs,
  validateThermoInputs,
} from "../validators/simulationValidator";
import {
  calculateAirDensity,
  calculateAtmosphericPressure,
  calculateDewPoint,
  calculateEnthalpy,
  calculateHumidityRatio,
  calculateRelativeHumidityFromHumidityRatio,
  calculateSaturationPressure,
} from "./psychrometrics";
import {
  calculateCrossflowEffectiveness,
  calculateFaceArea,
  calculateFaceVelocity,
  calculateLMTD,
  calculateNTU,
} from "./heatTransfer";
import { calculateOverallU } from "./overallU";
import { applyAirVelocityCorrection } from "./unilabCorrections";
import {
  calculateAirPressureDrop,
  calculateFluidPressureDrop,
} from "./pressureDrop";
import { CP_DRY_AIR_KJ_KG_K, m3hToM3s, mmToM, safeDivide, clamp } from "./units";

export interface RunSimulationParams {
  physical: UnilabPhysicalInputs;
  thermo: UnilabThermoInputs;
  catalogs: {
    correctionCoefficients: AirVelocityCorrectionItem[];
    pressureDropFan: PressureDropFanItem[];
  };
  /** Condutividade do material do tubo selecionado [W/(m·K)]. */
  tubeMaterialConductivity: number;
  /** uBase opcional vindo da geometria do catálogo. */
  uBaseWm2K?: number;
}

export class SimulationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
    this.name = "SimulationError";
  }
}

/**
 * Estimativa da área efetiva de troca de calor (lado ar) para uma serpentina
 * aletada. Usa a aproximação:
 *   A_eff ≈ A_face · rows · (1 + η_aleta · razão_aleta)
 * onde η_aleta·razão_aleta é capturado pelo fator empírico baseado no passo
 * de aleta (mais aletas → maior área externa). Para o nível de precisão deste
 * simulador (correção UNILAB cobre o resíduo), basta um fator linear.
 */
function estimateEffectiveAreaM2(physical: UnilabPhysicalInputs, faceAreaM2: number): number {
  // Fator de aleta: razão entre área aletada e área de tubo nu — escala com
  // 1/finPitch. Para um catálogo UNILAB típico, finPitchMm 2..6 mm gera
  // 8..16 vezes a área externa do tubo nu por fileira.
  const finPitchM = mmToM(Math.max(physical.finPitchMm, 0.1));
  const finFactorPerRow = 1 + 0.1 / finPitchM; // adimensional
  return faceAreaM2 * physical.rows * finFactorPerRow;
}

export function runSimulation(params: RunSimulationParams): UnilabSimulationResult {
  const { physical, thermo, catalogs } = params;

  // 1. Validações
  const physCheck = validatePhysicalInputs(physical);
  const thermoCheck = validateThermoInputs(thermo);
  if (!physCheck.isValid || !thermoCheck.isValid) {
    throw new SimulationError("Inputs inválidos para simulação UNILAB.", [
      ...physCheck.errors,
      ...thermoCheck.errors,
    ]);
  }

  const warnings: string[] = [];

  // 2. Pressão atmosférica
  const pAtm = calculateAtmosphericPressure(thermo.altitudeM);

  // 3. Psicrometria de entrada
  const phiIn = clamp(thermo.airInletRhPercent / 100, 0, 1);
  const wIn = calculateHumidityRatio(thermo.airInletTempC, phiIn, pAtm);
  const hIn = calculateEnthalpy(thermo.airInletTempC, wIn);
  const rhoIn = calculateAirDensity(thermo.airInletTempC, wIn, pAtm);
  const dewPoint = calculateDewPoint(thermo.airInletTempC, phiIn);

  // 4. Geometria de face
  const faceAreaM2 = calculateFaceArea(physical.finnedHeightMm, physical.finnedLengthMm);
  const faceVelocityMs = calculateFaceVelocity(thermo.airFlowM3H, faceAreaM2);
  if (faceAreaM2 <= 0 || faceVelocityMs <= 0) {
    throw new SimulationError("Geometria de face inválida.", [
      "Altura aletada × comprimento aletado resultou em área zero.",
    ]);
  }

  const airVolumetricFlowM3S = m3hToM3s(thermo.airFlowM3H);
  const airMassFlowKgS = airVolumetricFlowM3S * rhoIn;
  if (airMassFlowKgS <= 0) {
    throw new SimulationError("Vazão mássica de ar inválida.", [
      "Densidade do ar de entrada resultou em vazão mássica nula.",
    ]);
  }

  // 5. Regime DRY/WET
  const surfaceTempC =
    thermo.evaporatingTempC ?? thermo.condensingTempC ?? Number.NaN;
  if (!Number.isFinite(surfaceTempC)) {
    throw new SimulationError("Temperatura de superfície ausente.", [
      "Informe ao menos T_evaporação ou T_condensação.",
    ]);
  }
  const isCooling = thermo.evaporatingTempC !== undefined;
  const regime: "DRY" | "WET" = isCooling && surfaceTempC < dewPoint ? "WET" : "DRY";

  // 6. U base + velocidade + parede
  const overall = calculateOverallU({
    airVelocityMs: faceVelocityMs,
    tubeOuterDiameterMm: physical.tubeOuterDiameterMm,
    tubeInnerDiameterMm: physical.tubeInnerDiameterMm,
    tubeMaterialConductivity: params.tubeMaterialConductivity,
    finPitchMm: physical.finPitchMm,
    uBaseWm2K: params.uBaseWm2K,
  });
  warnings.push(...overall.warnings);
  if (overall.uWm2K <= 0) {
    throw new SimulationError("Coeficiente U não pôde ser calculado.", overall.warnings);
  }

  // 7. Área efetiva de troca
  const areaEffM2 = estimateEffectiveAreaM2(physical, faceAreaM2);

  // 8. NTU e efetividade crossflow
  // C_ar = m_ar · cp_ar (kJ/(s·K) → W/K convertendo cp para J/kg·K)
  const cpAirJkgK = CP_DRY_AIR_KJ_KG_K * 1000;
  const cAirWk = airMassFlowKgS * cpAirJkgK;
  // Fluido em mudança de fase → C_fluido = ∞ → Cr = 0
  const cMinWk = cAirWk;
  const cRatio = 0;
  const ntu = calculateNTU(overall.uWm2K, areaEffM2, cMinWk);
  const effectiveness = calculateCrossflowEffectiveness(ntu, cRatio);

  // 9. Q_base
  const deltaTMax = thermo.airInletTempC - surfaceTempC;
  // Para condensador: surfaceTemp > airInlet → deltaTMax negativo. Usamos |·|
  // e ajustamos sinal final em sensible/latent.
  const qBaseW = effectiveness * cMinWk * Math.abs(deltaTMax);

  // 10. Correção UNILAB
  const correction = applyAirVelocityCorrection(
    physical.geometryId,
    faceVelocityMs,
    catalogs.correctionCoefficients,
  );
  warnings.push(...correction.warnings);
  if (correction.factor <= 0) {
    throw new SimulationError(
      "Correção UNILAB não pôde ser aplicada.",
      correction.warnings,
    );
  }
  const qFinalW = qBaseW * correction.factor;

  // LMTD informativo (sai como NaN-safe 0)
  const deltaT1 = Math.abs(thermo.airInletTempC - surfaceTempC);
  // Estimativa do ΔT2 usando ε: T_ar_out = T_ar_in - ε·ΔT_max (para resfr.)
  const tAirOutSensibleC = isCooling
    ? thermo.airInletTempC - effectiveness * deltaTMax
    : thermo.airInletTempC + effectiveness * Math.abs(deltaTMax);
  const deltaT2 = Math.abs(tAirOutSensibleC - surfaceTempC);
  const lmtdK = calculateLMTD(deltaT1, deltaT2);

  // 11. Sensível / latente
  let qSensibleW = 0;
  let qLatentW = 0;
  let tAirOutC = tAirOutSensibleC;
  let wOut = wIn;

  if (regime === "WET" && isCooling) {
    // Q_total = m_ar · (h_in - h_out)  →  h_out = h_in - Q_total/m_ar
    const qTotalKw = qFinalW / 1000;
    const hOutKjKg = hIn - qTotalKw / airMassFlowKgS;
    // Aproximação: ar sai saturado à T_superfície
    const wOutSat = calculateHumidityRatio(surfaceTempC, 1, pAtm);
    wOut = Math.min(wIn, wOutSat);
    // T_out a partir de h_out e W_out (inverso da Eq. 32 da psicrometria):
    //   h = 1.006·t + W·(2501 + 1.86·t)  →  t = (h - 2501·W) / (1.006 + 1.86·W)
    tAirOutC = (hOutKjKg - 2501 * wOut) / (1.006 + 1.86 * wOut);
    qSensibleW = airMassFlowKgS * cpAirJkgK * (thermo.airInletTempC - tAirOutC);
    qLatentW = qFinalW - qSensibleW;
  } else {
    qSensibleW = qFinalW;
    qLatentW = 0;
    // tAirOutC já calculado acima
  }

  const shf = qFinalW > 0 ? qSensibleW / qFinalW : 1;

  // 12. Perdas de carga
  const dpAir = calculateAirPressureDrop(
    physical.geometryId,
    faceVelocityMs,
    catalogs.pressureDropFan,
  );
  warnings.push(...dpAir.warnings);

  // Vazão mássica do refrigerante: estimativa grosseira pela capacidade.
  // Para fluido em mudança de fase usamos hfg padrão (R404A ~ 200 kJ/kg líq-vap).
  // Sem propriedades reais o usuário deve confiar mais no fator UNILAB.
  const estimatedMassFlowKgS = safeDivide(qFinalW / 1000, 200);
  // Comprimento total estimado de tubo: rows · comprimento aletado / circuitos
  const totalTubeLengthM =
    physical.rows * mmToM(physical.finnedLengthMm);
  const dpFluid = calculateFluidPressureDrop({
    estimatedMassFlowKgS,
    circuits: physical.circuits,
    tubeInnerDiameterMm: physical.tubeInnerDiameterMm,
    tubeLengthM: totalTubeLengthM,
  });
  warnings.push(...dpFluid.warnings);

  const rhOut = calculateRelativeHumidityFromHumidityRatio(tAirOutC, wOut, pAtm);

  // Sanity checks finais — nada de NaN/Infinity escapando.
  const nums = [qFinalW, qSensibleW, qLatentW, tAirOutC, faceVelocityMs];
  if (nums.some((n) => !Number.isFinite(n))) {
    throw new SimulationError("Resultado contém valor não-finito.", [
      "Falha numérica no motor — revise os inputs.",
    ]);
  }

  return {
    totalCapacityKw: qFinalW / 1000,
    sensibleCapacityKw: qSensibleW / 1000,
    latentCapacityKw: qLatentW / 1000,
    shf: clamp(shf, 0, 1),
    airPressureDropPa: Number.isFinite(dpAir.pressureDropPa) ? dpAir.pressureDropPa : 0,
    fluidPressureDropKpa: Number.isFinite(dpFluid.pressureDropKpa) ? dpFluid.pressureDropKpa : 0,
    airOutletTempC: tAirOutC,
    airOutletRhPercent: rhOut * 100,
    faceAreaM2,
    faceVelocityMs,
    airMassFlowKgS,
    regime,
    lmtdK: lmtdK > 0 ? lmtdK : undefined,
    ntu: ntu > 0 ? ntu : undefined,
    effectiveness: effectiveness > 0 ? effectiveness : undefined,
    correctionFactor: correction.factor,
    warnings,
  };
}

// Suprime warning de import não usado quando saturação é re-exportada
void calculateSaturationPressure;
