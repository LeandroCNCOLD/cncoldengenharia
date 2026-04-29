/**
 * Simulador Condensador — modo Verify.
 *   Q = Qnom * (DTreal/DTnom)^1.15 * airflowFactor * foulingFactor * altitudeFactor
 */
import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
  NominalReference,
} from "./coilSimulatorTypes";
import type { CalibrationFactors } from "./coilEngineTypes";
import { normalizeCalibrationFactors } from "./coilEngineTypes";

export interface DxSimulatorOptions {
  calibration?: CalibrationFactors;
}

const W_TO_KCALH = 0.859845;

function estimateNominalCond(input: CoilSimulatorInput): NominalReference {
  const tubes = (input.geometry.tubesPerRow ?? 16) * (input.geometry.rows ?? 3);
  return {
    capacityW: Math.max(tubes * 350, 2000),
    airTempInC: input.air.airTempInC ?? 35,
    refTempC: input.refrigerant.refTempC ?? 50,
    airflowM3h: input.air.airflowM3h ?? 4000,
  };
}

function estimateFaceArea(input: CoilSimulatorInput): number | null {
  const { coilLengthMm, tubesPerRow, tubeSpacingMm } = input.geometry;
  if (!coilLengthMm || !tubesPerRow || !tubeSpacingMm) return null;
  return ((tubesPerRow * tubeSpacingMm) / 1000) * (coilLengthMm / 1000);
}

export function simulateDxCondenser(
  input: CoilSimulatorInput,
  options: DxSimulatorOptions = {},
): CoilSimulatorResult {
  const cal = normalizeCalibrationFactors(options.calibration);
  const warnings: string[] = [];
  const air = input.air;
  const ref = input.refrigerant;

  // Validações
  if (air.airTempInC == null || ref.refTempC == null)
    warnings.push("Informe T ar entrada e T condensação.");
  if ((ref.refTempC ?? 0) <= (air.airTempInC ?? 0))
    warnings.push("ERRO: T condensação deve ser maior que T ar entrada.");
  if (!air.airflowM3h || air.airflowM3h <= 0) warnings.push("Vazão de ar deve ser > 0.");
  if (!input.geometry.circuits || input.geometry.circuits <= 0)
    warnings.push("Circuitos devem ser > 0.");

  const nominal = input.nominal ?? estimateNominalCond(input);
  const estimated = !input.nominal;
  if (estimated) warnings.push("Capacidade nominal estimada (sem datasheet).");

  const dtNom = nominal.refTempC - nominal.airTempInC;
  const dtReal = (ref.refTempC ?? 0) - (air.airTempInC ?? 0);

  if (dtNom <= 0) warnings.push("DT nominal inválido (≤ 0).");
  else if (dtReal < 8) warnings.push(`DT baixo (${dtReal.toFixed(1)} K) — recomendado 8–20 K.`);
  else if (dtReal > 20) warnings.push(`DT alto (${dtReal.toFixed(1)} K) — recomendado 8–20 K.`);

  const airflow = air.airflowM3h ?? nominal.airflowM3h;
  const airflowFactor = nominal.airflowM3h > 0 ? airflow / nominal.airflowM3h : 1;
  const fouling = input.foulingFactor ?? 1.0;
  const altitude = input.altitudeFactor ?? 1.0;

  const dtFactor = dtNom > 0 ? Math.max(dtReal / dtNom, 0) ** 1.15 : 0;
  const correction = dtFactor * airflowFactor * fouling * altitude;
  const capacityW = Math.max(nominal.capacityW * correction, 0);

  const faceArea = estimateFaceArea(input);
  const faceVelocity =
    air.faceVelocityMs ??
    (faceArea && airflow ? airflow / 3600 / faceArea : null);

  if (faceVelocity != null) {
    if (faceVelocity < 2) warnings.push(`Velocidade frontal baixa (${faceVelocity.toFixed(2)} m/s).`);
    if (faceVelocity > 4) warnings.push(`Velocidade frontal alta (${faceVelocity.toFixed(2)} m/s).`);
  }

  const airDp =
    faceVelocity != null && input.geometry.rows
      ? 6 * input.geometry.rows * faceVelocity ** 1.7
      : null;

  // Aplicação da calibração (pós-processamento empírico)
  const capCal = capacityW * cal.capacityCorrectionFactor;
  const airDpCal = airDp != null ? airDp * cal.airPressureDropFactor : null;
  const refDpCal =
    ref.refrigerantPressureDropKpa != null
      ? ref.refrigerantPressureDropKpa * cal.refrigerantPressureDropFactor
      : null;

  return {
    coilType: "condenser",
    capacityW: capCal,
    capacityKcalh: capCal * W_TO_KCALH,
    sensibleW: capCal,
    latentW: 0,
    dtRealK: dtReal,
    dtNominalK: dtNom,
    faceAreaM2: faceArea,
    faceVelocityMs: faceVelocity,
    airflowFactor,
    dtFactor,
    airPressureDropPa: airDpCal,
    refPressureDropKpa: refDpCal,
    condensateLh: null,
    warnings,
    rejection: { used: nominal, estimated },
  };
}
