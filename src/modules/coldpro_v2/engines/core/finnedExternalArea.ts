/**
 * computeFinnedExternalArea
 *
 * Calcula a área externa total do trocador de calor aletado (tubo nu + aletas)
 * e a área efetiva (com η_o aplicado em A, convenção NTU-ε) ou a área total
 * (convenção LMTD, onde η_o é aplicado em h_ar via calculateOverallU).
 *
 * Convenção do Motor 2 (LMTD):
 *   Q = U_eff × A_total × LMTD
 *   onde U_eff já contém η_o em h_ar (via calculateOverallU → finEfficiency)
 *   Portanto: usar A_total aqui (NÃO A_efetiva, para não dupla-penalizar η_o).
 *
 * Convenção do Motor 1 (NTU-ε):
 *   NTU = U_base × A_efetiva / C_min
 *   onde U_base NÃO contém η_o
 *   A_efetiva = A_tubo_nu + η_fin × A_aletas
 *
 * Referências:
 *   Schmidt (1949) — raio equivalente para arranjo escalonado
 *   ASHRAE Handbook Fundamentals (2017) — Cap. 4 (Heat Transfer)
 */

export interface FinnedExternalAreaInput {
  /** Número de filas de tubos */
  rows: number;
  /** Tubos por fila */
  tubes_per_row: number;
  /** Comprimento aletado [mm] */
  length_mm: number;
  /** Diâmetro externo do tubo [mm] */
  tube_diameter_mm: number;
  /** Passo transversal dos tubos [mm] */
  tube_pitch_transverse_mm: number;
  /** Passo longitudinal dos tubos [mm] */
  tube_pitch_longitudinal_mm: number;
  /** Espaçamento entre aletas (passo de aleta) [mm] */
  fin_spacing_mm: number;
  /** Espessura da aleta [mm]. Padrão: 0.12 mm */
  fin_thickness_mm?: number;
}

export interface FinnedExternalAreaResult {
  /** Área do tubo nu (entre aletas) [m²] */
  A_tube_bare_m2: number;
  /** Área total das aletas [m²] */
  A_fin_m2: number;
  /** Área externa total (tubo nu + aletas) [m²] — usar com LMTD quando η_o está em h_ar */
  A_total_m2: number;
  /** Número de aletas */
  n_fins: number;
  /** Número total de tubos */
  n_tubes: number;
  /** Altura da face aletada [m] */
  finned_height_m: number;
  warnings: string[];
}

/**
 * Calcula a área externa total do coil aletado.
 *
 * Fórmulas:
 *   n_fins = floor(L / F_p)
 *   A_one_fin = 2 × [H × N_rows × P_l − N_tubes × π × (D_o/2)²]
 *   A_fin = A_one_fin × n_fins
 *   A_tube_bare = N_tubes × π × D_o × L × (F_p − δ_f) / F_p
 *   A_total = A_tube_bare + A_fin
 */
export function computeFinnedExternalArea(
  input: FinnedExternalAreaInput,
): FinnedExternalAreaResult {
  const warnings: string[] = [];

  const {
    rows,
    tubes_per_row,
    length_mm,
    tube_diameter_mm,
    tube_pitch_transverse_mm,
    tube_pitch_longitudinal_mm,
    fin_spacing_mm,
    fin_thickness_mm = 0.12,
  } = input;

  // Validações
  if (rows <= 0 || tubes_per_row <= 0 || length_mm <= 0 || tube_diameter_mm <= 0) {
    warnings.push("Parâmetros geométricos insuficientes para calcular área aletada.");
    return {
      A_tube_bare_m2: 0,
      A_fin_m2: 0,
      A_total_m2: 0,
      n_fins: 0,
      n_tubes: 0,
      finned_height_m: 0,
      warnings,
    };
  }

  if (fin_spacing_mm <= 0) {
    warnings.push(
      "fin_spacing_mm ausente ou zero — área de aletas não calculada. Usando apenas tubo nu.",
    );
    const A_bare_only = rows * tubes_per_row * Math.PI * (tube_diameter_mm / 1000) * (length_mm / 1000);
    return {
      A_tube_bare_m2: A_bare_only,
      A_fin_m2: 0,
      A_total_m2: A_bare_only,
      n_fins: 0,
      n_tubes: rows * tubes_per_row,
      finned_height_m: tubes_per_row * (tube_pitch_transverse_mm / 1000),
      warnings,
    };
  }

  const L = length_mm / 1000;
  const D_o = tube_diameter_mm / 1000;
  const P_t = tube_pitch_transverse_mm / 1000;
  const P_l = tube_pitch_longitudinal_mm / 1000;
  const F_p = fin_spacing_mm / 1000;
  const delta_f = fin_thickness_mm / 1000;

  const N_tubes = rows * tubes_per_row;
  const H = tubes_per_row * P_t; // altura da face aletada [m]
  const n_fins = Math.max(1, Math.floor(L / F_p));

  // Área de uma aleta (ambos os lados)
  // A_one_fin = 2 × [H × rows × P_l − N_tubes × π × (D_o/2)²]
  const A_one_fin = 2 * (H * rows * P_l - N_tubes * Math.PI * (D_o / 2) ** 2);

  if (A_one_fin <= 0) {
    warnings.push(
      `Área de aleta calculada negativa (${A_one_fin.toFixed(4)} m²/aleta). ` +
        "Verificar geometria (P_t, P_l, D_o). Usando apenas tubo nu.",
    );
    const A_bare_only = N_tubes * Math.PI * D_o * L;
    return {
      A_tube_bare_m2: A_bare_only,
      A_fin_m2: 0,
      A_total_m2: A_bare_only,
      n_fins,
      n_tubes: N_tubes,
      finned_height_m: H,
      warnings,
    };
  }

  const A_fin = A_one_fin * n_fins;

  // Área do tubo nu (porção entre aletas, excluindo a espessura da aleta)
  const A_tube_bare = N_tubes * Math.PI * D_o * L * Math.max(F_p - delta_f, 0) / F_p;

  const A_total = A_tube_bare + A_fin;

  if (A_total < 0.1 && N_tubes > 4) {
    warnings.push(
      `Área total calculada muito baixa (${A_total.toFixed(3)} m²). Verificar geometria.`,
    );
  }

  return {
    A_tube_bare_m2: A_tube_bare,
    A_fin_m2: A_fin,
    A_total_m2: A_total,
    n_fins,
    n_tubes: N_tubes,
    finned_height_m: H,
    warnings,
  };
}
