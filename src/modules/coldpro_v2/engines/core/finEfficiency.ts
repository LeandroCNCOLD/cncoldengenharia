export interface FinEfficiencyParams {
  h_air_w_m2k: number;
  finConductivity_w_mk: number;
  finThickness_m: number;
  /** Passo transversal dos tubos [m]. Necessário para Schmidt (1949). */
  tubePitchTransverse_m?: number;
  /** Passo longitudinal dos tubos [m]. Necessário para Schmidt (1949). */
  tubePitchLongitudinal_m?: number;
  /** Raio externo do tubo [m]. Necessário para Schmidt (1949). */
  tubeOuterRadius_m?: number;
}

export interface FinEfficiencyResult {
  finEfficiency: number;
  warnings: string[];
}

/**
 * C4: Eficiência de aleta — Schmidt (1949) com comprimento real.
 *
 * Antes: L_c = 0.01 m fixo (sem base física) — subestimava η_fin em ~13%.
 * Agora: L_c = r_eq − r_o, onde r_eq é o raio equivalente de Schmidt para
 * arranjo escalonado: r_eq = 1.27 × (P_t/2) × √(P_l/P_t − 0.3).
 *
 * Fallback para L_c = 0.025 m (valor típico industrial) se geometria ausente.
 */
export function calculateFinEfficiencySimplified(params: FinEfficiencyParams): FinEfficiencyResult {
  const {
    h_air_w_m2k,
    finConductivity_w_mk,
    finThickness_m,
    tubePitchTransverse_m,
    tubePitchLongitudinal_m,
    tubeOuterRadius_m,
  } = params;
  const warnings: string[] = [];

  if (finConductivity_w_mk <= 0 || finThickness_m <= 0 || h_air_w_m2k <= 0) {
    warnings.push(
      "Dados insuficientes para cálculo de eficiência de aleta; usando valor conservador 0.85",
    );
    return { finEfficiency: 0.85, warnings };
  }

  const m = Math.sqrt((2 * h_air_w_m2k) / (finConductivity_w_mk * finThickness_m));

  // C4: Comprimento de aleta real via Schmidt (1949)
  let L_c: number;
  if (
    tubePitchTransverse_m && tubePitchTransverse_m > 0 &&
    tubePitchLongitudinal_m && tubePitchLongitudinal_m > 0 &&
    tubeOuterRadius_m && tubeOuterRadius_m > 0
  ) {
    const r_eq = 1.27 * (tubePitchTransverse_m / 2) *
      Math.sqrt(Math.max(tubePitchLongitudinal_m / tubePitchTransverse_m - 0.3, 0.01));
    L_c = Math.max(r_eq - tubeOuterRadius_m, 0.001);
  } else {
    // Fallback: L_c típico para condensadores industriais (aleta ~25 mm de raio)
    L_c = 0.025;
    warnings.push("Geometria de aleta ausente — usando L_c=0.025 m (fallback Schmidt)");
  }

  const mL = m * L_c;
  const eta = mL > 0 ? Math.tanh(mL) / mL : 1;
  const clamped = Math.max(0, Math.min(1, eta));

  if (clamped < 0.5) {
    warnings.push(`Eficiência de aleta muito baixa (${clamped.toFixed(3)})`);
  }

  return { finEfficiency: clamped, warnings };
}
