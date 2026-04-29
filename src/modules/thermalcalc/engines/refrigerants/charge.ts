import {
  REFRIGERANT_FLUIDS,
  findRefrigerantFluid,
  getRefrigerantProperties,
} from "../../data/refrigerants";
import type { RefrigerantChargeResult, RefrigerantFluid, ValidationWarning } from "../../types";

interface RefrigerantChargeOptions {
  referenceTemperatureC?: number;
  fillFactor?: number;
}

export function getDensityForTemperature(
  fluid: RefrigerantFluid,
  referenceTemperatureC = fluid.densityPoints[0]?.referenceTemperatureC ?? 0,
): { densityKgM3: number; referenceTemperatureC: number; warning?: ValidationWarning } {
  const properties = getRefrigerantProperties(fluid.code, referenceTemperatureC);
  if (properties) {
    return {
      densityKgM3: properties.densityKgM3,
      referenceTemperatureC,
    };
  }

  const sorted = [...fluid.densityPoints].sort(
    (a, b) => a.referenceTemperatureC - b.referenceTemperatureC,
  );

  if (sorted.length === 0) {
    return {
      densityKgM3: 0,
      referenceTemperatureC,
      warning: {
        code: "MISSING_DENSITY_TABLE",
        severity: "error",
        message: `Fluido ${fluid.code} não possui tabela de densidade.`,
        path: "refrigerant.densityPoints",
      },
    };
  }

  const exact = sorted.find((p) => p.referenceTemperatureC === referenceTemperatureC);
  if (exact) {
    return {
      densityKgM3: exact.densityKgM3,
      referenceTemperatureC: exact.referenceTemperatureC,
    };
  }

  const lower = [...sorted].reverse().find((p) => p.referenceTemperatureC < referenceTemperatureC);
  const upper = sorted.find((p) => p.referenceTemperatureC > referenceTemperatureC);
  if (lower && upper) {
    const ratio =
      (referenceTemperatureC - lower.referenceTemperatureC) /
      (upper.referenceTemperatureC - lower.referenceTemperatureC);
    return {
      densityKgM3: lower.densityKgM3 + (upper.densityKgM3 - lower.densityKgM3) * ratio,
      referenceTemperatureC,
    };
  }

  const nearest = sorted.reduce((best, point) =>
    Math.abs(point.referenceTemperatureC - referenceTemperatureC) <
    Math.abs(best.referenceTemperatureC - referenceTemperatureC)
      ? point
      : best,
  );

  return {
    densityKgM3: nearest.densityKgM3,
    referenceTemperatureC: nearest.referenceTemperatureC,
    warning: {
      code: "DENSITY_TEMPERATURE_EXTRAPOLATED",
      severity: "warning",
      message: `Temperatura ${referenceTemperatureC} °C fora da tabela de ${fluid.code}; usando ponto ${nearest.referenceTemperatureC} °C.`,
      path: "referenceTemperatureC",
    },
  };
}

export function calculateRefrigerantMass(
  internalVolumeM3: number,
  fluidOrCode: RefrigerantFluid | string,
  options: RefrigerantChargeOptions = {},
): RefrigerantChargeResult {
  const fluid = typeof fluidOrCode === "string" ? findRefrigerantFluid(fluidOrCode) : fluidOrCode;
  const warnings: ValidationWarning[] = [];

  if (!fluid) {
    const fallback = REFRIGERANT_FLUIDS[0];
    warnings.push({
      code: "UNKNOWN_REFRIGERANT",
      severity: "error",
      message: `Fluido ${String(fluidOrCode)} não encontrado; usando ${fallback.code} apenas para preservar o cálculo.`,
      path: "refrigerantCode",
    });
    return calculateRefrigerantMass(internalVolumeM3, fallback, options);
  }

  const density = getDensityForTemperature(fluid, options.referenceTemperatureC);
  if (density.warning) warnings.push(density.warning);

  const effectiveFillFactor = options.fillFactor ?? fluid.defaultFillFactor;
  if (effectiveFillFactor <= 0 || effectiveFillFactor > 1) {
    warnings.push({
      code: "FILL_FACTOR_OUT_OF_RANGE",
      severity: "error",
      message: "Fator de preenchimento deve estar no intervalo 0 < fator <= 1.",
      path: "fillFactor",
    });
  }

  const massKg =
    internalVolumeM3 * density.densityKgM3 * Math.max(0, Math.min(effectiveFillFactor, 1));

  return {
    refrigerantCode: fluid.code,
    referenceTemperatureC: density.referenceTemperatureC,
    densityKgM3: density.densityKgM3,
    fillFactor: effectiveFillFactor,
    internalVolumeM3,
    massKg,
    warnings,
  };
}

export function calculateRefrigerantCharge(
  internalVolumeM3: number,
  fluidOrCode: RefrigerantFluid | string,
  options: RefrigerantChargeOptions = {},
): RefrigerantChargeResult {
  return calculateRefrigerantMass(internalVolumeM3, fluidOrCode, options);
}
