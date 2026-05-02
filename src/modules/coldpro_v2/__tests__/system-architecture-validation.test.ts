import { describe, expect, it } from "vitest";
import type {
  CompressorUnit,
  CondenserUnit,
  EvaporatorUnit,
  ProgressiveCoilInput,
} from "../domain/types";
import { evaluateSystemArchitecture } from "../engines/architecture/systemArchitectureEngine";

const BASE_PROGRESSIVE_INPUT: ProgressiveCoilInput = {
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

const BASE_COMPRESSOR: CompressorUnit = {
  id: "comp-1",
  type: "fixed",
  nominal_capacity_w: 5000,
  power_w: 1800,
  available: true,
};

const BASE_EVAPORATOR: EvaporatorUnit = {
  id: "evap-1",
  progressive_input: BASE_PROGRESSIVE_INPUT,
};

const BASE_CONDENSER: CondenserUnit = {
  id: "cond-1",
  heat_rejection_capacity_w: 20000,
  max_cond_temp_c: 50,
};

describe("System Architecture Engine", () => {
  it("evaluates a single circuit with one compressor and evaporator", () => {
    const result = evaluateSystemArchitecture({
      circuits: [
        {
          id: "circuit-1",
          compressors: [BASE_COMPRESSOR],
          evaporators: [BASE_EVAPORATOR],
          condenser_id: "cond-1",
        },
      ],
      condensers: [BASE_CONDENSER],
    });

    expect(["ok", "warning"]).toContain(result.status);
    expect(result.total_installed_capacity_w).toBeGreaterThan(0);
    expect(result.total_available_capacity_w).toBeGreaterThan(0);
    expect(result.circuits).toHaveLength(1);
    expect(result.circuits[0].compressor_count).toBe(1);
    expect(result.circuits[0].evaporator_count).toBe(1);
  });

  it("summarizes a multi-compressor circuit", () => {
    const result = evaluateSystemArchitecture({
      circuits: [
        {
          id: "circuit-1",
          compressors: [
            {
              id: "comp-1",
              type: "fixed",
              nominal_capacity_w: 3000,
              power_w: 1100,
              available: true,
            },
            {
              id: "comp-2",
              type: "fixed",
              nominal_capacity_w: 3000,
              power_w: 1100,
              available: true,
            },
            {
              id: "comp-3",
              type: "fixed",
              nominal_capacity_w: 3000,
              power_w: 1100,
              available: true,
            },
          ],
          evaporators: [BASE_EVAPORATOR],
          condenser_id: "cond-1",
        },
      ],
      condensers: [BASE_CONDENSER],
    });

    expect(result.circuits[0].total_compressor_capacity_w).toBe(9000);
    expect(result.circuits[0].available_compressor_count).toBe(3);
    expect(result.total_installed_capacity_w).toBe(9000);
  });

  it("detects shared condenser overload", () => {
    const smallCondenser: CondenserUnit = {
      id: "cond-small",
      heat_rejection_capacity_w: 3000,
      max_cond_temp_c: 50,
    };

    const result = evaluateSystemArchitecture({
      circuits: [
        {
          id: "circuit-1",
          compressors: [BASE_COMPRESSOR],
          evaporators: [BASE_EVAPORATOR],
          condenser_id: "cond-small",
        },
        {
          id: "circuit-2",
          compressors: [{ ...BASE_COMPRESSOR, id: "comp-2" }],
          evaporators: [{ ...BASE_EVAPORATOR, id: "evap-2" }],
          condenser_id: "cond-small",
        },
      ],
      condensers: [smallCondenser],
      options: { allow_shared_condenser: true },
    });

    expect(result.warnings.some((warning) => warning.includes("overloaded"))).toBe(true);
    expect(["warning", "error"]).toContain(result.status);
    expect(result.shared_condenser_loads["cond-small"]).toBeGreaterThan(
      smallCondenser.heat_rejection_capacity_w,
    );
  });

  it("accounts for unavailable compressors", () => {
    const result = evaluateSystemArchitecture({
      circuits: [
        {
          id: "circuit-1",
          compressors: [
            {
              id: "comp-1",
              type: "fixed",
              nominal_capacity_w: 5000,
              power_w: 1800,
              available: true,
            },
            {
              id: "comp-2",
              type: "fixed",
              nominal_capacity_w: 5000,
              power_w: 1800,
              available: false,
            },
          ],
          evaporators: [BASE_EVAPORATOR],
          condenser_id: "cond-1",
        },
      ],
      condensers: [BASE_CONDENSER],
    });

    expect(result.circuits[0].available_compressor_count).toBe(1);
    expect(result.circuits[0].available_compressor_capacity_w).toBe(5000);
    expect(result.circuits[0].total_compressor_capacity_w).toBe(10000);
  });

  it("warns when N+1 redundancy is insufficient", () => {
    const result = evaluateSystemArchitecture({
      circuits: [
        {
          id: "circuit-1",
          compressors: [
            {
              id: "comp-1",
              type: "fixed",
              nominal_capacity_w: 5000,
              power_w: 1800,
              available: true,
            },
          ],
          evaporators: [BASE_EVAPORATOR],
          condenser_id: "cond-1",
        },
      ],
      condensers: [BASE_CONDENSER],
      options: { redundancy_mode: "N+1" },
    });

    expect(result.warnings.some((warning) => warning.includes("N+1"))).toBe(true);
    expect(["warning", "error"]).toContain(result.status);
  });

  it("evaluates multiple circuits independently", () => {
    const result = evaluateSystemArchitecture({
      circuits: [
        {
          id: "circuit-A",
          compressors: [BASE_COMPRESSOR],
          evaporators: [BASE_EVAPORATOR],
          condenser_id: "cond-1",
        },
        {
          id: "circuit-B",
          compressors: [{ ...BASE_COMPRESSOR, id: "comp-B" }],
          evaporators: [{ ...BASE_EVAPORATOR, id: "evap-B" }],
          condenser_id: "cond-1",
        },
      ],
      condensers: [BASE_CONDENSER],
    });

    expect(result.circuits).toHaveLength(2);
    expect(result.circuits[0].id).toBe("circuit-A");
    expect(result.circuits[1].id).toBe("circuit-B");
    expect(result.total_installed_capacity_w).toBeGreaterThan(0);
  });
});
