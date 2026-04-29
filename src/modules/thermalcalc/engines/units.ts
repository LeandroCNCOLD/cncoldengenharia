export const MM_PER_M = 1000;
export const L_PER_M3 = 1000;
export const KCALH_PER_W = 0.8598452279;

export function mmToM(valueMm: number): number {
  return valueMm / MM_PER_M;
}

export function m3ToL(valueM3: number): number {
  return valueM3 * L_PER_M3;
}

export function wattsToKcalh(valueW: number): number {
  return valueW * KCALH_PER_W;
}

export function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
