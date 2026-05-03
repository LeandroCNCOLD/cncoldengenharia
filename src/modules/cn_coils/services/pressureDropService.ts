/**
 * Calcula perda de carga do ar usando polinômio empírico por número de filas.
 * Baseado em dados do catálogo CN Coils.
 * Fórmula: ΔP = (a0 + a1×V + a2×V²) × N_rows  [Pa]
 */
export function calcAirPressureDrop(
  V_face_m_s: number,
  N_rows: number,
  fin_pitch_mm: number
): number {
  const fp = Math.max(1.5, Math.min(8.0, fin_pitch_mm));
  const a0 =  0.8 + 0.15 * (6 - fp);
  const a1 =  6.5 + 0.8  * (6 - fp);
  const a2 =  0.9 + 0.1  * (6 - fp);
  const dp_per_row = a0 + a1 * V_face_m_s + a2 * V_face_m_s * V_face_m_s;
  return Math.max(0, dp_per_row * N_rows);
}

/**
 * Calcula perda de carga do fluido usando Darcy-Weisbach.
 * Fonte: Incropera, Fundamentals of Heat and Mass Transfer, 7ª ed., Cap. 8.
 *
 * @param L_circuit_m   Comprimento total do circuito de fluido [m]
 * @param D_i_m         Diâmetro interno do tubo [m]
 * @param G_kg_m2s      Fluxo mássico específico [kg/(m²·s)]
 * @param rho_kg_m3     Densidade do fluido [kg/m³]
 * @param mu_Pa_s       Viscosidade dinâmica [Pa·s]
 * @returns             Perda de carga [kPa]
 */
export function calcFluidPressureDrop(
  L_circuit_m: number,
  D_i_m: number,
  G_kg_m2s: number,
  rho_kg_m3: number,
  mu_Pa_s: number
): number {
  if (D_i_m <= 0 || G_kg_m2s <= 0 || rho_kg_m3 <= 0) return 0;
  const Re = (G_kg_m2s * D_i_m) / mu_Pa_s;
  const f = Re < 2300
    ? 64 / Re
    : 0.316 * Math.pow(Re, -0.25);
  const V_m_s = G_kg_m2s / rho_kg_m3;
  const dP_Pa = f * (L_circuit_m / D_i_m) * rho_kg_m3 * V_m_s * V_m_s / 2;
  return Math.max(0, dP_Pa / 1000);
}
