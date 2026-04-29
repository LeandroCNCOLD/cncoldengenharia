import type { RefrigerantFluid } from "../types";

export const REFRIGERANT_FLUIDS: RefrigerantFluid[] = [
  {
    code: "R404A",
    name: "R404A",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1045 }],
    defaultFillFactor: 0.62,
  },
  {
    code: "R507",
    name: "R507",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1070 }],
    defaultFillFactor: 0.62,
  },
  {
    code: "R134A",
    name: "R134a",
    densityPoints: [{ referenceTemperatureC: 0, densityKgM3: 1295 }],
    defaultFillFactor: 0.58,
  },
  {
    code: "R22",
    name: "R22",
    densityPoints: [{ referenceTemperatureC: -5, densityKgM3: 1230 }],
    defaultFillFactor: 0.6,
  },
  {
    code: "R410A",
    name: "R410A",
    densityPoints: [{ referenceTemperatureC: 5, densityKgM3: 1090 }],
    defaultFillFactor: 0.58,
  },
  {
    code: "R448A",
    name: "R448A",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1075 }],
    defaultFillFactor: 0.62,
  },
  {
    code: "R449A",
    name: "R449A",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 1085 }],
    defaultFillFactor: 0.62,
  },
  {
    code: "R290",
    name: "R290 Propano",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 545 }],
    defaultFillFactor: 0.48,
  },
  {
    code: "R744",
    name: "CO2/R744",
    densityPoints: [{ referenceTemperatureC: -10, densityKgM3: 930 }],
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
