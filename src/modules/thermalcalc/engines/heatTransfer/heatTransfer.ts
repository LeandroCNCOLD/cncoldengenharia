import { calculateCoilGeometry } from "@/modules/thermalcalc/engines/geometry/coilGeometry";
import type { HeatTransferInput, HeatTransferResult } from "@/modules/thermalcalc/types";

const DEFAULT_U_WM2K = 35;
const W_TO_KCALH = 0.8598452279;

export function calculateHeatTransfer(input: HeatTransferInput): HeatTransferResult {
  const geometry = calculateCoilGeometry(input.geometry);
  const u = input.overallHeatTransferCoefficientWm2K ?? DEFAULT_U_WM2K;
  const effectiveAreaM2 = geometry.externalAreaM2 * (input.effectiveAreaFactor ?? 1);
  const deltaTemperatureK = Math.abs(input.airInletTemperatureC - input.refrigerantTemperatureC);
  const capacityW = u * effectiveAreaM2 * deltaTemperatureK;

  return {
    deltaTemperatureK,
    overallHeatTransferCoefficientWm2K: u,
    effectiveAreaM2,
    capacityW,
    capacityKcalh: capacityW * W_TO_KCALH,
    geometry,
    warnings: geometry.warnings,
  };
}
