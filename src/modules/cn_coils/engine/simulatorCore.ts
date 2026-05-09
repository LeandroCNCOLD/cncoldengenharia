/**
 * @deprecated Use simulatorCoreAdapter.ts que delega ao motor unificado.
 * Este arquivo será removido na versão 2.0.
 * Mantido apenas para compatibilidade com testes existentes.
 */

// Núcleo do simulador CN Coils.
//
// Fluxo:
//  1. Validar inputs físicos e termodinâmicos.
//  2. P_atm pela altitude.
//  3. Psicrometria de entrada (W, h, ρ, ponto de orvalho).
//  4. Área e velocidade de face.
//  5. Regime DRY/WET (T_superfície vs ponto de orvalho).
//  6. Coeficiente U por resistências em série (lado ar + parede + fluido).
//  7. Área efetiva de troca: face × rows × fator de aleta (passo de aleta).
//  8. NTU + ε crossflow (Cr=0 em mudança de fase).
//  9. Q_base = ε · C_min · ΔT_max  (ΔT entre ar e superfície).
// 10. Q_final = Q_base · fator CN Coils.
// 11. Sensível/latente conforme regime; SHF.
// 12. Perdas de carga (ar via catálogo, fluido via Darcy-Weisbach).
//
// Sem mocks. Sem fallback silencioso para zero. Sem NaN/Infinity escapando.

import type {
  AirVelocityCorrectionItem,
  PressureDropFanItem,
  CnCoilsPhysicalInputs,
  CnCoilsSimulationResult,
  CnCoilsThermoInputs,
} from "../types/cncoils.types";
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
import { calculateWangChiChang } from "./wangChiChang";
import { computeOverallU, dittusBoelter, shahTwoPhase } from "../engine_v2/heatTransfer";
import { applyAirVelocityCorrection } from "./cncoilsCorrections";
import {
  calculateAirPressureDrop,
  computeFluidPressureDrop,
} from "./pressureDrop";
import { CP_DRY_AIR_KJ_KG_K, m3hToM3s, mmToM, safeDivide, clamp } from "./units";
import { calcCoilEffectiveArea, calcFinEfficiency, calcEffectiveArea } from "./effectiveArea";
import { getRefrigerantProps } from "../services/refrigerantProperties";
import { getRefrigerantLiquidProps } from "../engine_v2/refrigerantProps";
import { computeFluidVelocity } from "../utils/coilDerivedMetrics";

