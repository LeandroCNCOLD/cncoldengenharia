import type {
  CoilGeometryInput,
  CoilGeometryResult,
  GeometrySource,
  ValidationWarning,
} from "../../types";
import { mmToM } from "../units";
import { validateGeometry } from "../validation/geometryValidation";
import { calculateEffectiveArea } from "./effectiveArea";

const PI = Math.PI;

export function calculateInnerDiameterM(
  outerDiameterMm: number,
  wallThicknessMm?: number,
  innerDiameterMm?: number,
): number {
  if (innerDiameterMm != null) return mmToM(innerDiameterMm);
  return mmToM(outerDiameterMm - 2 * (wallThicknessMm ?? 0));
}

export function calculateTotalTubeCount(input: CoilGeometryInput): number {
  return input.tube.rows * input.tube.tubesPerRow - (input.tube.skippedTubes ?? 0);
}

export function calculateTotalTubeLengthM(input: CoilGeometryInput): number {
  return calculateTotalTubeCount(input) * mmToM(input.tube.usefulLengthMm);
}

export function calculateInternalAreaM2(innerDiameterM: number, totalTubeLengthM: number): number {
  return PI * innerDiameterM * totalTubeLengthM;
}

export function calculateInternalVolumeM3(
  innerDiameterM: number,
  totalTubeLengthM: number,
): number {
  return PI * ((innerDiameterM * innerDiameterM) / 4) * totalTubeLengthM;
}

export interface FittedGeometryResult {
  geometrySource: GeometrySource;
  totalTubes: number;
  tubesPerRow: number;
  rows: number;
  circuits: number;
  effectiveTubeLengthMm: number;
  effectiveTubeLengthM: number;
  totalTubeLengthM: number;
  internalAreaM2: number;
  internalVolumeM3: number;
  internalVolumeL: number;
  volumeDeviationPct: number;
  areaDeviationPct: number;
  warnings: ValidationWarning[];
}

export function fitGeometryToUnilab(
  input: CoilGeometryInput,
  unilabExchangeAreaM2: number,
  unilabInternalVolumeL: number,
): FittedGeometryResult {
  const warnings: ValidationWarning[] = [];
  const innerDiameterM = calculateInnerDiameterM(
    input.tube.outerDiameterMm,
    input.tube.wallThicknessMm,
    input.tube.innerDiameterMm,
  );
  const baseTotalTubes = Math.max(1, calculateTotalTubeCount(input));
  const crossSectionM2 = PI * ((innerDiameterM * innerDiameterM) / 4);
  const targetVolumeM3 = unilabInternalVolumeL / 1000;
  const fittedTotalTubeLengthM = targetVolumeM3 / Math.max(crossSectionM2, 1e-12);
  const fittedEffectiveTubeLengthMm = (fittedTotalTubeLengthM / baseTotalTubes) * 1000;
  const fittedInternalVolumeM3 = calculateInternalVolumeM3(innerDiameterM, fittedTotalTubeLengthM);
  const calculated = calculateApproximateExternalAreaM2(input);
  const calculatedVolumeM3 = calculateInternalVolumeM3(
    innerDiameterM,
    calculateTotalTubeLengthM(input),
  );
  const areaDeviationPct =
    unilabExchangeAreaM2 > 0
      ? ((calculated.externalAreaM2 - unilabExchangeAreaM2) / unilabExchangeAreaM2) * 100
      : 0;
  const volumeDeviationPct =
    targetVolumeM3 > 0 ? ((calculatedVolumeM3 - targetVolumeM3) / targetVolumeM3) * 100 : 0;

  if (Math.abs(volumeDeviationPct) > 5) {
    warnings.push({
      code: "GEOMETRY_FITTED_TO_UNILAB_VOLUME",
      severity: "warning",
      path: "unilabInternalVolumeL",
      message: `Volume geométrico ajustado para Unilab (${volumeDeviationPct.toFixed(1)}% de divergência original).`,
    });
  }

  if (Math.abs(areaDeviationPct) > 5) {
    warnings.push({
      code: "GEOMETRY_USES_UNILAB_AREA",
      severity: "warning",
      path: "unilabExchangeAreaM2",
      message: `Área externa Unilab usada como verdade física (${areaDeviationPct.toFixed(1)}% de divergência original).`,
    });
  }

  return {
    geometrySource: "fitted",
    totalTubes: baseTotalTubes,
    tubesPerRow: input.tube.tubesPerRow,
    rows: input.tube.rows,
    circuits: Math.min(Math.max(1, input.tube.circuits), baseTotalTubes),
    effectiveTubeLengthM: fittedEffectiveTubeLengthMm / 1000,
    totalTubeLengthM: fittedTotalTubeLengthM,
    internalAreaM2: calculateInternalAreaM2(innerDiameterM, fittedTotalTubeLengthM),
    internalVolumeM3: fittedInternalVolumeM3,
    internalVolumeL: fittedInternalVolumeM3 * 1000,
    volumeDeviationPct,
    areaDeviationPct,
    warnings,
  };
}

