export interface AirProperties {
  density_kg_m3: number;
  cp_j_kg_k: number;
  viscosity_pa_s: number;
  conductivity_w_m_k: number;
  prandtl: number;
}

export function calculateAirProperties(temperature_c: number): AirProperties {
  const T = temperature_c;

  const density_kg_m3 = 1.225 - 0.00365 * T + 0.0000125 * T * T;
  const cp_j_kg_k = 1005 + 0.15 * T - 0.0001 * T * T;
  const viscosity_pa_s = 1.716e-5 + 4.9e-8 * T;
  const conductivity_w_m_k = 0.0242 + 0.0000756 * T;
  const prandtl = (cp_j_kg_k * viscosity_pa_s) / conductivity_w_m_k;

  return {
    density_kg_m3,
    cp_j_kg_k,
    viscosity_pa_s,
    conductivity_w_m_k,
    prandtl,
  };
}
