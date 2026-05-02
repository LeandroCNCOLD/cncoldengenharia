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