export function calculateApproximateExternalAreaM2(input: CoilGeometryInput): {
  externalTubeAreaM2: number;
  externalFinAreaM2: number;
  externalAreaM2: number;
  finCount: number;
  frontalAreaM2: number | null;
  finnedDepthM: number | null;
} {
  const totalTubes = calculateTotalTubeCount(input);
  const tubeLengthM = mmToM(input.tube.usefulLengthMm);
  const outerDiameterM = mmToM(input.tube.outerDiameterMm);
  const totalTubeLengthM = totalTubes * tubeLengthM;
  const externalTubeAreaM2 = PI * outerDiameterM * totalTubeLengthM;
  const finCount = Math.max(0, Math.floor(input.tube.usefulLengthMm / input.fin.finPitchMm));

  const inferredHeightMm =
    input.fin.finnedHeightMm ?? input.tube.tubesPerRow * (input.tube.tubePitchMm ?? 0);
  const inferredDepthMm =
    input.fin.finnedDepthMm ??
    input.tube.rows * (input.tube.rowPitchMm ?? input.tube.outerDiameterMm);
  const finnedHeightM = inferredHeightMm > 0 ? mmToM(inferredHeightMm) : null;
  const finnedDepthM = inferredDepthMm > 0 ? mmToM(inferredDepthMm) : null;
  const frontalAreaM2 = finnedHeightM != null ? finnedHeightM * tubeLengthM : null;

  let externalFinAreaM2 = 0;
  if (finnedHeightM != null && finnedDepthM != null && finCount > 0) {
    const grossFinAreaM2 = finnedHeightM * finnedDepthM;
    const holeAreaM2 = totalTubes * PI * ((outerDiameterM * outerDiameterM) / 4);
    externalFinAreaM2 = 2 * finCount * Math.max(grossFinAreaM2 - holeAreaM2, 0);
  }

  return {
    externalTubeAreaM2,
    externalFinAreaM2,
    externalAreaM2: externalTubeAreaM2 + externalFinAreaM2,
    finCount,
    frontalAreaM2,
    finnedDepthM,
  };
}

