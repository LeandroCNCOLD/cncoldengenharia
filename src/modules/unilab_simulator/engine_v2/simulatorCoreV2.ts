import { SimulationError, type RunSimulationParams } from "../engine/simulatorCore";
import { evaluateCoilCorrection } from "@/modules/unilab_simulator/services/unilabCoefficientsService";
import type { UnilabSimulationResult } from "../types/unilab.types";
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
} from "../engine/psychrometrics";
import {
  calculateCrossflowEffectiveness,
  calculateFaceArea,
  calculateFaceVelocity,
  calculateLMTD,
  calculateNTU,
} from "../engine/heatTransfer";
import { calculateOverallU } from "../engine/overallU";
import {
  calculateAirPressureDrop,
  calculateFluidPressureDrop,
} from "../engine/pressureDrop";
import { CP_DRY_AIR_KJ_KG_K, clamp, m3hToM3s, mmToM, safeDivide } from "../engine/units";

const NO_COEFFICIENT_WARNING =
  "Nenhum coeficiente UNILAB encontrado para esta tipologia. Usando fator 1.";
const CLAMPED_WARNING = "Coeficiente UNILAB aplicado com velocidade limitada à faixa válida.";

export interface RunSimulationV2Params extends RunSimulationParams {
  unilabCorrectionInput?: {
    idTipologia?: number;
    serie?: string;
  };
}

function estimateEffectiveAreaM2(physical: RunSimulationV2Params["physical"], faceAreaM2: number): number {
  const finPitchM = mmToM(Math.max(physical.finPitchMm, 0.1));
  const finFactorPerRow = 1 + 0.1 / finPitchM;
  return faceAreaM2 * physical.rows * finFactorPerRow;
}

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

export async function runSimulationV2Async(
  params: RunSimulationV2Params,
): Promise<UnilabSimulationResult> {
  const { physical, thermo, catalogs } = params;

  const physCheck = validatePhysicalInputs(physical);
  const thermoCheck = validateThermoInputs(thermo);
  if (!physCheck.isValid || !thermoCheck.isValid) {
    throw new SimulationError("Inputs inválidos para simulação UNILAB.", [
      ...physCheck.errors,
      ...thermoCheck.errors,
    ]);
  }

  const warnings: string[] = [];
  const pAtm = calculateAtmosphericPressure(thermo.altitudeM);
  const phiIn = clamp(thermo.airInletRhPercent / 100, 0, 1);
  const wIn = calculateHumidityRatio(thermo.airInletTempC, phiIn, pAtm);
  const hIn = calculateEnthalpy(thermo.airInletTempC, wIn);
  const rhoIn = calculateAirDensity(thermo.airInletTempC, wIn, pAtm);
  const dewPoint = calculateDewPoint(thermo.airInletTempC, phiIn);

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

  const surfaceTempC = thermo.evaporatingTempC ?? thermo.condensingTempC ?? Number.NaN;
  if (!Number.isFinite(surfaceTempC)) {
    throw new SimulationError("Temperatura de superfície ausente.", [
      "Informe ao menos T_evaporação ou T_condensação.",
    ]);
  }
  const isCooling = thermo.evaporatingTempC !== undefined;
  const regime: "DRY" | "WET" = isCooling && surfaceTempC < dewPoint ? "WET" : "DRY";

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

  const idTipologia = params.unilabCorrectionInput?.idTipologia;
  let correctionFactor = 1;
  let unilabCorrection: NonNullable<UnilabSimulationResult["unilabCorrection"]>;
  if (idTipologia === undefined) {
    warnings.push(NO_COEFFICIENT_WARNING);
    unilabCorrection = {
      factor: 1,
      clampedVelocity_m_s: faceVelocityMs,
    };
  } else {
    const correction = await evaluateCoilCorrection({
      idTipologia,
      airVelocity_m_s: faceVelocityMs,
      serie: params.unilabCorrectionInput?.serie,
    });
    correctionFactor = correction.factor;
    if (!correction.coefficient) {
      warnings.push(NO_COEFFICIENT_WARNING);
    } else if (correction.warning) {
      warnings.push(correction.warning, CLAMPED_WARNING);
    }
    unilabCorrection = {
      factor: correctionFactor,
      idCorr: correction.coefficient?.idCorr,
      serie: correction.coefficient?.serie,
      velocityRange_m_s: correction.coefficient?.velocityRange_m_s,
      clampedVelocity_m_s: correction.clampedVelocity_m_s,
    };
  }

  const correctedU = overall.uWm2K * correctionFactor;
  const areaEffM2 = estimateEffectiveAreaM2(physical, faceAreaM2);
  const cpAirJkgK = CP_DRY_AIR_KJ_KG_K * 1000;
  const cAirWk = airMassFlowKgS * cpAirJkgK;
  const cMinWk = cAirWk;
  const cRatio = 0;
  const ntu = calculateNTU(correctedU, areaEffM2, cMinWk);
  const effectiveness = calculateCrossflowEffectiveness(ntu, cRatio);

  const deltaTMax = thermo.airInletTempC - surfaceTempC;
  const qFinalW = effectiveness * cMinWk * Math.abs(deltaTMax);

  const deltaT1 = Math.abs(thermo.airInletTempC - surfaceTempC);
  const tAirOutSensibleC = isCooling
    ? thermo.airInletTempC - effectiveness * deltaTMax
    : thermo.airInletTempC + effectiveness * Math.abs(deltaTMax);
  const deltaT2 = Math.abs(tAirOutSensibleC - surfaceTempC);
  const lmtdK = calculateLMTD(deltaT1, deltaT2);

  let qSensibleW = 0;
  let qLatentW = 0;
  let tAirOutC = tAirOutSensibleC;
  let wOut = wIn;

  if (regime === "WET" && isCooling) {
    const qTotalKw = qFinalW / 1000;
    const hOutKjKg = hIn - qTotalKw / airMassFlowKgS;
    const wOutSat = calculateHumidityRatio(surfaceTempC, 1, pAtm);
    wOut = Math.min(wIn, wOutSat);
    tAirOutC = (hOutKjKg - 2501 * wOut) / (1.006 + 1.86 * wOut);
    qSensibleW = airMassFlowKgS * cpAirJkgK * (thermo.airInletTempC - tAirOutC);
    qLatentW = qFinalW - qSensibleW;
  } else {
    qSensibleW = qFinalW;
    qLatentW = 0;
  }

  const shf = qFinalW > 0 ? qSensibleW / qFinalW : 1;
  const dpAir = calculateAirPressureDrop(
    physical.geometryId,
    faceVelocityMs,
    catalogs.pressureDropFan,
  );
  warnings.push(...dpAir.warnings);

  const estimatedMassFlowKgS = safeDivide(qFinalW / 1000, 200);
  const totalTubeLengthM = physical.rows * mmToM(physical.finnedLengthMm);
  const dpFluid = calculateFluidPressureDrop({
    estimatedMassFlowKgS,
    circuits: physical.circuits,
    tubeInnerDiameterMm: physical.tubeInnerDiameterMm,
    tubeLengthM: totalTubeLengthM,
  });
  warnings.push(...dpFluid.warnings);

  const rhOut = calculateRelativeHumidityFromHumidityRatio(tAirOutC, wOut, pAtm);
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
    correctionFactor,
    unilabCorrection,
    warnings: dedupeWarnings(warnings),
  };
}
