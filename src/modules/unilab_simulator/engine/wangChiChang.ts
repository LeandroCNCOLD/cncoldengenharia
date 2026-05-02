// Correlação Wang-Chi-Chang (2000) para aletas planas (Plain Fin).
// Calcula h_ar dinâmico, eficiência de aleta η_o e o coeficiente global U
// referenciado à área externa, em função da geometria real e da velocidade
// frontal de ar. Padrão de indústria (VapCyc / CoilDesigner).
//
// Entradas em milímetros / m³h-friendly; saídas em SI (W/m²·K).

export interface WangChiChangParams {
  /** Diâmetro externo do tubo [mm]. */
  tubeOdMm: number;
  /** Espessura da aleta [mm]. */
  finThicknessMm: number;
  /** Passo da aleta [mm]. */
  finPitchMm: number;
  /** Passo longitudinal entre filas [mm]. */
  rowPitchMm: number;
  /** Passo transversal entre tubos [mm]. */
  tubePitchMm: number;
  /** Número de filas. */
  numberOfRows: number;
  /** Velocidade frontal do ar [m/s]. */
  airFaceVelocityMs: number;
  /** Condutividade térmica da aleta [W/(m·K)] — alumínio ≈ 200. */
  finConductivityWmK?: number;
  /** Coeficiente convectivo interno de referência [W/(m²·K)]. */
  hRefInternalWm2K?: number;
  /** Razão A_externa / A_interna típica. */
  areaRatioExtToInt?: number;
  /** Razão A_aleta / A_externa_total (≈0.9 para aletadas típicas). */
  finAreaRatio?: number;
}

export interface WangChiChangResult {
  hAirWm2K: number;
  finEfficiency: number;
  surfaceEfficiency: number;
  uGlobalWm2K: number;
  reynoldsDc: number;
  jColburn: number;
  warnings: string[];
}

// Propriedades do ar — média representativa para faixa de operação típica
// de evaporadores/condensadores comerciais (-25°C a 35°C). A correção fina
// de propriedades já é capturada pelo polinômio UNILAB.
const AIR_RHO = 1.2;        // kg/m³
const AIR_MU = 1.81e-5;     // Pa·s
const AIR_CP = 1006;        // J/(kg·K)
const AIR_PR = 0.71;        // Prandtl

export function calculateWangChiChang(p: WangChiChangParams): WangChiChangResult {
  const warnings: string[] = [];

  const Do = p.tubeOdMm / 1000;
  const delta_f = p.finThicknessMm / 1000;
  const Dc = Do + 2 * delta_f;
  const Fp = p.finPitchMm / 1000;
  const Pl = p.rowPitchMm / 1000;
  const Pt = p.tubePitchMm / 1000;
  const N = Math.max(1, Math.round(p.numberOfRows));
  const v = p.airFaceVelocityMs;

  if (Do <= 0 || Fp <= 0 || Pl <= 0 || Pt <= 0 || delta_f <= 0 || v <= 0) {
    warnings.push("Wang-Chi-Chang: geometria/velocidade inválida.");
    return {
      hAirWm2K: 0,
      finEfficiency: 0,
      surfaceEfficiency: 0,
      uGlobalWm2K: 0,
      reynoldsDc: 0,
      jColburn: 0,
      warnings,
    };
  }

  // Razão de área livre (constrição entre aletas e tubos)
  const sigma = ((Fp - delta_f) * (Pt - Dc)) / (Fp * Pt);
  if (sigma <= 0 || sigma >= 1) {
    warnings.push(`Wang-Chi-Chang: σ fora de faixa (${sigma.toFixed(3)}).`);
  }
  const Vmax = v / Math.max(sigma, 1e-3);
  const Re_Dc = (AIR_RHO * Vmax * Dc) / AIR_MU;

  // Coeficientes Wang-Chi-Chang (2000) para N >= 2 filas, plain fin
  const C1 = 0.394;
  const C2 = -0.392;
  const C3 = 0.798;
  const C4 = -0.198;
  const C5 = -0.290;
  const C6 = -0.0978;

  const j =
    C1 *
    Math.pow(Re_Dc, C2) *
    Math.pow(Fp / Dc, C3) *
    Math.pow(Fp / Pl, C4) *
    Math.pow(Fp / Pt, C5) *
    Math.pow(N, C6);

  const h_ar = (j * AIR_RHO * Vmax * AIR_CP) / Math.pow(AIR_PR, 2 / 3);

  if (!Number.isFinite(h_ar) || h_ar <= 0) {
    warnings.push("Wang-Chi-Chang: h_ar inválido.");
    return {
      hAirWm2K: 0,
      finEfficiency: 0,
      surfaceEfficiency: 0,
      uGlobalWm2K: 0,
      reynoldsDc: Re_Dc,
      jColburn: j,
      warnings,
    };
  }

  // Eficiência de aleta (modelo de aleta reta equivalente)
  const k_fin = p.finConductivityWmK ?? 200;
  const Lf = Math.max((Pt - Dc) / 2, 1e-4);
  const m = Math.sqrt((2 * h_ar) / (k_fin * delta_f));
  const mLf = m * Lf;
  const eta_fin = mLf > 0 ? Math.tanh(mLf) / mLf : 1;

  const finAreaRatio = p.finAreaRatio ?? 0.9;
  const eta_o = 1 - finAreaRatio * (1 - eta_fin);

  // U global referenciado à área externa
  const h_ref = p.hRefInternalWm2K ?? 3000;
  const Ar = p.areaRatioExtToInt ?? 20;
  const uGlobal = 1 / (1 / (eta_o * h_ar) + Ar / h_ref);

  if (!Number.isFinite(uGlobal) || uGlobal <= 0) {
    warnings.push("Wang-Chi-Chang: U global inválido.");
  }

  return {
    hAirWm2K: h_ar,
    finEfficiency: eta_fin,
    surfaceEfficiency: eta_o,
    uGlobalWm2K: uGlobal,
    reynoldsDc: Re_Dc,
    jColburn: j,
    warnings,
  };
}
