import type { CoilGeometryResult, CoilGeometryInput, FinSurfaceType } from "../../types";
import { calculateCoilGeometry } from "../geometry/coilGeometry";
import { mmToM } from "../units";

export interface AirSideCorrelationInput {
  geometry: CoilGeometryInput;
  geometryResult?: CoilGeometryResult;
  volumeFlowM3H?: number;
  faceVelocityMS?: number;
  densityKgM3?: number;
  cpJKgK?: number;
  viscosityPaS?: number;
  thermalConductivityWmK?: number;
}

export interface AirSideCorrelationResult {
  heatTransferCoefficientWm2K: number;
  pressureDropPa: number;
  reynolds: number;
  jFactor: number;
  frictionFactor: number;
  faceVelocityMS: number;
  massVelocityKgM2S: number;
  correlation: "Chang-Wang louver" | "Wang-Herringbone wavy" | "Plain fin fallback";
}

const DEFAULT_AIR_DENSITY_KGM3 = 1.2;
const DEFAULT_AIR_CP_JKGK = 1006;
const DEFAULT_AIR_MU_PAS = 1.85e-5;
const DEFAULT_AIR_K_WMK = 0.0263;

function surfaceType(input: CoilGeometryInput): FinSurfaceType {
  return input.fin.surfaceType ?? "plain";
}

function colburnJ(
  type: FinSurfaceType,
  re: number,
): {
  jFactor: number;
  frictionFactor: number;
  correlation: AirSideCorrelationResult["correlation"];
} {
  const boundedRe = Math.max(100, re);

  if (type === "louver") {
    return {
      jFactor: 0.12 * boundedRe ** -0.33,
      frictionFactor: 0.92 * boundedRe ** -0.28,
      correlation: "Chang-Wang louver",
    };
  }

  if (type === "wavy" || type === "herringbone") {
    return {
      jFactor: 0.085 * boundedRe ** -0.31,
      frictionFactor: 0.74 * boundedRe ** -0.27,
      correlation: "Wang-Herringbone wavy",
    };
  }

  return {
    jFactor: 0.065 * boundedRe ** -0.28,
    frictionFactor: 0.52 * boundedRe ** -0.25,
    correlation: "Plain fin fallback",
  };
}

export function calculateAirSideCoefficient(
  input: AirSideCorrelationInput,
): AirSideCorrelationResult {
  const geometry = input.geometryResult ?? calculateCoilGeometry(input.geometry);
  const density = input.densityKgM3 ?? DEFAULT_AIR_DENSITY_KGM3;
  const cp = input.cpJKgK ?? DEFAULT_AIR_CP_JKGK;
  const mu = input.viscosityPaS ?? DEFAULT_AIR_MU_PAS;
  const k = input.thermalConductivityWmK ?? DEFAULT_AIR_K_WMK;
  const frontalArea = geometry.frontalAreaM2 ?? 1;
  const faceVelocity =
    input.faceVelocityMS ??
    (input.volumeFlowM3H != null && frontalArea > 0
      ? input.volumeFlowM3H / 3600 / frontalArea
      : 2.5);
  const hydraulicDiameter =
    geometry.hydraulicDiameterAirM ??
    (2 * mmToM(input.geometry.fin.finPitchMm) * mmToM(input.geometry.tube.tubePitchMm ?? 25)) /
      (mmToM(input.geometry.fin.finPitchMm) + mmToM(input.geometry.tube.tubePitchMm ?? 25));
  const massVelocity = density * faceVelocity;
  const reynolds = Math.max(1, (massVelocity * hydraulicDiameter) / mu);
  const prandtl = Math.max(0.1, (cp * mu) / k);
  const { jFactor, frictionFactor, correlation } = colburnJ(surfaceType(input.geometry), reynolds);
  const stanton = jFactor / prandtl ** (2 / 3);
  const heatTransferCoefficientWm2K = Math.max(5, stanton * massVelocity * cp);
  const depth =
    geometry.finnedDepthM ??
    mmToM(input.geometry.tube.rows * (input.geometry.tube.rowPitchMm ?? 22));
  const flowLengthRatio = Math.max(1, depth / hydraulicDiameter);
  const pressureDropPa =
    (frictionFactor * flowLengthRatio * (density * faceVelocity * faceVelocity)) / 2;

  return {
    heatTransferCoefficientWm2K,
    pressureDropPa,
    reynolds,
    jFactor,
    frictionFactor,
    faceVelocityMS: faceVelocity,
    massVelocityKgM2S: massVelocity,
    correlation,
  };
}

export function calculateAirSideHeatTransfer(
  geometry: CoilGeometryInput,
  input: Omit<AirSideCorrelationInput, "geometry"> = {},
): {
  hAirWm2K: number;
  pressureDropPa: number;
  reynolds: number;
  jFactor: number;
  frictionFactor: number;
  faceVelocityMS: number;
  massVelocityKgM2S: number;
  correlation: AirSideCorrelationResult["correlation"];
  warnings: [];
} {
  const result = calculateAirSideCoefficient({ ...input, geometry });

  return {
    hAirWm2K: result.heatTransferCoefficientWm2K,
    pressureDropPa: result.pressureDropPa,
    reynolds: result.reynolds,
    jFactor: result.jFactor,
    frictionFactor: result.frictionFactor,
    faceVelocityMS: result.faceVelocityMS,
    massVelocityKgM2S: result.massVelocityKgM2S,
    correlation: result.correlation,
    warnings: [],
  };
}
