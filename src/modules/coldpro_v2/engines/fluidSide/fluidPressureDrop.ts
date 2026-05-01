import { calculateDarcyWeisbachPressureDrop } from "../core/pressureDrop";

export interface FluidPressureDropInput {
  friction_factor: number;
  tube_length_m: number;
  tube_inner_diameter_m: number;
  density_kg_m3: number;
  velocity_m_s: number;
}

export interface FluidPressureDropResult {
  pressure_drop_pa: number;
  pressure_drop_kpa: number;
  warnings: string[];
}

export function calculateInternalFluidPressureDrop(
  input: FluidPressureDropInput,
): FluidPressureDropResult {
  const warnings: string[] = [];

  const pressure_drop_pa = calculateDarcyWeisbachPressureDrop({
    frictionFactor: input.friction_factor,
    length_m: input.tube_length_m,
    hydraulicDiameter_m: input.tube_inner_diameter_m,
    density_kg_m3: input.density_kg_m3,
    velocity_m_s: input.velocity_m_s,
  });

  return {
    pressure_drop_pa,
    pressure_drop_kpa: pressure_drop_pa / 1000,
    warnings,
  };
}
