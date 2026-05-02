export interface OverallUParams {
  airSideH_w_m2k: number;
  fluidSideH_w_m2k: number;
  wallResistance_m2k_w?: number;
  foulingAir_m2k_w?: number;
  foulingFluid_m2k_w?: number;
  finEfficiency?: number;
}

export function calculateOverallU(params: OverallUParams): number {
  const finEff = params.finEfficiency ?? 1;
  const wallR = params.wallResistance_m2k_w ?? 0;
  const foulAir = params.foulingAir_m2k_w ?? 0;
  const foulFluid = params.foulingFluid_m2k_w ?? 0;

  const hAirEff = finEff * params.airSideH_w_m2k;
  if (hAirEff <= 0 || params.fluidSideH_w_m2k <= 0) return 0;

  const totalResistance = 1 / hAirEff + foulAir + wallR + foulFluid + 1 / params.fluidSideH_w_m2k;

  if (totalResistance <= 0) return 0;

  return 1 / totalResistance;
}
