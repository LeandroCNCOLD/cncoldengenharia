import { describe, expect, it } from "vitest";
import { generateProductPerformanceCurve } from "../engines/performance/productPerformanceCurveEngine";
import type { ProgressiveCoilInput, SystemComponentsInput } from "../domain/types";

const BASE_EVAP_INPUT: ProgressiveCoilInput = {
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
};

const BASE_SYSTEM: SystemComponentsInput = {
  compressor: {
    cooling_capacity_w: 5000,
    power_w: 1800,
    refrigerant: "R404A",
    evap_temp_c: -8,
    cond_temp_c: 35,
  },
  evaporator: { progressive_input: BASE_EVAP_INPUT },
  condenser: {
    heat_rejection_capacity_w: 7500,
    max_cond_temp_c: 50,
  },
  system_conditions: {
    ambient_temp_c: 32,
    required_airflow_m3_h: 4000,
  },
};

describe("Product Performance Curve Engine", () => {
  it("generates a basic curve with three operating points", () => {
    const result = generateProductPerformanceCurve({
      system: BASE_SYSTEM,
      operating_points: [
        { evap_temp_c: -10, cond_temp_c: 35 },
        { evap_temp_c: -8, cond_temp_c: 35 },
        { evap_temp_c: -5, cond_temp_c: 35 },
      ],
    });

    expect(result.points).toHaveLength(3);
    expect(result.summary.total_points).toBe(3);
    expect(result.summary.executed_points).toBe(3);
    expect(result.points.every((point) => point.capacity_w > 0)).toBe(true);
    expect(result.points.every((point) => point.cop > 0)).toBe(true);
    expect(result.envelope.max_capacity_w).toBeGreaterThanOrEqual(result.envelope.min_capacity_w);
    expect(["warning", "error"]).toContain(result.status);
    expect(BASE_SYSTEM.compressor.evap_temp_c).toBe(-8);
    expect(BASE_SYSTEM.compressor.cond_temp_c).toBe(35);
    expect(BASE_SYSTEM.evaporator.progressive_input.T_evaporating_c).toBe(-8);
  });

  it("varies capacity with evaporating temperature", () => {
    const result = generateProductPerformanceCurve({
      system: BASE_SYSTEM,
      operating_points: [
        { evap_temp_c: -15, cond_temp_c: 35 },
        { evap_temp_c: -8, cond_temp_c: 35 },
        { evap_temp_c: -2, cond_temp_c: 35 },
      ],
    });

    expect(result.points[0].capacity_w).toBeGreaterThan(0);
    expect(result.points[1].capacity_w).toBeGreaterThan(0);
    expect(result.points[2].capacity_w).toBeGreaterThan(0);
    expect(result.envelope.max_capacity_w).toBeGreaterThan(result.envelope.min_capacity_w);
  });

  it("flags an extreme rejected operating point", () => {
    const result = generateProductPerformanceCurve({
      system: {
        ...BASE_SYSTEM,
        condenser: {
          heat_rejection_capacity_w: 1000,
          max_cond_temp_c: 50,
        },
      },
      operating_points: [
        { evap_temp_c: -8, cond_temp_c: 35 },
        { evap_temp_c: -8, cond_temp_c: 55 },
      ],
    });

    expect(result.summary.rejected_points).toBeGreaterThanOrEqual(1);
    expect(
      result.points.some((point) => point.status === "rejected" || point.status === "warning"),
    ).toBe(true);
    expect(["warning", "error"]).toContain(result.status);
  });

  it("calculates the performance envelope from valid capacity points", () => {
    const result = generateProductPerformanceCurve({
      system: BASE_SYSTEM,
      operating_points: [
        { evap_temp_c: -12, cond_temp_c: 30 },
        { evap_temp_c: -8, cond_temp_c: 35 },
        { evap_temp_c: -4, cond_temp_c: 40 },
      ],
    });

    expect(result.envelope.max_capacity_w).toBeGreaterThanOrEqual(result.envelope.min_capacity_w);
    expect(result.envelope.max_cop).toBeGreaterThanOrEqual(result.envelope.min_cop);
    expect(result.envelope.min_capacity_w).toBeGreaterThan(0);
    expect(result.envelope.min_cop).toBeGreaterThan(0);
  });

  it("stops the loop on the first rejection when configured", () => {
    const result = generateProductPerformanceCurve({
      system: {
        ...BASE_SYSTEM,
        condenser: {
          heat_rejection_capacity_w: 500,
          max_cond_temp_c: 50,
        },
      },
      operating_points: [
        { evap_temp_c: -8, cond_temp_c: 35 },
        { evap_temp_c: -8, cond_temp_c: 35 },
        { evap_temp_c: -8, cond_temp_c: 35 },
      ],
      options: { stop_on_rejection: true },
    });

    expect(result.summary.executed_points).toBe(1);
    expect(result.summary.total_points).toBe(3);
    expect(result.points).toHaveLength(1);
    expect(["rejected", "warning"]).toContain(result.points[0].status);
  });
});
