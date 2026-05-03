import { getRefrigerantSatProps } from "../../../cn_coils/engines/refrigerant/refrigerantProperties";

export interface TwoPhasePropertiesInput {
  fluid: string;
  temperature_c: number;
}

export interface TwoPhaseProperties {
  density_liquid: number;
  density_vapor: number;
  viscosity_liquid: number;
  viscosity_vapor: number;
  conductivity_liquid: number;
  conductivity_vapor: number;
  cp_liquid: number;
  cp_vapor: number;
  prandtl_liquid: number;
  prandtl_vapor: number;
  latent_heat_j_kg: number;
  warnings: string[];
}

export function calculateTwoPhaseProperties(input: TwoPhasePropertiesInput): TwoPhaseProperties {
  const warnings: string[] = [];

  const density_liquid = 1100;
  const density_vapor = 25;
  const viscosity_liquid = 0.00025;
  const viscosity_vapor = 0.000012;
  const conductivity_liquid = 0.08;
  const conductivity_vapor = 0.014;
  const cp_liquid = 1800;
  const cp_vapor = 1500;
  const latent_heat_j_kg = 200000;

  const prandtl_liquid = (cp_liquid * viscosity_liquid) / conductivity_liquid;
  const prandtl_vapor = (cp_vapor * viscosity_vapor) / conductivity_vapor;

  warnings.push("Modelo bifásico simplificado. Propriedades reais dependem do fluido e pressão.");

  const fluid = input.fluid.toLowerCase().trim();
  if (fluid !== "refrigerant_default") {
    warnings.push(
      `Fluido "${input.fluid}" usando propriedades bifásicas default de refrigerant_default.`,
    );
  }

  return {
    density_liquid,
    density_vapor,
    viscosity_liquid,
    viscosity_vapor,
    conductivity_liquid,
    conductivity_vapor,
    cp_liquid,
    cp_vapor,
    prandtl_liquid,
    prandtl_vapor,
    latent_heat_j_kg,
    warnings,
  };
}

export async function calculateTwoPhasePropertiesReal(
  input: TwoPhasePropertiesInput,
): Promise<TwoPhaseProperties & { warnings: string[] }> {
  const satProps = await getRefrigerantSatProps(input.fluid, input.temperature_c);
  return {
    density_liquid: satProps.liquid.rho_kgm3,
    density_vapor: satProps.vapor.rho_kgm3,
    viscosity_liquid: satProps.liquid.mu_Pas,
    viscosity_vapor: satProps.vapor.mu_Pas,
    conductivity_liquid: satProps.liquid.k_WmK,
    conductivity_vapor: satProps.vapor.k_WmK,
    cp_liquid: satProps.liquid.cp_kJkgK * 1000,
    cp_vapor: satProps.vapor.cp_kJkgK * 1000,
    prandtl_liquid: satProps.liquid.Pr,
    prandtl_vapor: satProps.vapor.Pr,
    latent_heat_j_kg: satProps.h_fg_kJkg * 1000,
    warnings: satProps.warnings,
  };
}
