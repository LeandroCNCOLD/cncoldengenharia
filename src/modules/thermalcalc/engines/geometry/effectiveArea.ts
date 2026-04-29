import type { CoilGeometryInput, EffectiveAreaResult, ValidationWarning } from "../../types";
import { mmToM } from "../units";
import { calculateApproximateExternalAreaM2, calculateTotalTubeCount } from "./coilGeometry";

const DEFAULT_AIR_H_WM2K = 45;
const DEFAULT_FIN_THICKNESS_MM = 0.12;
const DEFAULT_FIN_CONDUCTIVITY_WMK = 205;

export function finMaterialConductivityWmK(material?: string): number {
  const normalized = (material ?? "").toLowerCase();
  if (normalized.includes("cobre") || normalized.includes("copper")) return 385;
  if (normalized.includes("inox") || normalized.includes("stainless")) return 16;
  return DEFAULT_FIN_CONDUCTIVITY_WMK;
}

export function calculateFinEfficiency(
  input: CoilGeometryInput,
  airHeatTransferCoefficientWm2K = DEFAULT_AIR_H_WM2K,
): number {
  const tubePitchM = mmToM(input.tube.tubePitchMm ?? 25);
  const rowPitchM = mmToM(input.tube.rowPitchMm ?? input.tube.outerDiameterMm * 2.25);
  const outerRadiusM = mmToM(input.tube.outerDiameterMm) / 2;
  const finThicknessM = mmToM(input.fin.finThicknessMm ?? DEFAULT_FIN_THICKNESS_MM);
  const conductivityWmK = finMaterialConductivityWmK(input.fin.material);

  if (
    airHeatTransferCoefficientWm2K <= 0 ||
    finThicknessM <= 0 ||
    conductivityWmK <= 0 ||
    tubePitchM <= 0 ||
    rowPitchM <= 0
  ) {
    return 1;
  }

  const equivalentRadiusM = Math.sqrt((tubePitchM * rowPitchM) / Math.PI);
  const finLengthM = Math.max(equivalentRadiusM - outerRadiusM, 0.001);
  const m = Math.sqrt((2 * airHeatTransferCoefficientWm2K) / (conductivityWmK * finThicknessM));
  const mL = m * finLengthM;

  if (mL < 1e-9) return 1;
  return Math.max(0.35, Math.min(1, Math.tanh(mL) / mL));
}

export function calculateEffectiveArea(
  input: CoilGeometryInput,
  airHeatTransferCoefficientWm2K = DEFAULT_AIR_H_WM2K,
): EffectiveAreaResult {
  const area = calculateApproximateExternalAreaM2(input);
  const finEfficiency = calculateFinEfficiency(input, airHeatTransferCoefficientWm2K);
  const totalExternalAreaM2 = area.externalAreaM2;
  const effectiveAreaM2 = area.externalTubeAreaM2 + area.externalFinAreaM2 * finEfficiency;
  const overallSurfaceEfficiency =
    totalExternalAreaM2 > 0 ? effectiveAreaM2 / totalExternalAreaM2 : 0;
  const warnings: ValidationWarning[] = [];
  const totalTubes = calculateTotalTubeCount(input);

  if (area.externalFinAreaM2 <= 0) {
    warnings.push({
      code: "NO_FIN_AREA",
      severity: "warning",
      message: "Área de aletas calculada como zero; verificar altura/profundidade/passo.",
      path: "fin",
    });
  }

  if (totalTubes <= 0 || totalExternalAreaM2 <= 0 || effectiveAreaM2 <= 0) {
    warnings.push({
      code: "INVALID_EFFECTIVE_AREA",
      severity: "error",
      message: "Área externa efetiva deve ser positiva para cálculo térmico.",
      path: "geometry",
    });
  }

  if (overallSurfaceEfficiency < 0.35 || overallSurfaceEfficiency > 1) {
    warnings.push({
      code: "SURFACE_EFFICIENCY_OUT_OF_RANGE",
      severity: "warning",
      message: "Eficiência global de superfície fora da faixa física esperada.",
      path: "geometry.effectiveArea",
    });
  }

  return {
    externalTubeAreaM2: area.externalTubeAreaM2,
    externalFinAreaM2: area.externalFinAreaM2,
    totalExternalAreaM2,
    effectiveAreaM2,
    finEfficiency,
    overallSurfaceEfficiency,
    finCount: area.finCount,
    warnings,
  };
}
