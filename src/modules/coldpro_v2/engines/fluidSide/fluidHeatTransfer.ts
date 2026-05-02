import type { FluidProperties } from "./fluidProperties";
import { calculateDarcyFrictionFactor } from "../core/friction";
import {
  calculateReynolds,
  calculateNusseltGnielinski,
  calculateConvectiveCoefficient,
} from "../core/dimensionless";

export interface FluidHTCInput {
  mass_flow_kgs: number;
  circuits: number | null;
  tube_inner_diameter_m: number;
  fluid_properties: FluidProperties;
  tube_length_m?: number;
  roughness_m?: number;
}

export type FlowRegime = "laminar" | "transitional" | "turbulent";

export interface FluidSideHTCResult {
  h_w_m2k: number;
  reynolds: number;
  prandtl: number;
  nusselt: number;
  velocity_m_s: number;
  friction_factor: number;
  flow_regime: FlowRegime;
  warnings: string[];
}

export function calculateInternalFluidHTC(input: FluidHTCInput): FluidSideHTCResult {
  const warnings: string[] = [];

  let circuits = input.circuits ?? 0;
  if (circuits <= 0) {
    circuits = 1;
    warnings.push("circuits não informado. Usando default = 1 circuito.");
  }

  const Di = input.tube_inner_diameter_m;
  const roughness = input.roughness_m ?? 0.0000015;
  const fp = input.fluid_properties;

  const massFlowPerCircuit = input.mass_flow_kgs / circuits;
  const area = (Math.PI * Di * Di) / 4;
  const velocity = area > 0 ? massFlowPerCircuit / (fp.density_kg_m3 * area) : 0;

  const Re = calculateReynolds({
    density_kg_m3: fp.density_kg_m3,
    velocity_m_s: velocity,
    hydraulicDiameter_m: Di,
    viscosity_pa_s: fp.viscosity_pa_s,
  });

  const Pr = fp.prandtl;

  const frictionFactor = calculateDarcyFrictionFactor({
    reynolds: Re,
    roughness_m: roughness,
    hydraulicDiameter_m: Di,
  });

  const nuResult = calculateNusseltGnielinski({
    reynolds: Re,
    prandtl: Pr,
    frictionFactor,
  });
  warnings.push(...nuResult.warnings);

  const h = calculateConvectiveCoefficient({
    nusselt: nuResult.nusselt,
    conductivity_w_m_k: fp.conductivity_w_m_k,
    hydraulicDiameter_m: Di,
  });

  let flow_regime: FlowRegime;
  if (Re < 2300) {
    flow_regime = "laminar";
  } else if (Re < 4000) {
    flow_regime = "transitional";
  } else {
    flow_regime = "turbulent";
  }

  return {
    h_w_m2k: h,
    reynolds: Re,
    prandtl: Pr,
    nusselt: nuResult.nusselt,
    velocity_m_s: velocity,
    friction_factor: frictionFactor,
    flow_regime,
    warnings,
  };
}