export function calculateCoilGeometry(input: CoilGeometryInput): CoilGeometryResult {
  const warnings = validateGeometry(input);
  const outerDiameterM = mmToM(input.tube.outerDiameterMm);
  const innerDiameterM = calculateInnerDiameterM(
    input.tube.outerDiameterMm,
    input.tube.wallThicknessMm,
    input.tube.innerDiameterMm,
  );
  const totalTubes = calculateTotalTubeCount(input);
  const totalTubeLengthM = calculateTotalTubeLengthM(input);
  const internalAreaM2 = calculateInternalAreaM2(innerDiameterM, totalTubeLengthM);
  const internalVolumeM3 = calculateInternalVolumeM3(innerDiameterM, totalTubeLengthM);
  const external = calculateApproximateExternalAreaM2(input);
  const effectiveArea = calculateEffectiveArea(input);
  const hasUnilabArea = input.unilabExchangeAreaM2 != null && input.unilabExchangeAreaM2 > 0;
  const hasUnilabVolume = input.unilabInternalVolumeL != null && input.unilabInternalVolumeL > 0;
  const fitted =
    hasUnilabArea && hasUnilabVolume
      ? fitGeometryToUnilab(input, input.unilabExchangeAreaM2!, input.unilabInternalVolumeL!)
      : null;
  const geometrySource: GeometrySource =
    hasUnilabArea && hasUnilabVolume ? "imported_unilab" : (fitted?.geometrySource ?? "calculated");
  const geometryMode = hasUnilabArea && hasUnilabVolume ? "geometry_from_unilab" : "calculated";
  const resultTotalTubeLengthM = fitted?.totalTubeLengthM ?? totalTubeLengthM;
  const resultInternalAreaM2 = fitted?.internalAreaM2 ?? internalAreaM2;
  const resultInternalVolumeM3 = hasUnilabVolume
    ? input.unilabInternalVolumeL! / 1000
    : internalVolumeM3;
  const resultExternalAreaM2 = hasUnilabArea
    ? input.unilabExchangeAreaM2!
    : external.externalAreaM2;
  const resultEffectiveAreaM2 = hasUnilabArea
    ? input.unilabExchangeAreaM2!
    : effectiveArea.effectiveAreaM2;
  const resultFinEfficiency = hasUnilabArea ? 1 : effectiveArea.finEfficiency;
  const resultSurfaceEfficiency = hasUnilabArea ? 1 : effectiveArea.overallSurfaceEfficiency;
  const resultExternalTubeAreaM2 = hasUnilabArea
    ? Math.min(external.externalTubeAreaM2, resultExternalAreaM2)
    : external.externalTubeAreaM2;
  const resultExternalFinAreaM2 = hasUnilabArea
    ? Math.max(resultExternalAreaM2 - resultExternalTubeAreaM2, 0)
    : external.externalFinAreaM2;
  const areaDeviationPct =
    hasUnilabArea && input.unilabExchangeAreaM2
      ? ((external.externalAreaM2 - input.unilabExchangeAreaM2) / input.unilabExchangeAreaM2) * 100
      : undefined;
  const volumeDeviationPct =
    hasUnilabVolume && input.unilabInternalVolumeL
      ? ((internalVolumeM3 * 1000 - input.unilabInternalVolumeL) / input.unilabInternalVolumeL) *
        100
      : undefined;

  return {
    innerDiameterM,
    outerDiameterM,
    totalTubes: fitted?.totalTubes ?? totalTubes,
    totalTubeLengthM: resultTotalTubeLengthM,
    effectiveTubeLengthM: fitted?.effectiveTubeLengthM ?? input.tube.usefulLengthMm / 1000,
    tubesPerRow: fitted?.tubesPerRow ?? input.tube.tubesPerRow,
    rows: fitted?.rows ?? input.tube.rows,
    circuits: fitted?.circuits ?? input.tube.circuits,
    geometrySource,
    geometryMode,
    areaDeviationPct,
    volumeDeviationPct,
    unilabExchangeAreaM2: input.unilabExchangeAreaM2,
    unilabInternalVolumeL: input.unilabInternalVolumeL,
    fittedGeometry: fitted ?? undefined,
    internalAreaM2: resultInternalAreaM2,
    externalTubeAreaM2: resultExternalTubeAreaM2,
    externalFinAreaM2: resultExternalFinAreaM2,
    externalAreaM2: resultExternalAreaM2,
    effectiveExternalAreaM2: resultEffectiveAreaM2,
    finEfficiency: resultFinEfficiency,
    overallSurfaceEfficiency: resultSurfaceEfficiency,
    internalVolumeM3: resultInternalVolumeM3,
    internalVolumeL: resultInternalVolumeM3 * 1000,
    finCount: external.finCount,
    frontalAreaM2: external.frontalAreaM2,
    finnedDepthM: external.finnedDepthM,
    freeFlowAreaM2:
      external.frontalAreaM2 != null
        ? Math.max(
            external.frontalAreaM2 - totalTubes * PI * ((outerDiameterM * outerDiameterM) / 4),
            external.frontalAreaM2 * 0.2,
          )
        : null,
    minimumFlowAreaM2:
      external.frontalAreaM2 != null
        ? Math.max(external.frontalAreaM2 * 0.35, external.frontalAreaM2 * (1 - 0.65))
        : null,
    hydraulicDiameterAirM:
      input.fin.finPitchMm > 0
        ? (4 * mmToM(input.fin.finPitchMm) * mmToM(input.tube.tubePitchMm ?? 25)) /
          (2 * (mmToM(input.fin.finPitchMm) + mmToM(input.tube.tubePitchMm ?? 25)))
        : null,
    warnings: [...warnings, ...effectiveArea.warnings, ...(fitted?.warnings ?? [])],
  };
}