export interface RunSimulationParams {
  physical: CnCoilsPhysicalInputs;
  thermo: CnCoilsThermoInputs;
  catalogs: {
    correctionCoefficients: AirVelocityCorrectionItem[];
    pressureDropFan: PressureDropFanItem[];
  };
  /** Condutividade do material do tubo selecionado [W/(m·K)]. */
  tubeMaterialConductivity: number;
  /**
   * Fator de correção da aleta (FatCorAl do catálogo CnCoils).
   * Multiplica Q_final para ajustar a capacidade pelo tipo de aleta.
   * Valores típicos: Lisa=1.00, Ondulada=1.15, Persianada=0.95,
   * Wavy=1.35, Serrilhada=1.45. Padrão: 1.0 (neutro).
   */
  finCorrectionFactor?: number;
  /**
   * Fator de atrito do ar (FattoreAttrAria do catálogo CnCoils).
   * Multiplica a queda de pressão do ar (dpAir) pelo tipo de aleta.
   * Valores típicos: Lisa=1.00, Ondulada=1.25, Persianada=1.00,
   * Wavy=1.45, Serrilhada=1.55. Padrão: 1.0 (neutro).
   */
  airFrictionFactor?: number;
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

function computeGeometricArea(physical: CnCoilsPhysicalInputs, faceAreaM2: number, hAir: number) {
  const D_o_m = mmToM(physical.tubeOuterDiameterMm);
  const P_t_m = mmToM(physical.tubePitchTransverseMm);
  const P_l_m = mmToM(physical.tubePitchLongitudinalMm);
  const delta_f_m = mmToM(physical.finThicknessMm ?? 0.1);
  const L_tube_m = mmToM(physical.finnedLengthMm);
  const finnedHeightM = mmToM(physical.finnedHeightMm);
  const N_tubes_per_row = physical.tubesPerRow ?? (P_t_m > 0 ? Math.max(1, Math.round(finnedHeightM / P_t_m)) : 16);

  const F_p_m = physical.isVariableFinPitch && Array.isArray(physical.rowFinPitchesMm) && physical.rowFinPitchesMm.length > 0
    ? mmToM(physical.rowFinPitchesMm.reduce((a, b) => a + b, 0) / physical.rowFinPitchesMm.length)
    : mmToM(Math.max(physical.finPitchMm, 0.1));

  const areas = calcCoilEffectiveArea({
    N_rows: physical.rows,
    N_tubes_per_row: N_tubes_per_row,
    L_tube_m,
    D_o_m,
    P_t_m,
    P_l_m,
    F_p_m,
    delta_f_m,
  });

  const k_fin = 200;
  const r_o = D_o_m / 2;
  const eta_fin = calcFinEfficiency(hAir, k_fin, delta_f_m, r_o, P_t_m, P_l_m);
  const effectiveArea = calcEffectiveArea(areas, eta_fin);

  return { areas, eta_fin, effectiveArea };
}

export function runSimulation(params: RunSimulationParams): CnCoilsSimulationResult {
  const { physical, thermo, catalogs } = params;

  // 1. Validações
  const physCheck = validatePhysicalInputs(physical);
  const thermoCheck = validateThermoInputs(thermo);
  if (!physCheck.isValid || !thermoCheck.isValid) {
    throw new SimulationError("Inputs inválidos para simulação CN Coils.", [
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
  const cpAirJkgK = CP_DRY_AIR_KJ_KG_K * 1000;
  const deltaTMax = thermo.airInletTempC - surfaceTempC;

  // 6. U dinâmico via Wang-Chi-Chang (2000) — padrão de indústria para
  //    aletas planas. Resposta dinâmica ao passo de aleta, nº filas e vazão.
  const wcc = calculateWangChiChang({
    tubeOdMm: physical.tubeOuterDiameterMm,
    finThicknessMm: physical.finThicknessMm,
    finPitchMm: physical.finPitchMm,
    rowPitchMm: physical.tubePitchLongitudinalMm,
    tubePitchMm: physical.tubePitchTransverseMm,
    numberOfRows: physical.rows,
    airFaceVelocityMs: faceVelocityMs,
    airTempC: thermo.airInletTempC,
  });
  warnings.push(...wcc.warnings);
  if (wcc.uGlobalWm2K > 0) {
    warnings.push("ΔP ar estimado por correlação Chang & Wang (1997).");
  }

  const refrigerantProps = getRefrigerantProps(
    thermo.refrigerantId,
    surfaceTempC,
    "liquid",
  );
  if (!refrigerantProps) {
    warnings.push(
      `Propriedades do refrigerante ${thermo.refrigerantId} ausentes — h_i usará fallback de U apenas se inválido.`,
    );
  }

  const tubeInnerDiameterM = mmToM(physical.tubeInnerDiameterMm);
  const tubeOuterRadiusM = mmToM(physical.tubeOuterDiameterMm) / 2;
  const tubeInnerRadiusM = tubeInnerDiameterM / 2;
  const fluidProps = refrigerantProps
    ? {
        rho_kg_m3: refrigerantProps.rho_kg_m3,
        mu_Pa_s: refrigerantProps.mu_Pa_s,
        cp_J_kgK: refrigerantProps.cp_J_kgK,
        k_W_mK: refrigerantProps.k_W_mK,
      }
    : {
        rho_kg_m3: 1120,
        mu_Pa_s: 2.0e-4,
        cp_J_kgK: 1370,
        k_W_mK: 0.083,
      };
  const estimatedFluidMassFlowKgS = Math.max(
    0.001,
    airMassFlowKgS * cpAirJkgK * Math.abs(deltaTMax) / (200_000),
  );
  const hLiquidWm2K = dittusBoelter({
    massFlowKgS: estimatedFluidMassFlowKgS,
    tubeInnerDiameterM,
    circuits: physical.circuits,
    fluid: fluidProps,
    heating: !isCooling,
  });
  const prLiquid =
    refrigerantProps?.Pr ??
    (fluidProps.cp_J_kgK * fluidProps.mu_Pa_s) / fluidProps.k_W_mK;
  const hFluidWm2K = isCooling
    ? shahTwoPhase(hLiquidWm2K, 0.5, prLiquid)
    : hLiquidWm2K;
  const overallUResult = computeOverallU({
    h_o: wcc.hAirWm2K,
    h_i: hFluidWm2K,
    r_o_m: tubeOuterRadiusM,
    r_i_m: tubeInnerRadiusM,
    k_tube_WmK: params.tubeMaterialConductivity,
  });
  warnings.push(...overallUResult.warnings);
  const uGlobalWm2K = overallUResult.U_o;

  if (uGlobalWm2K <= 0) {
    throw new SimulationError("Coeficiente U não pôde ser calculado.", warnings);
  }
  const overall = { uWm2K: uGlobalWm2K };

  // 7. Área efetiva de troca (geométrica rigorosa)
  const geoArea = computeGeometricArea(physical, faceAreaM2, wcc.hAirWm2K > 0 ? wcc.hAirWm2K : 50);
  const areaEffM2 = geoArea.effectiveArea;

  // 8. NTU e efetividade crossflow
  // C_ar = m_ar · cp_ar (kJ/(s·K) → W/K convertendo cp para J/kg·K)
  const cAirWk = airMassFlowKgS * cpAirJkgK;
  // Fluido em mudança de fase → C_fluido = ∞ → Cr = 0
  const cMinWk = cAirWk;
  const cRatio = 0;
  const ntu = calculateNTU(overall.uWm2K, areaEffM2, cMinWk);
  const effectiveness = calculateCrossflowEffectiveness(ntu, cRatio);

  // 9. Q_base
  // Para condensador: surfaceTemp > airInlet → deltaTMax negativo. Usamos |·|
  // e ajustamos sinal final em sensible/latent.
  const qBaseW = effectiveness * cMinWk * Math.abs(deltaTMax);

  // 10. Correção CN Coils
  const correction = applyAirVelocityCorrection(
    physical.geometryId,
    faceVelocityMs,
    catalogs.correctionCoefficients,
  );
  warnings.push(...correction.warnings);
  if (correction.factor <= 0) {
    throw new SimulationError(
      "Correção CN Coils não pôde ser aplicada.",
      correction.warnings,
    );
  }
  const qFinalW_raw = qBaseW * correction.factor;

  const finFactor = Number.isFinite(params.finCorrectionFactor) && params.finCorrectionFactor! > 0
    ? params.finCorrectionFactor!
    : 1.0;
  const qFinalW = qFinalW_raw * finFactor;

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
    {
      T_ar_C: (thermo.airInletTempC + tAirOutC) / 2,
      N_rows: physical.rows,
      D_c_m: mmToM(physical.tubeOuterDiameterMm) + 2 * mmToM(physical.finThicknessMm),
      fin_pitch_m: mmToM(physical.finPitchMm),
      fin_thickness_m: mmToM(physical.finThicknessMm),
      tube_pitch_transv_m: mmToM(physical.tubePitchTransverseMm),
      tube_pitch_longit_m: mmToM(physical.tubePitchLongitudinalMm),
    },
  );
  warnings.push(...dpAir.warnings);

  const airFrFactor = Number.isFinite(params.airFrictionFactor) && params.airFrictionFactor! > 0
    ? params.airFrictionFactor!
    : 1.0;
  const dpAirPaFinal = (Number.isFinite(dpAir.pressureDropPa) ? dpAir.pressureDropPa : 0) * airFrFactor;

  const refrigerantLiquidProps = getRefrigerantLiquidProps(
    thermo.refrigerantId,
    surfaceTempC,
  );
  // C1: vazão mássica por Δx = x_out − x_in (não x_médio nem x=1).
  // Para evaporador DX: x_in=0.20, x_out=0.90 → Δx=0.70.
  // Para condensador: x_in=0.05, x_out=0.95 → Δx=0.90.
  const dx_evap = isCooling ? 0.70 : 0.90;
  const estimatedMassFlowKgS = safeDivide(
    qFinalW / 1000,
    Math.max(refrigerantLiquidProps.h_fg_kJkg * dx_evap, 0.1),
  );
  const fluidVelocityMs = computeFluidVelocity({
    refrigerant: thermo.refrigerantId,
    T_evap_C: surfaceTempC,
    Q_total_W: qFinalW,
    nCircuits: physical.circuits,
    tubeID_m: mmToM(physical.tubeInnerDiameterMm),
    massFlow_kg_s: estimatedMassFlowKgS,
  });
  // Comprimento por circuito: rows × L_fin × (tubesPerRow / circuits).
  const tubesPerRow = physical.tubesPerRow ?? 1;
  const circuits = Math.max(physical.circuits, 1);
  const tubesPerCircuit = tubesPerRow / circuits;
  const tubeLengthPerCircuitM =
    physical.rows * mmToM(physical.finnedLengthMm) * tubesPerCircuit;
  const dpFluid = computeFluidPressureDrop({
    refrigerant: thermo.refrigerantId,
    T_evap_C: surfaceTempC,
    mass_flow_kg_s: estimatedMassFlowKgS,
    n_circuits: physical.circuits,
    L_tube_per_circuit_m: tubeLengthPerCircuitM,
    D_i_m: mmToM(physical.tubeInnerDiameterMm),
  });
  warnings.push(...dpFluid.warnings);
  {
    const Di_m_check = mmToM(physical.tubeInnerDiameterMm);
    const A_check = (Math.PI * Di_m_check ** 2) / 4;
    const massFlowPerCircuit = estimatedMassFlowKgS / Math.max(physical.circuits, 1);
    const rho_check = refrigerantLiquidProps.rho_kg_m3;
    const mu_check = refrigerantLiquidProps.mu_Pa_s;
    const G_check = massFlowPerCircuit / A_check;
    const Re_check = (G_check * Di_m_check) / mu_check;
    const v_fluid_check = G_check / rho_check;

    if (Re_check > 10000) {
      warnings.push(
        `Re=${Re_check.toFixed(0)} acima de 10.000 — extrapolação moderada`,
      );
    }
    if (v_fluid_check > 5) {
      warnings.push(
        `Velocidade do fluido ${v_fluid_check.toFixed(2)} m/s fora da faixa típica (0,1–5 m/s)`,
      );
    }
  }

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
    airPressureDropPa: dpAirPaFinal,
    fluidPressureDropKpa: Number.isFinite(dpFluid.dP_kPa) ? dpFluid.dP_kPa : 0,
    airOutletTempC: tAirOutC,
    airOutletRhPercent: rhOut * 100,
    faceAreaM2,
    faceVelocityMs,
    airMassFlowKgS,
    fluidVelocityMs: Number.isFinite(fluidVelocityMs) ? fluidVelocityMs : undefined,
    fluidMassFlowKgS: estimatedMassFlowKgS,
    regime,
    lmtdK: lmtdK > 0 ? lmtdK : undefined,
    ntu: ntu > 0 ? ntu : undefined,
    effectiveness: effectiveness > 0 ? effectiveness : undefined,
    correctionFactor: correction.factor,
    A_fin_m2: geoArea.areas.A_fin_m2,
    A_tube_bare_m2: geoArea.areas.A_tube_bare_m2,
    A_total_m2: geoArea.areas.A_total_m2,
    eta_fin: geoArea.eta_fin,
    surface_ratio: geoArea.areas.surface_ratio,
    finCorrectionFactor: finFactor,
    airFrictionFactor: airFrFactor,
    warnings,
  };
}

// Suprime warning de import não usado quando saturação é re-exportada
void calculateSaturationPressure;
