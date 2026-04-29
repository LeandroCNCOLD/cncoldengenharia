import type { RefrigerantFluid, RefrigerantPropertyPoint } from "../types";

function points(
  densityAtMinus10: number,
  densityAtZero: number,
  cpJKgK: number,
  viscosityPaS: number,
  thermalConductivityWmK: number,
  latentHeatJKg: number,
): RefrigerantPropertyPoint[] {
  return [
    {
      temperatureC: -10,
      densityKgM3: densityAtMinus10,
      liquidDensityKgM3: densityAtMinus10,
      vaporDensityKgM3: Math.max(8, densityAtMinus10 * 0.025),
      cpJKgK,
      viscosityPaS,
      thermalConductivityWmK,
      latentHeatJKg,
    },
    {
      temperatureC: 0,
      densityKgM3: densityAtZero,
      liquidDensityKgM3: densityAtZero,
      vaporDensityKgM3: Math.max(10, densityAtZero * 0.03),
      cpJKgK: cpJKgK * 1.02,
      viscosityPaS: viscosityPaS * 0.94,
      thermalConductivityWmK: thermalConductivityWmK * 0.98,
      latentHeatJKg: latentHeatJKg * 0.96,
    },
  ];
}

export const REFRIGERANT_FLUIDS: RefrigerantFluid[] = [
  {
    code: "R404A",
    name: "R404A",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1045 }],
    propertyPoints: points(1045, 1016, 1420, 0.00022, 0.075, 176000),
    defaultFillFactor: 0.62,
  },
  {
    code: "R507",
    name: "R507",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1070 }],
    propertyPoints: points(1070, 1040, 1390, 0.00023, 0.073, 171000),
    defaultFillFactor: 0.62,
  },
  {
    code: "R134A",
    name: "R134a",
    densityPoints: [{ referenceTemperatureC: 0, densityKgM3: 1295 }],
    propertyPoints: points(1325, 1295, 1360, 0.00025, 0.083, 198000),
    defaultFillFactor: 0.58,
  },
  {
    code: "R22",
    name: "R22",
    densityPoints: [{ referenceTemperatureC: -5, densityKgM3: 1230 }],
    propertyPoints: points(1255, 1212, 1240, 0.0002, 0.087, 219000),
    defaultFillFactor: 0.6,
  },
  {
    code: "R410A",
    name: "R410A",
    densityPoints: [{ referenceTemperatureC: 5, densityKgM3: 1090 }],
    propertyPoints: points(1135, 1105, 1680, 0.00018, 0.083, 224000),
    defaultFillFactor: 0.58,
  },
  {
    code: "R448A",
    name: "R448A",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1075 }],
    propertyPoints: points(1075, 1048, 1500, 0.00023, 0.077, 190000),
    defaultFillFactor: 0.62,
  },
  {
    code: "R449A",
    name: "R449A",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1085 }],
    propertyPoints: points(1085, 1058, 1510, 0.00023, 0.078, 192000),
    defaultFillFactor: 0.62,
  },
  {
    code: "R290",
    name: "R290 Propano",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 545 }],
    propertyPoints: points(545, 528, 2450, 0.00013, 0.105, 356000),
    defaultFillFactor: 0.48,
  },
  {
    code: "R744",
    name: "CO2/R744",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 930 }],
    propertyPoints: points(930, 900, 2100, 0.0001, 0.11, 260000),
    defaultFillFactor: 0.45,
  },
];

export function normalizeRefrigerantCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/^CO2$/, "R744")
    .replace(/^CO₂$/, "R744")
    .replace(/[^A-Z0-9]/g, "");
}

export function findRefrigerantFluid(code: string): RefrigerantFluid | null {
  const normalized = normalizeRefrigerantCode(code);
  return (
    REFRIGERANT_FLUIDS.find((fluid) => normalizeRefrigerantCode(fluid.code) === normalized) ??
    REFRIGERANT_FLUIDS.find((fluid) => normalizeRefrigerantCode(fluid.name) === normalized) ??
    null
  );
}

function interpolatePropertyPoint(
  lower: RefrigerantPropertyPoint,
  upper: RefrigerantPropertyPoint,
  temperatureC: number,
): RefrigerantPropertyPoint {
  const span = upper.temperatureC - lower.temperatureC;
  const ratio = span === 0 ? 0 : (temperatureC - lower.temperatureC) / span;
  const mix = (key: keyof RefrigerantPropertyPoint): number | undefined => {
    const low = lower[key];
    const high = upper[key];
    if (typeof low !== "number" || typeof high !== "number") return undefined;
    return low + (high - low) * ratio;
  };

  return {
    temperatureC,
    densityKgM3: mix("densityKgM3") ?? lower.densityKgM3,
    cpJKgK: mix("cpJKgK") ?? lower.cpJKgK,
    viscosityPaS: mix("viscosityPaS") ?? lower.viscosityPaS,
    thermalConductivityWmK: mix("thermalConductivityWmK") ?? lower.thermalConductivityWmK,
    liquidDensityKgM3: mix("liquidDensityKgM3"),
    vaporDensityKgM3: mix("vaporDensityKgM3"),
    latentHeatJKg: mix("latentHeatJKg"),
  };
}

export function getRefrigerantProperties(
  code: string,
  temperatureC: number,
): RefrigerantPropertyPoint | null {
  const fluid = findRefrigerantFluid(code);
  if (!fluid || fluid.propertyPoints.length === 0) return null;

  const sorted = [...fluid.propertyPoints].sort((a, b) => a.temperatureC - b.temperatureC);
  const exact = sorted.find((point) => point.temperatureC === temperatureC);
  if (exact) return exact;

  const lower = [...sorted].reverse().find((point) => point.temperatureC < temperatureC);
  const upper = sorted.find((point) => point.temperatureC > temperatureC);
  if (lower && upper) return interpolatePropertyPoint(lower, upper, temperatureC);

  return sorted.reduce((best, point) =>
    Math.abs(point.temperatureC - temperatureC) < Math.abs(best.temperatureC - temperatureC)
      ? point
      : best,
  );
}
