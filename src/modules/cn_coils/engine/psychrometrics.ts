// Psicrometria do ar úmido — equações ASHRAE Handbook of Fundamentals (2017),
// capítulo 1 ("Psychrometrics").
//
// Convenções:
//   - temperatura em °C
//   - pressão em Pa
//   - umidade relativa em fração 0..1
//   - razão de mistura W em kg_água / kg_ar_seco
//   - entalpia em kJ/kg de ar seco
//   - densidade em kg/m³ (ar úmido)

import {
  CP_DRY_AIR_KJ_KG_K,
  CP_WATER_VAPOR_KJ_KG_K,
  HFG_WATER_AT_0C_KJ_KG,
  P_ATM_SEA_LEVEL_PA,
  R_DRY_AIR_J_KG_K,
  clamp,
  safeDivide,
} from "./units";

/**
 * Pressão atmosférica em função da altitude.
 * ASHRAE Eq. 3 (Cap. 1, 2017).
 */
export function calculateAtmosphericPressure(altitudeM: number): number {
  if (!Number.isFinite(altitudeM) || altitudeM <= 0) return P_ATM_SEA_LEVEL_PA;
  return 101325 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.2559);
}

/**
 * Pressão de saturação do vapor d'água sobre água líquida ou gelo.
 * ASHRAE Eq. 5 (T < 0°C, sobre gelo) e Eq. 6 (T >= 0°C, sobre água).
 * Saída em Pa.
 */
export function calculateSaturationPressure(tempC: number): number {
  const T = tempC + 273.15;
  if (!Number.isFinite(T) || T <= 0) return 0;

  let lnPws: number;
  if (tempC < 0) {
    // Sobre gelo
    const C1 = -5.6745359e3;
    const C2 = 6.3925247;
    const C3 = -9.677843e-3;
    const C4 = 6.2215701e-7;
    const C5 = 2.0747825e-9;
    const C6 = -9.484024e-13;
    const C7 = 4.1635019;
    lnPws =
      C1 / T + C2 + C3 * T + C4 * T * T + C5 * T * T * T + C6 * T * T * T * T + C7 * Math.log(T);
  } else {
    // Sobre água líquida
    const C8 = -5.8002206e3;
    const C9 = 1.3914993;
    const C10 = -4.8640239e-2;
    const C11 = 4.1764768e-5;
    const C12 = -1.4452093e-8;
    const C13 = 6.5459673;
    lnPws = C8 / T + C9 + C10 * T + C11 * T * T + C12 * T * T * T + C13 * Math.log(T);
  }
  return Math.exp(lnPws);
}

/**
 * Razão de mistura W [kg/kg ar seco].
 * ASHRAE Eq. 22.  W = 0.621945 * Pw / (P - Pw)
 * relativeHumidity em fração 0..1.
 */
export function calculateHumidityRatio(
  tempC: number,
  relativeHumidity: number,
  pressurePa: number,
): number {
  const phi = clamp(relativeHumidity, 0, 1);
  const pws = calculateSaturationPressure(tempC);
  const pw = phi * pws;
  if (pressurePa - pw <= 0) return 0;
  return 0.621945 * safeDivide(pw, pressurePa - pw);
}

/**
 * Entalpia específica do ar úmido [kJ/kg ar seco].
 * ASHRAE Eq. 32:  h = 1.006·t + W·(2501 + 1.86·t)
 */
export function calculateEnthalpy(tempC: number, humidityRatio: number): number {
  return CP_DRY_AIR_KJ_KG_K * tempC + humidityRatio * (HFG_WATER_AT_0C_KJ_KG + CP_WATER_VAPOR_KJ_KG_K * tempC);
}

/**
 * Densidade do ar úmido [kg/m³].
 * ρ = (P / (R_d · T)) · (1 + W) / (1 + 1.6078·W)
 * Saída em kg de ar úmido / m³.
 */
export function calculateAirDensity(
  tempC: number,
  humidityRatio: number,
  pressurePa: number,
): number {
  const T = tempC + 273.15;
  if (T <= 0) return 0;
  const rhoDry = pressurePa / (R_DRY_AIR_J_KG_K * T);
  return rhoDry * ((1 + humidityRatio) / (1 + 1.6078 * humidityRatio));
}

/**
 * Ponto de orvalho [°C].
 * ASHRAE Eq. 39 (válida para -60°C a 70°C).  Td = f(Pw)
 */
export function calculateDewPoint(tempC: number, relativeHumidity: number): number {
  const phi = clamp(relativeHumidity, 0, 1);
  if (phi <= 0) return Number.NEGATIVE_INFINITY;
  const pws = calculateSaturationPressure(tempC);
  const pw = phi * pws;
  if (pw <= 0) return Number.NEGATIVE_INFINITY;
  const alpha = Math.log(pw / 1000); // pw em kPa
  // Coeficientes ASHRAE Eq. 39 (Td > 0°C). Para Td < 0°C usamos Eq. 40.
  let td =
    6.54 + 14.526 * alpha + 0.7389 * alpha * alpha + 0.09486 * alpha * alpha * alpha + 0.4569 * Math.pow(pw / 1000, 0.1984);
  if (td < 0) {
    // Faixa < 0°C — Eq. 40
    td = 6.09 + 12.608 * alpha + 0.4959 * alpha * alpha;
  }
  return td;
}

/**
 * Umidade relativa em função de W e P.
 * Inverso de calculateHumidityRatio. Saída em fração 0..1.
 */
export function calculateRelativeHumidityFromHumidityRatio(
  tempC: number,
  humidityRatio: number,
  pressurePa: number,
): number {
  if (humidityRatio <= 0) return 0;
  const pw = (humidityRatio * pressurePa) / (0.621945 + humidityRatio);
  const pws = calculateSaturationPressure(tempC);
  if (pws <= 0) return 0;
  return clamp(pw / pws, 0, 1);
}
