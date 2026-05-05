/**
 * twoPhaseHeatTransfer.ts
 *
 * Coeficientes convectivos para escoamento bifásico interno em tubos.
 *
 * Correlações implementadas:
 *   Condensação  → Shah (1979)          — padrão EVAP-COND / ASHRAE
 *   Ebulição     → Jung & Didion (1989) + Cooper (1984) para ebulição nucleada
 *
 * Referências:
 *   Shah, M.M. (1979). "A general correlation for heat transfer during film
 *     condensation inside pipes." Int. J. Heat Mass Transfer, 22, 547–556.
 *   Jung, D.S. & Didion, D.A. (1989). "Horizontal flow boiling heat transfer
 *     experiments with a mixture of R22/R114." NIST Internal Report 89-4069.
 *   Cooper, M.G. (1984). "Saturated nucleate pool boiling — a simple
 *     correlation." Int. Chem. Eng. Symp. Ser., 86, 785–792.
 *   Gnielinski, V. (2013). "On heat transfer in tubes."
 *     Int. J. Heat Mass Transfer, 63, 134–140.
 */

import type { TwoPhaseProperties } from "./twoPhaseProperties";
import { calculateNusseltGnielinski } from "../core/dimensionless";
import { calculateDarcyFrictionFactor } from "../core/friction";

export interface TwoPhaseHTCInput {
  mass_flow_kgs: number;
  tube_inner_diameter_m: number;
  quality_x: number;
  two_phase_properties: TwoPhaseProperties;
  flow_regime_hint?: "evaporation" | "condensation";
  /** Fluxo de calor estimado [W/m²] — melhora precisão de Jung & Didion.
   *  Se omitido, usa estimativa interna baseada em G e h_fg. */
  heat_flux_w_m2?: number;
}

export interface TwoPhaseHTCResult {
  h_two_phase_w_m2k: number;
  h_liquid_base: number;
  reynolds_liquid: number;
  prandtl_liquid: number;
  quality_x: number;
  /** Nome da correlação utilizada */
  correlation_used: string;
  warnings: string[];
}

// ─── Helper: h_líquido base (Gnielinski) ─────────────────────────────────────
function calcHLiquid(
  G: number,
  Di: number,
  tp: TwoPhaseProperties,
): { h_l: number; Re_l: number; Pr_l: number } {
  const Re_l = (G * Di) / tp.viscosity_liquid;
  const Pr_l = tp.prandtl_liquid;
  const f_l = calculateDarcyFrictionFactor({
    reynolds: Re_l,
    roughness_m: 1.5e-6,
    hydraulicDiameter_m: Di,
  });
  const nuResult = calculateNusseltGnielinski({
    reynolds: Re_l,
    prandtl: Pr_l,
    frictionFactor: f_l,
  });
  const h_l = (nuResult.nusselt * tp.conductivity_liquid) / Di;
  return { h_l, Re_l, Pr_l };
}

// ─── Shah (1979) — Condensação ────────────────────────────────────────────────
// h_cond = h_l × [(1−x)^0.8 + (3.8 × x^0.76 × (1−x)^0.04) / pr^0.38]
function shahCondensation(
  h_l: number,
  x: number,
  pr: number,
  warnings: string[],
): number {
  if (pr <= 0 || pr >= 1) {
    warnings.push(
      `Shah (1979): pr=${pr.toFixed(3)} fora de faixa (0,1). Usando correlação simplificada.`,
    );
    return h_l * (1 + 2 * Math.pow(1 - x, 0.8));
  }
  if (pr > 0.9) {
    warnings.push(
      `Shah (1979): pr=${pr.toFixed(3)} > 0.9 — próximo do ponto crítico, precisão reduzida.`,
    );
  }
  const term1 = Math.pow(1 - x, 0.8);
  const term2 =
    (3.8 * Math.pow(x, 0.76) * Math.pow(1 - x, 0.04)) / Math.pow(pr, 0.38);
  return h_l * (term1 + term2);
}

