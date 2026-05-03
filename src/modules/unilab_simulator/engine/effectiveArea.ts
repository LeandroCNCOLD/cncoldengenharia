export interface CoilAreaInput {
  N_rows: number;
  N_tubes_per_row: number;
  L_tube_m: number;
  D_o_m: number;
  P_t_m: number;
  P_l_m: number;
  F_p_m: number;
  delta_f_m: number;
}

export interface CoilAreaResult {
  A_fin_m2: number;
  A_tube_bare_m2: number;
  A_total_m2: number;
  A_internal_m2: number;
  N_tubes_total: number;
  surface_ratio: number;
}

export function calcCoilEffectiveArea(input: CoilAreaInput): CoilAreaResult {
  const { N_rows, N_tubes_per_row, L_tube_m, D_o_m, P_t_m, P_l_m, F_p_m, delta_f_m } = input;
  const N_tubes_total = N_rows * N_tubes_per_row;
  const N_fins_per_tube = Math.floor(L_tube_m / F_p_m);
  const N_fins_total = N_fins_per_tube * N_tubes_per_row;
  const A_one_fin_m2 = 2 * (P_t_m * N_rows * P_l_m - N_rows * Math.PI * D_o_m * D_o_m / 4);
  const A_fin_m2 = N_fins_total * A_one_fin_m2;
  const L_exposed = L_tube_m - N_fins_per_tube * delta_f_m;
  const A_tube_bare_m2 = N_tubes_total * Math.PI * D_o_m * L_exposed;
  const A_total_m2 = A_fin_m2 + A_tube_bare_m2;
  const D_i_m = D_o_m - 2 * 0.0003;
  const A_internal_m2 = N_tubes_total * Math.PI * D_i_m * L_tube_m;
  const surface_ratio = A_total_m2 / (A_internal_m2 > 0 ? A_internal_m2 : 1);
  return { A_fin_m2, A_tube_bare_m2, A_total_m2, A_internal_m2, N_tubes_total, surface_ratio };
}

// Eficiência da aleta — Schmidt 1949
export function calcFinEfficiency(
  h_air: number,
  k_fin: number,
  delta_f: number,
  r_o: number,
  P_t: number,
  P_l: number
): number {
  const r_eq = 1.27 * (P_t / 2) * Math.sqrt(P_l / P_t - 0.3);
  const m = Math.sqrt((2 * h_air) / (k_fin * delta_f));
  const L_c = (r_eq - r_o) * (1 + 0.35 * Math.log(r_eq / r_o));
  const mLc = m * L_c;
  if (mLc < 1e-6) return 1.0;
  return Math.max(0.5, Math.min(1.0, Math.tanh(mLc) / mLc));
}

export function calcEffectiveArea(areas: CoilAreaResult, eta_fin: number): number {
  return areas.A_tube_bare_m2 + eta_fin * areas.A_fin_m2;
}
