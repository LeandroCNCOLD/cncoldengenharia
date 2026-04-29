import type { CoilSimulatorInput } from "@/modules/coldpro/coil/coilSimulatorTypes";
import type { ThermalCalcResult } from "../../types";
import { calculateThermalCoil } from "../index";

export function thermalCalcFromCoilSimulator(input: CoilSimulatorInput): ThermalCalcResult | null {
  const geometry = input.geometry;
  const tubeOuterDiameterMm = geometry.tubeOdMm;
  const usefulLengthMm = geometry.coilLengthMm;
  const rows = geometry.rows;
  const tubesPerRow = geometry.tubesPerRow;
  const circuits = geometry.circuits;
  const finPitchMm = geometry.finPitchMm;

  if (
    tubeOuterDiameterMm == null ||
    usefulLengthMm == null ||
    rows == null ||
    tubesPerRow == null ||
    circuits == null ||
    finPitchMm == null
  ) {
    return null;
  }

  return calculateThermalCoil({
    geometry: {
      tube: {
        outerDiameterMm: tubeOuterDiameterMm,
        innerDiameterMm: geometry.tubeIdMm,
        wallThicknessMm: geometry.tubeWallMm,
        usefulLengthMm,
        rows,
        tubesPerRow,
        circuits,
        skippedTubes: geometry.skippedTubes,
        tubePitchMm: geometry.tubeSpacingMm,
        rowPitchMm: geometry.rowSpacingMm,
        material: geometry.tubeMaterial,
      },
      fin: {
        finPitchMm,
        finThicknessMm: geometry.finThicknessMm,
        material: geometry.finMaterial,
      },
    },
    refrigerantCode: input.refrigerant.refrigerant,
    referenceTemperatureC: input.refrigerant.refTempC,
    heatTransfer:
      input.air.airTempInC != null && input.refrigerant.refTempC != null
        ? {
            airInletTemperatureC: input.air.airTempInC,
            refrigerantTemperatureC: input.refrigerant.refTempC,
          }
        : undefined,
  });
}

export const buildThermalCalcFromCoilSimulatorInput = thermalCalcFromCoilSimulator;