// ─── Jung & Didion (1989) + Cooper (1984) — Ebulição ─────────────────────────
// h_boil = S × h_nb + F × h_l
function jungDidionBoiling(
  h_l: number,
  Re_l: number,
  Pr_l: number,
  x: number,
  tp: TwoPhaseProperties,
  q_flux: number,
  warnings: string[],
): number {
  const pr = tp.pressure_reduced ?? 0.3;
  const M = tp.molar_mass_kg_kmol ?? 86.0;

  if (pr <= 0 || pr >= 1) {
    warnings.push(
      `Jung & Didion (1989): pr inválido (${pr.toFixed(3)}). Usando correlação simplificada.`,
    );
    return h_l * (1 + 3 * Math.pow(x, 0.8));
  }

  // Cooper (1984) — ebulição nucleada de referência
  const log_pr = Math.log10(pr);
  const h_nb =
    55 *
    Math.pow(pr, 0.12) *
    Math.pow(-log_pr, -0.55) *
    Math.pow(M, -0.5) *
    Math.pow(Math.max(q_flux, 100), 0.67);

  // Fator de supressão S (Jung & Didion)
  const S = 1 / (1 + 2.53e-6 * Math.pow(Re_l, 1.17));

  // Fator de convecção forçada F
  const rho_ratio = tp.density_liquid / tp.density_vapor;
  const F = Math.pow(1 + x * Pr_l * (rho_ratio - 1), 0.35);

  const h_tp = S * h_nb + F * h_l;

  if (!Number.isFinite(h_tp) || h_tp <= 0) {
    warnings.push("Jung & Didion (1989): resultado inválido. Usando correlação simplificada.");
    return h_l * (1 + 3 * Math.pow(x, 0.8));
  }
  return h_tp;
}

// ─── Função principal ─────────────────────────────────────────────────────────
export function calculateTwoPhaseHTC(input: TwoPhaseHTCInput): TwoPhaseHTCResult {
  const warnings: string[] = [];
  const Di = input.tube_inner_diameter_m;
  const tp = input.two_phase_properties;
  const regime = input.flow_regime_hint ?? "evaporation";

  const emptyResult = (msg: string): TwoPhaseHTCResult => {
    warnings.push(msg);
    return {
      h_two_phase_w_m2k: 0,
      h_liquid_base: 0,
      reynolds_liquid: 0,
      prandtl_liquid: 0,
      quality_x: 0,
      correlation_used: "none",
      warnings,
    };
  };

  if (Di <= 0) return emptyResult("Diâmetro interno inválido para cálculo bifásico.");
  if (input.mass_flow_kgs <= 0) return emptyResult("Vazão mássica <= 0 para cálculo bifásico.");

  let quality_x = input.quality_x;
  if (quality_x > 0.95) {
    warnings.push(
      "quality_x limitado a 0.95. Acima deste valor o modelo bifásico não é fisicamente válido.",
    );
    quality_x = 0.95;
  }
  if (quality_x > 0.9) {
    warnings.push(
      "Qualidade próxima de 1.0. Modelo bifásico pode superestimar h_tp. Considerar transição para monofásico vapor.",
    );
  }
  quality_x = Math.max(0, Math.min(0.95, quality_x));

  const area = (Math.PI * Di * Di) / 4;
  const G = input.mass_flow_kgs / area;
  const { h_l, Re_l, Pr_l } = calcHLiquid(G, Di, tp);

  let h_tp: number;
  let correlation_used: string;

  if (regime === "condensation") {
    const pr = tp.pressure_reduced ?? 0;
    if (pr > 0) {
      h_tp = shahCondensation(h_l, quality_x, pr, warnings);
      correlation_used = "Shah (1979)";
    } else {
      // Fallback se pressure_reduced não disponível
      h_tp = h_l * (1 + 2 * Math.pow(1 - quality_x, 0.8));
      correlation_used = "Simplified condensation (sem pressure_reduced)";
      warnings.push(
        "Shah (1979) requer pressure_reduced em TwoPhaseProperties. " +
          "Use calculateTwoPhasePropertiesReal() para precisão total.",
      );
    }
  } else {
    const hasPressureData = (tp.pressure_reduced ?? 0) > 0;
    const hasMolarMass = (tp.molar_mass_kg_kmol ?? 0) > 0;
    const h_fg = tp.latent_heat_j_kg;
    const q_flux = input.heat_flux_w_m2 ?? Math.max(G * h_fg * 0.05, 5000);

    if (hasPressureData && hasMolarMass) {
      h_tp = jungDidionBoiling(h_l, Re_l, Pr_l, quality_x, tp, q_flux, warnings);
      correlation_used = "Jung & Didion (1989) + Cooper (1984)";
    } else {
      h_tp = h_l * (1 + 3 * Math.pow(quality_x, 0.8));
      correlation_used = "Simplified evaporation (fallback)";
      warnings.push(
        "Jung & Didion (1989) requer pressure_reduced e molar_mass_kg_kmol. " +
          "Use calculateTwoPhasePropertiesReal() para precisão total.",
      );
    }
  }

  h_tp = Math.max(h_tp, h_l);
  h_tp = Math.min(h_tp, 30 * h_l);

  if (!Number.isFinite(h_tp) || h_tp <= 0) {
    warnings.push("h_tp inválido após cálculo. Usando h_l como fallback.");
    h_tp = h_l;
    correlation_used = "h_l fallback";
  }

  return {
    h_two_phase_w_m2k: h_tp,
    h_liquid_base: h_l,
    reynolds_liquid: Re_l,
    prandtl_liquid: Pr_l,
    quality_x,
    correlation_used,
    warnings,
  };
}
