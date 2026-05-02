import type { TwoPhaseProperties } from "./twoPhaseProperties";
import { calculateNusseltGnielinski } from "../core/dimensionless";
import { calculateDarcyFrictionFactor } from "../core/friction";

export interface TwoPhaseHTCInput {
  mass_flow_kgs: number;
  tube_inner_diameter_m: number;
  quality_x: number;
  two_phase_properties: TwoPhaseProperties;
  flow_regime_hint?: "evaporation" | "condensation";
}

export interface TwoPhaseHTCResult {
  h_two_phase_w_m2k: number;
  h_liquid_base: number;
  reynolds_liquid: number;
  prandtl_liquid: number;
  quality_x: number;
  warnings: string[];
}

export function calculateTwoPhaseHTC(input: TwoPhaseHTCInput): TwoPhaseHTCResult {
  const warnings: string[] = [];
  const Di = input.tube_inner_diameter_m;
  const tp = input.two_phase_properties;
  const regime = input.flow_regime_hint ?? "evaporation";

  if (Di <= 0) {
    warnings.push("Diâmetro interno inválido para cálculo bifásico.");
    return {
      h_two_phase_w_m2k: 0,
      h_liquid_base: 0,
      reynolds_liquid: 0,
      prandtl_liquid: 0,
      quality_x: 0,
      warnings,
    };
  }

  if (input.mass_flow_kgs <= 0) {
    warnings.push("Vazão mássica <= 0 para cálculo bifásico.");
    return {
      h_two_phase_w_m2k: 0,
      h_liquid_base: 0,
      reynolds_liquid: 0,
      prandtl_liquid: 0,
      quality_x: 0,
      warnings,
    };
  }

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

  const Re_l = (G * Di) / tp.viscosity_liquid;
  const Pr_l = tp.prandtl_liquid;

  const f_l = calculateDarcyFrictionFactor({
    reynolds: Re_l,
    roughness_m: 0.0000015,
    hydraulicDiameter_m: Di,
  });

  const nuResult = calculateNusseltGnielinski({
    reynolds: Re_l,
    prandtl: Pr_l,
    frictionFactor: f_l,
  });

  const h_l = (nuResult.nusselt * tp.conductivity_liquid) / Di;

  let h_tp: number;
  if (regime === "evaporation") {
    h_tp = h_l * (1 + 3 * Math.pow(quality_x, 0.8));
  } else {
    h_tp = h_l * (1 + 2 * Math.pow(1 - quality_x, 0.8));
  }

  h_tp = Math.max(h_tp, h_l);
  h_tp = Math.min(h_tp, 20 * h_l);

  return {
    h_two_phase_w_m2k: h_tp,
    h_liquid_base: h_l,
    reynolds_liquid: Re_l,
    prandtl_liquid: Pr_l,
    quality_x,
    warnings,
  };
}
