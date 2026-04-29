/**
 * Simulador DX Evaporador — modo Verify.
 *   Q = Qnom * (DTreal/DTnom)^1.20 * airflowFactor * frostFactor * foulingFactor
 */
import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
  NominalReference,
} from "@/modules/thermalcalc/types/coilSimulatorTypes";
import type { CalibrationFactors } from "@/modules/thermalcalc/types/coilEngineTypes";
import { normalizeCalibrationFactors } from "@/modules/thermalcalc/types/coilEngineTypes";
import { runHybridDebug } from "./hybridDebugAdapter";

export interface DxSimulatorOptions {
  calibration?: CalibrationFactors;
}

const W_TO_KCALH = 0.859845;

function estimateNominalEvap(input: CoilSimulatorInput): NominalReference {
  // Estimativa muito grosseira para quando o usuário não informa Qnom:
  // 250 W por tubo * fileiras (placeholder didático).
  const tubes = (input.geometry.tubesPerRow ?? 12) * (input.geometry.rows ?? 4);
  const cap = Math.max(tubes * 250, 1500);
  return {
    capacityW: cap,
    airTempInC: input.air.airTempInC ?? 0,
    refTempC: (input.refrigerant.refTempC ?? -8),
    airflowM3h: input.air.airflowM3h ?? 2000,
  };
}

function estimateFaceArea(input: CoilSimulatorInput): number | null {
  const { coilLengthMm, tubesPerRow, tubeSpacingMm } = input.geometry;
  if (!coilLengthMm || !tubesPerRow || !tubeSpacingMm) return null;
  const heightM = (tubesPerRow * tubeSpacingMm) / 1000;
  const lengthM = coilLengthMm / 1000;
  return heightM * lengthM;
}

export function simulateDxEvaporator(
  input: CoilSimulatorInput,
  options: DxSimulatorOptions = {},
): CoilSimulatorResult {
  const cal = normalizeCalibrationFactors(options.calibration);
  const warnings: string[] = [];
  const air = input.air;
  const ref = input.refrigerant;

  // Validações
  if (air.airTempInC == null || ref.refTempC == null)
    warnings.push("Informe T ar entrada e T evaporação.");
  if ((air.airTempInC ?? 0) <= (ref.refTempC ?? 0))
    warnings.push("ERRO: T ar entrada deve ser maior que T evaporação.");
  if (!air.airflowM3h || air.airflowM3h <= 0) warnings.push("Vazão de ar deve ser > 0.");
  if (!input.geometry.circuits || input.geometry.circuits <= 0)
    warnings.push("Circuitos devem ser > 0.");
  if (!input.geometry.rows || input.geometry.rows <= 0)
    warnings.push("Fileiras devem ser > 0.");

  const nominal = input.nominal ?? estimateNominalEvap(input);
  const estimated = !input.nominal;
  if (estimated) warnings.push("Capacidade nominal estimada (sem datasheet).");

  const dtNom = nominal.airTempInC - nominal.refTempC;
  const dtReal = (air.airTempInC ?? 0) - (ref.refTempC ?? 0);

  if (dtNom <= 0) warnings.push("DT nominal inválido (≤ 0).");
  else if (dtReal < 4) warnings.push(`DT baixo (${dtReal.toFixed(1)} K) — recomendado 4–15 K.`);
  else if (dtReal > 15) warnings.push(`DT alto (${dtReal.toFixed(1)} K) — recomendado 4–15 K.`);

  const airflow = air.airflowM3h ?? nominal.airflowM3h;
  const airflowFactor = nominal.airflowM3h > 0 ? airflow / nominal.airflowM3h : 1;
  const frost = input.frostFactor ?? 0.9;
  const fouling = input.foulingFactor ?? 1.0;

  const dtFactor = dtNom > 0 ? Math.max(dtReal / dtNom, 0) ** 1.2 : 0;
  const correction = dtFactor * airflowFactor * frost * fouling;
  const capacityW = Math.max(nominal.capacityW * correction, 0);

  // Sensível/Latente — split por umidade relativa
  let sensible: number | null = null;
  let latent: number | null = null;
  if (air.rhInPct != null) {
    const sensFrac = air.rhInPct < 50 ? 0.95 : air.rhInPct < 70 ? 0.85 : 0.75;
    sensible = capacityW * sensFrac;
    latent = capacityW - sensible;
  }

  // Água condensada (kg/h ≈ latentW * 3600 / 2500 kJ/kg)
  const condensateLh = latent != null ? (latent * 3600) / 2_500_000 * 1000 : null;

  const faceArea = estimateFaceArea(input);
  const faceVelocity =
    air.faceVelocityMs ??
    (faceArea && airflow ? airflow / 3600 / faceArea : null);

  if (faceVelocity != null) {
    if (faceVelocity < 1.5) warnings.push(`Velocidade frontal baixa (${faceVelocity.toFixed(2)} m/s).`);
    if (faceVelocity > 3.5) warnings.push(`Velocidade frontal alta (${faceVelocity.toFixed(2)} m/s).`);
  }

  // Perda de carga ar — aproximação ΔP = 8 * rows * (vfront)^1.7
  const airDp =
    faceVelocity != null && input.geometry.rows
      ? 8 * input.geometry.rows * faceVelocity ** 1.7
      : null;

  // Aplicação da calibração (pós-processamento empírico)
  const capCal = capacityW * cal.capacityCorrectionFactor;
  const sensibleCal = sensible != null ? sensible * cal.capacityCorrectionFactor : null;
  const latentCal = latent != null ? latent * cal.capacityCorrectionFactor : null;
  const condensateCal =
    condensateLh != null ? condensateLh * cal.capacityCorrectionFactor : null;
  const airDpCal = airDp != null ? airDp * cal.airPressureDropFactor : null;
  const refDpCal =
    ref.refrigerantPressureDropKpa != null
      ? ref.refrigerantPressureDropKpa * cal.refrigerantPressureDropFactor
      : null;

  return {
    coilType: "evaporator",
    capacityW: capCal,
    capacityKcalh: capCal * W_TO_KCALH,
    sensibleW: sensibleCal,
    latentW: latentCal,
    dtRealK: dtReal,
    dtNominalK: dtNom,
    faceAreaM2: faceArea,
    faceVelocityMs: faceVelocity,
    airflowFactor,
    dtFactor,
    airPressureDropPa: airDpCal,
    refPressureDropKpa: refDpCal,
    condensateLh: condensateCal,
    warnings,
    rejection: { used: nominal, estimated },
    debug: runHybridDebug(input),
  };
}
