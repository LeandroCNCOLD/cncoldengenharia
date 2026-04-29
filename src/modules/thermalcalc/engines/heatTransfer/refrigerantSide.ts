import { getRefrigerantProperties } from "../../data/refrigerants";
import type {
  CoilGeometryInput,
  CoilGeometryResult,
  RefrigerantHeatTransferCorrelation,
  RefrigerantSideInput,
  ValidationWarning,
} from "../../types";
import { calculateCoilGeometry } from "../geometry/coilGeometry";

const DEFAULT_REFRIGERANT = "R404A";

export interface RefrigerantSideResult {
  coefficientWm2K: number;
  pressureDropPa: number;
  reynolds: number;
  prandtl: number;
  correlation: RefrigerantHeatTransferCorrelation;
  warnings: ValidationWarning[];
}

function frictionFactor(reynolds: number): number {
  if (reynolds < 2300) return 64 / Math.max(reynolds, 1);
  return (0.79 * Math.log(reynolds) - 1.64) ** -2;
}

function nusseltDittusBoelter(reynolds: number, prandtl: number): number {
  return 0.023 * reynolds ** 0.8 * prandtl ** 0.4;
}

function nusseltGnielinski(reynolds: number, prandtl: number): number {
  const f = frictionFactor(reynolds);
  if (reynolds < 3000) return nusseltDittusBoelter(reynolds, prandtl) * 0.8;
  const numerator = (f / 8) * (reynolds - 1000) * prandtl;
  const denominator = 1 + 12.7 * Math.sqrt(f / 8) * (prandtl ** (2 / 3) - 1);
  return numerator / denominator;
}

export function calculateRefrigerantSideCoefficient(
  geometry: CoilGeometryResult,
  input: RefrigerantSideInput = {},
): RefrigerantSideResult {
  const warnings: ValidationWarning[] = [];
  const code = input.code ?? DEFAULT_REFRIGERANT;
  const temperatureC =
    input.saturationTemperatureC ?? input.inletTemperatureC ?? input.outletTemperatureC ?? -10;
  const properties = getRefrigerantProperties(code, temperatureC);

  if (!properties) {
    warnings.push({
      code: "UNKNOWN_REFRIGERANT_PROPERTIES",
      severity: "error",
      message: `Propriedades termofísicas não encontradas para ${code}.`,
      path: "refrigerant.code",
    });
  }

  const rho = properties?.densityKgM3 ?? 1000;
  const cp = properties?.cpJKgK ?? 1500;
  const mu = properties?.viscosityPaS ?? 0.0002;
  const k = properties?.thermalConductivityWmK ?? 0.08;
  const latentHeat = properties?.latentHeatJKg ?? 180000;
  const areaPerCircuitM2 =
    ((Math.PI * geometry.innerDiameterM ** 2) / 4) *
    Math.max(geometry.totalTubes / Math.max(input.massFluxKgM2S ? 1 : 1, 1), 1);
  const flowAreaM2 =
    input.massFluxKgM2S && input.massFlowKgS
      ? input.massFlowKgS / input.massFluxKgM2S
      : ((Math.PI * geometry.innerDiameterM ** 2) / 4) *
        Math.max(geometry.totalTubes / Math.max(1, 1), 1);
  const massFluxKgM2S =
    input.massFluxKgM2S ??
    (input.massFlowKgS != null ? input.massFlowKgS / Math.max(flowAreaM2, 1e-9) : 80);
  const reynolds = (massFluxKgM2S * geometry.innerDiameterM) / mu;
  const prandtl = (cp * mu) / k;
  const requested = input.correlation ?? (reynolds > 3000 ? "gnielinski" : "dittus_boelter");

  let nusselt = 0;
  if (requested === "gnielinski") {
    nusselt = nusseltGnielinski(reynolds, prandtl);
  } else if (requested === "shah_evaporation") {
    const quality = Math.max(0.01, Math.min(input.quality ?? 0.2, 0.95));
    const boilingNumber = input.massFlowKgS
      ? Math.max(1e-6, (input.massFlowKgS * latentHeat) / Math.max(geometry.internalAreaM2, 1e-9))
      : 0.001;
    nusselt =
      nusseltGnielinski(Math.max(reynolds, 3000), prandtl) *
      (1 + 2.53 * quality ** 0.8 + boilingNumber ** 0.15);
  } else if (requested === "condensation_base") {
    nusselt = nusseltGnielinski(Math.max(reynolds, 3000), prandtl) * 1.35;
  } else {
    nusselt = nusseltDittusBoelter(Math.max(reynolds, 1000), prandtl);
  }

  const coefficientWm2K = Math.max(100, (nusselt * k) / Math.max(geometry.innerDiameterM, 1e-9));
  const f = frictionFactor(Math.max(reynolds, 1));
  const equivalentLengthM = geometry.totalTubeLengthM / Math.max(geometry.totalTubes, 1);
  const velocityMS = massFluxKgM2S / rho;
  const pressureDropPa =
    (f * (equivalentLengthM / Math.max(geometry.innerDiameterM, 1e-9)) * (rho * velocityMS ** 2)) /
    2;

  if (reynolds < 2300 && requested !== "dittus_boelter") {
    warnings.push({
      code: "LOW_REYNOLDS_REFRIGERANT",
      severity: "warning",
      message: "Reynolds do refrigerante está em regime laminar/transição.",
      path: "refrigerant.massFlowKgS",
    });
  }

  void areaPerCircuitM2;

  return {
    coefficientWm2K,
    pressureDropPa,
    reynolds,
    prandtl,
    correlation: requested,
    warnings,
  };
}

export function calculateRefrigerantSideHeatTransfer(
  geometryInput: CoilGeometryInput,
  input: RefrigerantSideInput = {},
  fallbackTemperatureC = -10,
): {
  hRefrigerantWm2K: number;
  pressureDropPa: number;
  reynolds: number;
  prandtl: number;
  correlation: RefrigerantHeatTransferCorrelation;
  warnings: ValidationWarning[];
} {
  const geometry = calculateCoilGeometry(geometryInput);
  const result = calculateRefrigerantSideCoefficient(geometry, {
    saturationTemperatureC: fallbackTemperatureC,
    ...input,
  });

  return {
    hRefrigerantWm2K: result.coefficientWm2K,
    pressureDropPa: result.pressureDropPa,
    reynolds: result.reynolds,
    prandtl: result.prandtl,
    correlation: result.correlation,
    warnings: result.warnings,
  };
}
