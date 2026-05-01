import { describe, expect, it } from "vitest";
import type { CondenserUnit, EvaporatorUnit, ProgressiveCoilInput } from "../domain/types";
import { solveMultiCircuitVariableControl } from "../engines/control/multiCircuitVariableControlSolver";

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

const BASE_EVAPORATOR: EvaporatorUnit = {
  id: "evap-1",
  progressive_input: BASE_PROGRESSIVE_INPUT,
};

const BASE_CONDENSER: CondenserUnit = {
  id: "cond-1",
  heat_rejection_capacity_w: 30000,
  max_cond_temp_c: 50,
};

const SMALL_CONDENSER: CondenserUnit = {
  id: "cond-small",
  heat_rejection_capacity_w: 3000,
  max_cond_temp_c: 50,
};

describe("Multi-Circuit Variable Control Solver", () => {
  it("stabilizes a single inverter circuit", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-1",
            compressors: [
              {
                id: "comp-inv",
                type: "inverter",
                nominal_capacity_w: 8000,
                power_w: 2500,
                available: true,
                min_capacity_pct: 30,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-1",
          },
        ],
        condensers: [BASE_CONDENSER],
      },
      loads: [{ circuit_id: "circuit-1", required_capacity_w: 5000 }],
    });

    expect(["stable", "warning"]).toContain(result.status);
    expect(["stable", "cycling"]).toContain(result.circuits[0].status);
    expect(result.circuits[0].compressor_dispatch[0].state).toBe("modulating");
    expect(result.circuits[0].compressor_dispatch[0].speed_pct).toBeGreaterThan(0);
    expect(result.circuits[0].compressor_dispatch[0].speed_pct).toBeLessThanOrEqual(100);
    expect(result.estimated_cop).toBeGreaterThan(0);
  });

  it("dispatches multiple fixed compressors", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-1",
            compressors: [
              {
                id: "c1",
                type: "fixed",
                nominal_capacity_w: 3000,
                power_w: 1000,
                available: true,
              },
              {
                id: "c2",
                type: "fixed",
                nominal_capacity_w: 3000,
                power_w: 1000,
                available: true,
              },
              {
                id: "c3",
                type: "fixed",
                nominal_capacity_w: 3000,
                power_w: 1000,
                available: true,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-1",
          },
        ],
        condensers: [BASE_CONDENSER],
      },
      loads: [{ circuit_id: "circuit-1", required_capacity_w: 5000 }],
    });

    expect(result.circuits[0].delivered_capacity_w).toBeGreaterThanOrEqual(5000);
    expect(result.circuits[0].compressor_dispatch.some((item) => item.state === "on")).toBe(true);
    expect(["stable", "cycling"]).toContain(result.circuits[0].status);
  });

  it("uses fixed capacity plus inverter trim", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-1",
            compressors: [
              {
                id: "fixed-1",
                type: "fixed",
                nominal_capacity_w: 4000,
                power_w: 1400,
                available: true,
              },
              {
                id: "inv-1",
                type: "inverter",
                nominal_capacity_w: 4000,
                power_w: 1400,
                available: true,
                min_capacity_pct: 30,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-1",
          },
        ],
        condensers: [BASE_CONDENSER],
      },
      loads: [{ circuit_id: "circuit-1", required_capacity_w: 5500 }],
      options: { prefer_inverter_trim: true },
    });
    const fixed = result.circuits[0].compressor_dispatch.find(
      (item) => item.compressor_id === "fixed-1",
    );
    const inverter = result.circuits[0].compressor_dispatch.find(
      (item) => item.compressor_id === "inv-1",
    );

    expect(fixed?.state).toBe("on");
    expect(inverter?.state).toBe("modulating");
    expect(result.circuits[0].capacity_error_pct).toBeLessThanOrEqual(10);
  });

  it("reports unreachable load", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-1",
            compressors: [
              {
                id: "comp-1",
                type: "fixed",
                nominal_capacity_w: 3000,
                power_w: 1000,
                available: true,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-1",
          },
        ],
        condensers: [BASE_CONDENSER],
      },
      loads: [{ circuit_id: "circuit-1", required_capacity_w: 15000 }],
    });

    expect(result.status).toBe("unreachable");
    expect(result.circuits[0].status).toBe("unreachable");
    expect(result.circuits[0].delivered_capacity_w).toBeLessThan(15000);
  });

  it("detects cycling at low inverter load", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-1",
            compressors: [
              {
                id: "inv-1",
                type: "inverter",
                nominal_capacity_w: 8000,
                power_w: 2500,
                available: true,
                min_capacity_pct: 40,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-1",
          },
        ],
        condensers: [BASE_CONDENSER],
      },
      loads: [{ circuit_id: "circuit-1", required_capacity_w: 500 }],
      options: { allow_cycling: true },
    });

    expect(["cycling", "warning"]).toContain(result.circuits[0].status);
    expect(result.circuits[0].warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("controls multiple circuits independently", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-A",
            compressors: [
              {
                id: "cA",
                type: "fixed",
                nominal_capacity_w: 5000,
                power_w: 1800,
                available: true,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-1",
          },
          {
            id: "circuit-B",
            compressors: [
              {
                id: "cB",
                type: "inverter",
                nominal_capacity_w: 6000,
                power_w: 2000,
                available: true,
                min_capacity_pct: 25,
              },
            ],
            evaporators: [{ id: "evap-B", progressive_input: BASE_PROGRESSIVE_INPUT }],
            condenser_id: "cond-1",
          },
        ],
        condensers: [BASE_CONDENSER],
      },
      loads: [
        { circuit_id: "circuit-A", required_capacity_w: 4000 },
        { circuit_id: "circuit-B", required_capacity_w: 3500 },
      ],
    });

    expect(result.circuits).toHaveLength(2);
    expect(result.total_delivered_capacity_w).toBeGreaterThan(0);
    expect(result.estimated_cop).toBeGreaterThan(0);
  });

  it("detects shared condenser overload", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
        circuits: [
          {
            id: "circuit-1",
            compressors: [
              {
                id: "c1",
                type: "fixed",
                nominal_capacity_w: 5000,
                power_w: 1800,
                available: true,
              },
            ],
            evaporators: [BASE_EVAPORATOR],
            condenser_id: "cond-small",
          },
          {
            id: "circuit-2",
            compressors: [
              {
                id: "c2",
                type: "fixed",
                nominal_capacity_w: 5000,
                power_w: 1800,
                available: true,
              },
            ],
            evaporators: [{ id: "evap-2", progressive_input: BASE_PROGRESSIVE_INPUT }],
            condenser_id: "cond-small",
          },
        ],
        condensers: [SMALL_CONDENSER],
        options: { allow_shared_condenser: true },
      },
      loads: [
        { circuit_id: "circuit-1", required_capacity_w: 4000 },
        { circuit_id: "circuit-2", required_capacity_w: 4000 },
      ],
    });

    expect(result.condenser_warnings.length).toBeGreaterThan(0);
    expect(["warning", "unreachable"]).toContain(result.status);
    expect(result.condenser_loads["cond-small"]).toBeGreaterThan(
      SMALL_CONDENSER.heat_rejection_capacity_w,
    );
  });

  it("marks unavailable compressors in dispatch", () => {
    const result = solveMultiCircuitVariableControl({
      architecture: {
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
      },
      loads: [{ circuit_id: "circuit-1", required_capacity_w: 4000 }],
    });
    const unavailable = result.circuits[0].compressor_dispatch.find(
      (item) => item.compressor_id === "comp-2",
    );

    expect(unavailable?.state).toBe("unavailable");
    expect(unavailable?.capacity_w).toBe(0);
    expect(result.circuits[0].delivered_capacity_w).toBeLessThanOrEqual(5000);
  });
});
