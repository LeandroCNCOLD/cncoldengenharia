// Psicrometria ASHRAE real — pasta engine_v2/ (paralela ao engine/ da Etapa 5).
//
// Fórmulas:
//  - Pressão de saturação sobre água líquida (T ≥ 0 °C):
//      ASHRAE Handbook of Fundamentals 2017, cap. 1, eq. (6) — Hyland-Wexler.
//  - Pressão de saturação sobre gelo (T < 0 °C):
//      ASHRAE 2017, cap. 1, eq. (5) — Hyland-Wexler.
//  - Umidade absoluta (humidity ratio): eq. (22).
//  - Entalpia do ar úmido (kJ/kg ar seco): eq. (32).
//  - Densidade do ar úmido: eq. (26).
//  - Ponto de orvalho: solução iterativa via psat(Tdp) = pw.
//
// Constantes (SI):
const R_DRY_AIR = 287.055;      // J/(kg·K)   gás ideal ar seco
const R_WATER_VAPOR = 461.524;  // J/(kg·K)   gás ideal vapor d'água
const P_ATM_DEFAULT = 101_325;  // Pa         pressão atmosférica padrão (nível do mar)
const T0_K = 273.15;            // K          0 °C em Kelvin

export const PSY_CONSTANTS = {
  R_DRY_AIR,
  R_WATER_VAPOR,
  P_ATM_DEFAULT,
  T0_K,
} as const;

/**
 * Pressão de saturação do vapor d'água [Pa] em função da temperatura [°C].
 * Hyland-Wexler (ASHRAE 2017 Fundamentals, cap. 1, eqs. 5 e 6).
 * Faixa de validade: -100 °C a 200 °C.
 */
export function saturationPressure(T_C: number): number {
  if (!Number.isFinite(T_C)) return Number.NaN;
  const T = T_C + T0_K; // K

  if (T_C < 0) {
    // Eq. (5) — sobre gelo
    const C1 = -5.6745359e3;
    const C2 = 6.3925247;
    const C3 = -9.677843e-3;
    const C4 = 6.2215701e-7;
    const C5 = 2.0747825e-9;
    const C6 = -9.484024e-13;
    const C7 = 4.1635019;
    const lnP =
      C1 / T +
      C2 +
      C3 * T +
      C4 * T * T +
      C5 * T * T * T +
      C6 * T * T * T * T +
      C7 * Math.log(T);
    return Math.exp(lnP);
  }

  // Eq. (6) — sobre água líquida
  const C8 = -5.8002206e3;
  const C9 = 1.3914993;
  const C10 = -4.8640239e-2;
  const C11 = 4.1764768e-5;
  const C12 = -1.4452093e-8;
  const C13 = 6.5459673;
  const lnP =
    C8 / T +
    C9 +
    C10 * T +
    C11 * T * T +
    C12 * T * T * T +
    C13 * Math.log(T);
  return Math.exp(lnP);
}

/**
 * Umidade absoluta W [kg vapor / kg ar seco] a partir de T [°C], RH [0..1]
 * e pressão atmosférica [Pa].
 * ASHRAE 2017, cap. 1, eq. (22) com pw = RH · psat(T).
 */
export function humidityRatio(
  T_C: number,
  RH: number,
  pAtm_Pa: number = P_ATM_DEFAULT,
): number {
  if (!Number.isFinite(T_C) || !Number.isFinite(RH)) return Number.NaN;
  const phi = Math.min(Math.max(RH, 0), 1);
  const psat = saturationPressure(T_C);
  const pw = phi * psat;
  if (pw >= pAtm_Pa) return Number.NaN; // RH/T inconsistente com p_atm
  return 0.621945 * (pw / (pAtm_Pa - pw));
}

/**
 * Entalpia específica do ar úmido [kJ/kg ar seco].
 * ASHRAE 2017 cap. 1, eq. (32):  h = 1.006·t + W·(2501 + 1.86·t),  t em °C.
 */
export function enthalpy(T_C: number, W_kg_kg: number): number {
  if (!Number.isFinite(T_C) || !Number.isFinite(W_kg_kg)) return Number.NaN;
  return 1.006 * T_C + W_kg_kg * (2501 + 1.86 * T_C);
}

/**
 * Densidade do ar úmido [kg/m³ de mistura].
 * Derivada da eq. de gás ideal para mistura ar-vapor (ASHRAE 2017 eq. 26).
 *   v = R_a · T · (1 + 1.6078·W) / p_atm    [m³/kg ar seco]
 *   ρ_mistura = (1 + W) / v
 */
export function airDensity(
  T_C: number,
  W_kg_kg: number,
  pAtm_Pa: number = P_ATM_DEFAULT,
): number {
  if (!Number.isFinite(T_C) || !Number.isFinite(W_kg_kg)) return Number.NaN;
  const T = T_C + T0_K;
  const v = (R_DRY_AIR * T * (1 + 1.6078 * W_kg_kg)) / pAtm_Pa;
  if (!Number.isFinite(v) || v <= 0) return Number.NaN;
  return (1 + W_kg_kg) / v;
}

/**
 * Calor específico do ar úmido [J/(kg·K)] — ASHRAE 2017 cap. 1.
 *   cp_moist = cp_dry + W · cp_vapor
 *   cp_dry ≈ 1006 J/(kg·K),  cp_vapor ≈ 1860 J/(kg·K)
 */
export function moistAirCp(W_kg_kg: number): number {
  if (!Number.isFinite(W_kg_kg)) return Number.NaN;
  return 1006 + 1860 * W_kg_kg;
}

/**
 * Ponto de orvalho [°C] dada T [°C] e RH [0..1].
 * Resolve numericamente psat(Tdp) = RH · psat(T). Bisseção em [-80, 80].
 */
export function dewPoint(
  T_C: number,
  RH: number,
  pAtm_Pa: number = P_ATM_DEFAULT,
): number {
  if (!Number.isFinite(T_C) || !Number.isFinite(RH)) return Number.NaN;
  const phi = Math.min(Math.max(RH, 0), 1);
  if (phi <= 0) return Number.NEGATIVE_INFINITY;
  if (phi >= 1) return T_C;
  void pAtm_Pa; // dewPoint independe de p_atm; assinatura mantida por simetria
  const target = phi * saturationPressure(T_C);

  let lo = -80;
  let hi = T_C;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    const f = saturationPressure(mid) - target;
    if (Math.abs(f) < 1e-3) return mid;
    if (f > 0) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Detecta condensação na superfície da serpentina:
 * se T_superficie < ponto de orvalho do ar de entrada → há condensação (carga latente ativa).
 */
export function checkCondensation(
  T_surface_C: number,
  T_dewPoint_C: number,
): boolean {
  if (!Number.isFinite(T_surface_C) || !Number.isFinite(T_dewPoint_C)) return false;
  return T_surface_C < T_dewPoint_C;
}
