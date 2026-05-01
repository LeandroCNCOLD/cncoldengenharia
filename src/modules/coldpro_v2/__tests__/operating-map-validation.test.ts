import { describe, expect, it } from "vitest";
import type {
  OperatingMapGridConfig,
  ProgressiveCoilInput,
  SystemComponentsInput,
} from "../domain/types";
import { generateOperatingMap } from "../engines/map/operatingMapEngine";

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

const VALIDATED_SYSTEM: SystemComponentsInput = {
  ...BASE_SYSTEM,
  compressor: {
    ...BASE_SYSTEM.compressor,
    cooling_capacity_w: 100000,
    power_w: 80000,
  },
  condenser: {
    heat_rejection_capacity_w: 91558,
    max_cond_temp_c: 50,
  },
};

const STANDARD_GRID: OperatingMapGridConfig = {
  evap_temps_c: [-15, -10, -5, 0],
  cond_temps_c: [30, 35, 40, 45],
};

function generateValidatedMap() {
  return generateOperatingMap({
    system: VALIDATED_SYSTEM,
    grid: STANDARD_GRID,
  });
}

describe("Operating Map Engine", () => {
  it("generates a full 4x4 operating map", () => {
    const result = generateValidatedMap();

    expect(result.map_points).toHaveLength(16);
    expect(result.stats.total_points).toBe(16);
    expect(
      result.stats.approved_points + result.stats.warning_points + result.stats.rejected_points,
    ).toBe(16);
    expect(result.envelope.feasible_points.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("finds peak performance points from feasible points", () => {
    const result = generateValidatedMap();

    expect(result.max_capacity_point).not.toBeNull();
    expect(result.max_cop_point).not.toBeNull();
    expect(result.max_capacity_point!.capacity_w).toBeGreaterThanOrEqual(
      result.stats.min_capacity_w,
    );
    expect(result.max_cop_point!.cop).toBeGreaterThanOrEqual(result.stats.min_cop);
    expect(result.max_capacity_point!.status).not.toBe("rejected");
    expect(result.max_cop_point!.status).not.toBe("rejected");
  });

  it("computes consistent operating map stats", () => {
    const result = generateValidatedMap();

    expect(result.stats.max_capacity_w).toBeGreaterThanOrEqual(result.stats.min_capacity_w);
    expect(result.stats.max_cop).toBeGreaterThanOrEqual(result.stats.min_cop);
    expect(result.stats.max_compressor_power_w).toBeGreaterThanOrEqual(
      result.stats.min_compressor_power_w,
    );
    expect(result.stats.min_capacity_w).toBeGreaterThan(0);
    expect(result.stats.min_cop).toBeGreaterThan(0);
  });

  it("generates capacity and COP isolines", () => {
    const result = generateValidatedMap();

    expect(result.capacity_isolines.length).toBeGreaterThanOrEqual(1);
    expect(result.cop_isolines.length).toBeGreaterThanOrEqual(1);
    result.capacity_isolines.forEach((isoline) => {
      expect(isoline.points.length).toBeGreaterThanOrEqual(2);
      expect(isoline.label).not.toBe("");
    });
    result.cop_isolines.forEach((isoline) => {
      expect(isoline.points.length).toBeGreaterThanOrEqual(2);
      expect(isoline.label).not.toBe("");
    });
  });

  it("protects against invalid grids", () => {
    const result = generateOperatingMap({
      system: BASE_SYSTEM,
      grid: { evap_temps_c: [], cond_temps_c: [30, 35] },
    });

    expect(result.map_points).toHaveLength(0);
    expect(result.stats.total_points).toBe(0);
    expect(result.max_capacity_point).toBeNull();
    expect(result.max_cop_point).toBeNull();
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });
});
