export function saturationPressure(T_c: number): number {
  return 610.78 * Math.exp((17.27 * T_c) / (T_c + 237.3));
}

export function humidityRatio(
  T_c: number,
  RH: number,
  P_atm = 101325,
): { W: number; warnings: string[] } {
  const warnings: string[] = [];

  let rh = RH;
  if (rh > 1.0) {
    rh = rh / 100.0;
    warnings.push("RH fornecido como porcentagem. Convertido para fração decimal.");
  }

  rh = Math.max(0.0, Math.min(1.0, rh));

  const P_ws = saturationPressure(T_c);
  const denom = P_atm - rh * P_ws;
  const W = denom > 0 ? (0.62198 * (rh * P_ws)) / denom : 0;

  return { W, warnings };
}

export function enthalpyMoistAir(T_c: number, W: number): number {
  return 1.006 * T_c + W * (2501 + 1.86 * T_c);
}

export function dewPoint(T_c: number, RH: number): { T_dp: number; warnings: string[] } {
  const warnings: string[] = [];

  const RH_safe = Math.max(0.001, Math.min(1.0, RH));

  if (RH_safe <= 0.001) {
    warnings.push("RH muito baixo. Ponto de orvalho pode ser impreciso.");
  }

  const gamma = Math.log(RH_safe) + (17.27 * T_c) / (237.3 + T_c);
  const T_dp = (237.3 * gamma) / (17.27 - gamma);

  return { T_dp, warnings };
}

export function cpMoistAir(W: number): number {
  return 1.006 + 1.86 * W;
}
