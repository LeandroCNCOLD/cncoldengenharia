interface CoilGeometry {
  rows: number;
  finnedLengthMm: number;
  finnedHeightMm: number;
  finPitchMm: number;
  tubePitchTransversalMm: number;
  tubePitchLongitudinalMm: number;
  tubeExternalDiameterMm: number;
  tubeInternalDiameterMm: number;
  tubesPerRow: number;
  finThicknessMm: number;
}

export interface CoilMaterialEstimate {
  copperKg: number;
  aluminumKg: number;
  totalWeightKg: number;
  totalTubeLengthM: number;
  totalFinAreaM2: number;
  totalExternalAreaM2: number;
}

const COPPER_DENSITY_KGM3 = 8960;
const ALUMINUM_DENSITY_KGM3 = 2700;

export function estimateCoilMaterials(geo: CoilGeometry): CoilMaterialEstimate {
  const mmToM = (mm: number) => mm / 1000;
  const L = mmToM(geo.finnedLengthMm);
  const H = mmToM(geo.finnedHeightMm);
  const Fp = mmToM(geo.finPitchMm);
  const do_ = mmToM(geo.tubeExternalDiameterMm);
  const di = mmToM(geo.tubeInternalDiameterMm);
  const tf = mmToM(geo.finThicknessMm);

  const totalTubes = geo.rows * geo.tubesPerRow;
  const totalTubeLengthM = totalTubes * L;
  const tubeWallArea = (Math.PI * (do_ ** 2 - di ** 2)) / 4;
  const copperVolumeM3 = tubeWallArea * totalTubeLengthM;
  const copperKg = copperVolumeM3 * COPPER_DENSITY_KGM3;

  const nFins = Math.floor(L / Fp) + 1;
  const finArea = Math.max(0, H * L - (totalTubes * Math.PI * do_ ** 2) / 4 / geo.rows);
  const aluminumVolumeM3 = nFins * finArea * tf;
  const aluminumKg = aluminumVolumeM3 * ALUMINUM_DENSITY_KGM3;

  const finAreaTotal = nFins * 2 * finArea;
  const tubeExposedArea = totalTubeLengthM * Math.PI * do_ * Math.max(0, 1 - tf / Fp);
  const totalExternalAreaM2 = finAreaTotal + tubeExposedArea;

  return {
    copperKg,
    aluminumKg,
    totalWeightKg: copperKg + aluminumKg,
    totalTubeLengthM,
    totalFinAreaM2: finAreaTotal,
    totalExternalAreaM2,
  };
}

export function computeObjectiveValue(
  candidate: { estimatedWeightKg: number; airPressureDropPa: number; totalCapacityW: number },
  objective: string,
  referenceValues: { maxWeight: number; maxDp: number; maxCapacity: number },
): number {
  switch (objective) {
    case "minimize_cost":
    case "minimize_weight":
      return candidate.estimatedWeightKg / Math.max(referenceValues.maxWeight, 1);
    case "minimize_dp_air":
      return candidate.airPressureDropPa / Math.max(referenceValues.maxDp, 1);
    case "maximize_cop":
      return candidate.estimatedWeightKg / Math.max(1, candidate.totalCapacityW / 1000);
    case "maximize_capacity":
      return 1 - candidate.totalCapacityW / Math.max(referenceValues.maxCapacity, 1);
    default:
      return candidate.estimatedWeightKg / Math.max(referenceValues.maxWeight, 1);
  }
}
