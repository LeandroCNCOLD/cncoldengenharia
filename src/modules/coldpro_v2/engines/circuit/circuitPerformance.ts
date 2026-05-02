import type { CircuitPerformanceResult } from "../../domain/types";
import type { FluidProperties } from "../fluidSide/fluidProperties";
import { calculateInternalFluidHTC } from "../fluidSide/fluidHeatTransfer";
import { calculateInternalFluidPressureDrop } from "../fluidSide/fluidPressureDrop";

export interface CircuitPerformanceInput {
  circuit_index: number;
  mass_flow_kgs: number;
  tube_inner_diameter_m: number;
  tube_length_m: number;
  fluid_properties: FluidProperties;
  roughness_m?: number;
}

export function calculateCircuitPerformance(
  input: CircuitPerformanceInput,
): CircuitPerformanceResult {
  const htcResult = calculateInternalFluidHTC({
    mass_flow_kgs: input.mass_flow_kgs,
    circuits: 1,
    tube_inner_diameter_m: input.tube_inner_diameter_m,
    fluid_properties: input.fluid_properties,
    tube_length_m: input.tube_length_m,
    roughness_m: input.roughness_m ?? 0.0000015,
  });

  const dpResult = calculateInternalFluidPressureDrop({
    friction_factor: htcResult.friction_factor,
    tube_length_m: input.tube_length_m,
    tube_inner_diameter_m: input.tube_inner_diameter_m,
    density_kg_m3: input.fluid_properties.density_kg_m3,
    velocity_m_s: htcResult.velocity_m_s,
  });

  return {
    circuit_index: input.circuit_index,
    mass_flow_kgs: input.mass_flow_kgs,
    velocity_m_s: htcResult.velocity_m_s,
    reynolds: htcResult.reynolds,
    prandtl: htcResult.prandtl,
    nusselt: htcResult.nusselt,
    h_w_m2k: htcResult.h_w_m2k,
    friction_factor: htcResult.friction_factor,
    flow_regime: htcResult.flow_regime,
    pressure_drop_pa: dpResult.pressure_drop_pa,
    pressure_drop_kpa: dpResult.pressure_drop_kpa,
    warnings: [...htcResult.warnings, ...dpResult.warnings],
  };
}
