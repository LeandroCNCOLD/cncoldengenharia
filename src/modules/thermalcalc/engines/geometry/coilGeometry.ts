import type { CoilGeometryInput, CoilGeometryResult } from "../../types";
import { mmToM } from "../units";
import { validateGeometry } from "../validation/geometryValidation";

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

  return {
    innerDiameterM,
    totalTubes,
    totalTubeLengthM,
    internalAreaM2,
    externalTubeAreaM2: external.externalTubeAreaM2,
    externalFinAreaM2: external.externalFinAreaM2,
    externalAreaM2: external.externalAreaM2,
    internalVolumeM3,
    internalVolumeL: internalVolumeM3 * 1000,
    finCount: external.finCount,
    frontalAreaM2: external.frontalAreaM2,
    finnedDepthM: external.finnedDepthM,
    warnings,
  };
}
