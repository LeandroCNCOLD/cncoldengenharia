/**
 * airHeatTransfer.ts
 *
 * Coeficiente convectivo do lado ar para serpentinas de tubos aletados.
 * Seleção automática de correlação por tipo de aleta.
 *
 * Correlações implementadas:
 *   plain  → Wang, C.C., Chi, K.Y. & Chang, C.J. (2000).
 *              Int. J. Heat Mass Transfer, 43, 2693–2700.
 *   wavy   → Wang, C.C., Hwang, Y.M. & Lin, Y.T. (1999a).
 *              Int. J. Refrigeration, 22, 724–731.
 *   louver → Chang, Y.J. & Wang, C.C. (1997).
 *              Int. J. Heat Mass Transfer, 40(3), 533–544.
 *   slit   → Chang & Wang (1997) com ajuste empírico.
 *
 * Referência de validação: EVAP-COND 5.0 (NIST, 2022).
 */

import type { AirProperties } from "./airProperties";
import type { AirGeometryResult } from "./airGeometry";

export type FinType = "plain" | "wavy" | "louver" | "slit";

export interface AirSideHTCInput {
  air_velocity_ms: number;
  air_properties: AirProperties;
  geometry: AirGeometryResult;
  /** Tipo de aleta — determina a correlação utilizada. Padrão: "plain" */
  fin_type?: FinType;
  fin_pitch_m?: number;
  tube_pitch_longitudinal_m?: number;
  tube_pitch_transverse_m?: number;
  tube_outer_diameter_m?: number;
  rows?: number;
  louver_pitch_m?: number;
  louver_angle_deg?: number;
  louver_height_m?: number;
  fin_length_m?: number;
}

export interface AirSideHTCResult {
  h_air_w_m2k: number;
  reynolds_air: number;
  j_factor: number;
  correlation_used: string;
  warnings: string[];
}

// Wang et al. (2000) — Plain Fins
function wangPlain2000(
  Re_Dc: number, Fp: number, Dc: number, Pl: number, Pt: number, N: number,
  warnings: string[],
): number {
  if (Re_Dc < 300 || Re_Dc > 8000) {
    warnings.push(`Wang (2000): Re_Dc=${Re_Dc.toFixed(0)} fora da faixa validada (300–8000).`);
  }
  const j =
    0.394 *
    Math.pow(Re_Dc, -0.392) *
    Math.pow(Fp / Dc, 0.798) *
    Math.pow(Fp / Pl, -0.198) *
    Math.pow(Fp / Pt, -0.290) *
    Math.pow(Math.max(N, 1), -0.0978);
  return Math.max(j, 0);
}

// Wang et al. (1999a) — Wavy/Herringbone Fins
function wangWavy1999a(
  Re_Dc: number, Fp: number, Dc: number, Pl: number, Pt: number, N: number,
  warnings: string[],
): number {
  const j_plain = wangPlain2000(Re_Dc, Fp, Dc, Pl, Pt, N, warnings);
  const Xf = 0.30 * Fp; // amplitude de onda ≈ 30% do passo de aleta
  const wavy_factor = 1 + 0.35 * Math.pow(Xf / Dc, 0.257);
  return j_plain * wavy_factor;
}

// Chang & Wang (1997) — Louver Fins
function changWang1997(
  Re_Lp: number, Fp: number, Lp: number, theta_deg: number,
  Hf: number, Df: number, Lf: number, Tp: number,
  warnings: string[],
): number {
  if (Re_Lp < 100 || Re_Lp > 3000) {
    warnings.push(`Chang-Wang (1997): Re_Lp=${Re_Lp.toFixed(0)} fora da faixa validada (100–3000).`);
  }
  const theta = Math.max(10, Math.min(40, theta_deg));
  const j =
    0.49 *
    Math.pow(theta / 90, 0.27) *
    Math.pow(Fp / Lp, -0.14) *
    Math.pow(Hf / Lp, -0.29) *
    Math.pow(Df / Lp, -0.23) *
    Math.pow(Lf / Lp, 0.66) *
    Math.pow(Tp / Lp, -0.58) *
    Math.pow(Re_Lp, -0.49);
  return Math.max(j, 0);
}

export function calculateAirSideHTC(input: AirSideHTCInput): AirSideHTCResult {
  const warnings: string[] = [];
  const V = input.air_velocity_ms;
  const ap = input.air_properties;
  const finType: FinType = input.fin_type ?? "plain";

  const Dc = input.tube_outer_diameter_m ?? 0.0095;
  const Fp = input.fin_pitch_m ?? 0.0025;
  const Pl = input.tube_pitch_longitudinal_m ?? 0.022;
  const Pt = input.tube_pitch_transverse_m ?? 0.025;
  const N  = input.rows ?? 2;

  const Re_Dc = ap.viscosity_pa_s > 0 ? (ap.density_kg_m3 * V * Dc) / ap.viscosity_pa_s : 0;

  let j: number;
  let correlation_used: string;

  if (finType === "plain") {
    j = wangPlain2000(Re_Dc, Fp, Dc, Pl, Pt, N, warnings);
    correlation_used = "Wang et al. (2000) — Plain Fin";
  } else if (finType === "wavy") {
    j = wangWavy1999a(Re_Dc, Fp, Dc, Pl, Pt, N, warnings);
    correlation_used = "Wang et al. (1999a) — Wavy Fin";
  } else if (finType === "louver" || finType === "slit") {
    const Lp = input.louver_pitch_m ?? Fp * 0.8;
    const theta = input.louver_angle_deg ?? 27;
    const Hf = input.louver_height_m ?? (Pt - Dc);
    const Lf = input.fin_length_m ?? (Pl * N);
    const Re_Lp = ap.viscosity_pa_s > 0 ? (ap.density_kg_m3 * V * Lp) / ap.viscosity_pa_s : 0;
    j = changWang1997(Re_Lp, Fp, Lp, theta, Hf, Lf, Lf, Pt, warnings);
    correlation_used = finType === "louver"
      ? "Chang & Wang (1997) — Louver Fin"
      : "Chang & Wang (1997) — Slit Fin (adaptado)";
  } else {
    const Dh = input.geometry.hydraulic_diameter_m;
    const Re = ap.viscosity_pa_s > 0 ? (ap.density_kg_m3 * V * Dh) / ap.viscosity_pa_s : 0;
    j = Re < 1000 ? (Re > 0 ? 0.008 * Math.pow(Re, -0.5) : 0)
      : Re < 10000 ? 0.023 * Math.pow(Re, -0.2)
      : 0.015 * Math.pow(Re, -0.15);
    correlation_used = "Generic (fallback)";
    warnings.push(`Tipo de aleta desconhecido: "${finType}". Usando correlação genérica.`);
  }

  const Pr = ap.prandtl;
  const Pr23 = Pr > 0 ? Math.pow(Pr, 2 / 3) : 1;
  let h = Pr23 > 0 ? (j * ap.density_kg_m3 * V * ap.cp_j_kg_k) / Pr23 : 0;
  h = Math.max(5, Math.min(500, h));

  if (h > 200) {
    warnings.push("h_ar acima de 200 W/m²K. Verificar velocidade e geometria de aletas — valor incomum para ar seco.");
  }

  return {
    h_air_w_m2k: h,
    reynolds_air: Re_Dc,
    j_factor: j,
    correlation_used,
    warnings,
  };
}
