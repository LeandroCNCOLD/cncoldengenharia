import { calculateCoilGeometry } from "./geometry/coilGeometry";
import { calculateRefrigerantCharge } from "./refrigerants/charge";
import { calculateHeatTransfer } from "./heatTransfer/heatTransfer";
import type { ThermalCalcInput, ThermalCalcResult } from "../types";

export function calculateThermalCoil(input: ThermalCalcInput): ThermalCalcResult {
  const geometry = calculateCoilGeometry(input.geometry);
  const refrigerantCharge = input.refrigerantCode
    ? calculateRefrigerantCharge(geometry.internalVolumeM3, input.refrigerantCode, {
        referenceTemperatureC: input.referenceTemperatureC,
        fillFactor: input.fillFactor,
      })
    : null;
  const heatTransfer = input.heatTransfer
    ? calculateHeatTransfer({
        ...input.heatTransfer,
        geometry: input.geometry,
      })
    : null;

  return {
    geometry,
    refrigerantCharge,
    heatTransfer,
    warnings: [
      ...geometry.warnings,
      ...(refrigerantCharge?.warnings ?? []),
      ...(heatTransfer?.warnings ?? []),
    ],
  };
}

export const calculateThermalCalc = calculateThermalCoil;

export * from "./geometry/coilGeometry";
export * from "./geometry/effectiveArea";
export * from "./heatTransfer/airSide";
export * from "./heatTransfer/heatTransfer";
export * from "./heatTransfer/refrigerantSide";
export * from "./refrigerants/charge";
export * from "./units";
export * from "./validation/geometryValidation";
