import { describe, expect, it } from "vitest";
import type { SystemComponentsInput, VariableControlInput } from "../domain/types";
import { simulateVariableSystemControl } from "../engines/control/variableSystemControlEngine";

const BASE_SYSTEM: SystemComponentsInput = {
  compressor: {
    cooling_capacity_w: 5000,
    power_w: 1800,
    refrigerant: "R404A",
    evap_temp_c: -8,
    cond_temp_c: 35,
  },
  evaporator: {
    progressive_input: {
      tube_outer_diameter_mm: 12,
      tube_inner_diameter_mm: 10,
      tube_pitch_transverse_mm: 30,
      tube_pitch_longitudinal_mm: 26,
      fin_height_mm: 600,
      fin_thickness_mm: 0.1,
      coil_width_m: 0.8,
      coil_height_m: 0.6,
      tube_material: "copper",
      fin_material: "aluminum",
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
      air_temperature_in_c: 5,
      air_relative_humidity_in: 0.85,
      air_mass_flow_kg_s: 1.5,
      T_evaporating_c: -8,
    },
  },
  condenser: {
    heat_rejection_capacity_w: 7500,
    max_cond_temp_c: 50,
  },
  system_conditions: {
    ambient_temp_c: 32,
    required_airflow_m3_h: 4000,
  },
};

const BASE_CONTROL: VariableControlInput["control"] = {
  compressor: { mode: "inverter", min_capacity_pct: 20 },
  condenser_fan: { mode: "variable", base_airflow_m3_h: 5000 },
  evaporator_fan: { mode: "variable", base_airflow_m3_h: 4000 },
  expansion_valve: { mode: "electronic" },
};

const BASE_TARGETS: VariableControlInput["targets"] = {
  room_temp_c: 2,
  evap_approach_k: 10,
  cond_approach_k: 8,
  superheat_k: 5,
};

describe("Variable System Control Engine", () => {
  it("stabilizes inverter control within range", () => {
    const result = simulateVariableSystemControl({
      base_system: BASE_SYSTEM,
      required_capacity_w: 3500,
      control: BASE_CONTROL,
      targets: BASE_TARGETS,
      limits: { max_iterations: 20, tolerance_pct: 5 },
    });

    expect(result.status).toBe("stable");
    expect(result.capacity_error_pct).toBeLessThanOrEqual(5);
    expect(result.delivered_capacity_w).toBeGreaterThan(0);
    expect(result.compressor_speed_pct).toBeGreaterThanOrEqual(20);
    expect(result.compressor_speed_pct).toBeLessThanOrEqual(100);
    expect(result.cop_system).toBeGreaterThan(0);
    expect(result.iterations).toBeGreaterThanOrEqual(1);
  });

  it("reports unreachable load above maximum capacity", () => {
    const result = simulateVariableSystemControl({
      base_system: BASE_SYSTEM,
      required_capacity_w: 15000,
      control: BASE_CONTROL,
      targets: BASE_TARGETS,
      limits: { max_iterations: 10, tolerance_pct: 5 },
    });

    expect(result.status).toBe("unreachable");
    expect(result.delivered_capacity_w).toBeLessThan(15000);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("runs fixed compressor mode", () => {
    const result = simulateVariableSystemControl({
      base_system: BASE_SYSTEM,
      required_capacity_w: 4000,
      control: {
        ...BASE_CONTROL,
        compressor: { mode: "fixed" },
      },
      targets: BASE_TARGETS,
    });

    expect(result.compressor_speed_pct).toBe(100);
    expect(result.delivered_capacity_w).toBeGreaterThan(0);
    expect(result.iterations).toBeGreaterThanOrEqual(1);
  });

  it("runs staged compressor mode", () => {
    const result = simulateVariableSystemControl({
      base_system: BASE_SYSTEM,
      required_capacity_w: 2000,
      control: {
        ...BASE_CONTROL,
        compressor: { mode: "staged", stages: [25, 50, 75, 100] },
      },
      targets: BASE_TARGETS,
    });

    expect([25, 50, 75, 100]).toContain(result.compressor_speed_pct);
    expect(result.delivered_capacity_w).toBeGreaterThan(0);
  });

  it("rejects invalid required capacity", () => {
    const result = simulateVariableSystemControl({
      base_system: BASE_SYSTEM,
      required_capacity_w: 0,
      control: BASE_CONTROL,
      targets: BASE_TARGETS,
    });

    expect(result.status).toBe("error");
    expect(result.iterations).toBe(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });
});
