// Conversões de unidade — sem mocks, sem aproximações arbitrárias.
// Use sempre estas funções; nunca espalhe constantes mágicas pelo motor.

export const MM_TO_M = 1e-3;
export const M3H_TO_M3S = 1 / 3600;
export const KPA_TO_PA = 1e3;
export const PA_TO_KPA = 1e-3;

// Constante universal dos gases secos / vapor d'água — ASHRAE Handbook
export const R_DRY_AIR_J_KG_K = 287.055;
export const R_WATER_VAPOR_J_KG_K = 461.520;

// Cp do ar seco (kJ/kg·K) — valor padrão ASHRAE para ar atmosférico
export const CP_DRY_AIR_KJ_KG_K = 1.006;
// Cp do vapor d'água (kJ/kg·K)
export const CP_WATER_VAPOR_KJ_KG_K = 1.86;
// Calor latente de vaporização da água a 0°C (kJ/kg) — ASHRAE Fundamentals
export const HFG_WATER_AT_0C_KJ_KG = 2501;
// Pressão atmosférica padrão ao nível do mar (Pa)
export const P_ATM_SEA_LEVEL_PA = 101325;

export function mmToM(mm: number): number {
  return mm * MM_TO_M;
}

export function m3hToM3s(v: number): number {
  return v * M3H_TO_M3S;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
