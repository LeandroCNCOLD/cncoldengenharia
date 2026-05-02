import { describe, it, expect } from "vitest";
import { normalizeOperationalOutput } from "../adapters/unifiedOperationalOutputAdapter";
import { calculateOperationalCycle } from "../engines/operation/operationalOrchestrator";
import { calculateProgressiveCoil } from "../engines/progressive/progressiveCoilSolver";
import type { CoilAdvancedInput, OperationalOrchestratorInput } from "../domain/types";

const COUPLED_BASE: CoilAdvancedInput = {
  rows: 3,
  tubes_per_row: 16,
  circuits: 2,
  fin_spacing_mm: 5.0,
  length_mm: 600,
  tube_diameter_mm: 12.7,
  tube_thickness_mm: 0.3,
  airflow_m3h: 3040,
  delta_t_k: null,
  mass_flow_kgs: null,
  air_inlet_temp_c: 8,
  air_outlet_temp_c: null,
  fluid_inlet_temp_c: -0.6,
  fluid_outlet_temp_c: -0.6,
  fluid_h_w_m2k: 1000,
  fin_conductivity_w_mk: 200,
  fin_thickness_m: 0.0001,
  wall_resistance_m2k_w: null,
  fouling_air_m2k_w: 0,
  fouling_fluid_m2k_w: 0,
  tube_roughness_m: 0.0000015,
  air_relative_humidity: 0.85,
  air_mass_flow_kg_s: 1.5,
  tube_pitch_transverse_m: 0.0315,
  tube_pitch_longitudinal_m: 0.027,
};

const STD_INPUT: OperationalOrchestratorInput = {
  operation_time_h: 2,
  coupled_input: COUPLED_BASE,
  frost: {
    evaporator_external_area_m2: 3,
    defrost_threshold_frost_thickness_mm: 10,
  },
  defrost: {
    method: "hot_gas_reversal",
    compressor_capacity_w: 3716,
    T_condensing_c: 35,
    T_evaporating_c: -0.6,
  },
};

describe("Teste 1: Normalizar saída do modo standard", () => {
  it("deve normalizar resultado do calculateOperationalCycle", () => {
    const raw = calculateOperationalCycle(STD_INPUT);
    const result = normalizeOperationalOutput(raw);

    expect(result.mode).toBe("standard");
    expect(result.effective_capacity_w).toBeGreaterThan(0);
    expect(result.initial_capacity_w).toBeGreaterThan(0);
    expect(result.progressive).toBeUndefined();
    expect(result.status).not.toBe("error");
    expect(result.cycle_status).not.toBe("error");
  });
});

describe("Teste 2: Normalizar saída do modo progressive", () => {
  it("deve normalizar resultado do calculateProgressiveCoil", () => {
    const raw = calculateProgressiveCoil({
      tube_outer_diameter_mm: 12,
      tube_inner_diameter_mm: 10,
      tube_pitch_transverse_mm: 30,
      tube_pitch_longitudinal_mm: 26,
      fin_height_mm: 600,
      fin_thickness_mm: 0.1,
      coil_width_m: 0.6,
      coil_height_m: 0.6,
      tube_material: "copper",
      fin_material: "aluminum",
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
      air_temperature_in_c: 5,
      air_relative_humidity_in: 0.85,
      air_mass_flow_kg_s: 1.2,
      T_evaporating_c: -8,
    });
    const result = normalizeOperationalOutput(raw);

    expect(result.mode).toBe("progressive");
    expect(result.progressive).toBeDefined();
    expect(result.progressive!.roll_count).toBe(2);
    expect(result.progressive!.roll_capacity_w).toHaveLength(2);
    expect(result.progressive!.roll_frost_thickness_mm).toHaveLength(2);
    expect(result.effective_capacity_w).toBeGreaterThan(0);
    expect(result.frost.capacity_loss_pct).toBeGreaterThanOrEqual(0);
  });
});

describe("Teste 3: Gelo reduz capacidade efetiva (progressive)", () => {
  it("deve mostrar impacto do gelo via frost_thickness por roll", () => {
    const clean = calculateProgressiveCoil({
      tube_outer_diameter_mm: 12,
      tube_inner_diameter_mm: 10,
      tube_pitch_transverse_mm: 30,
      tube_pitch_longitudinal_mm: 26,
      fin_height_mm: 600,
      fin_thickness_mm: 0.1,
      coil_width_m: 0.6,
      coil_height_m: 0.6,
      tube_material: "copper",
      fin_material: "aluminum",
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
      air_temperature_in_c: 5,
      air_relative_humidity_in: 0.85,
      air_mass_flow_kg_s: 1.2,
      T_evaporating_c: -8,
    });

    const frosted = calculateProgressiveCoil({
      tube_outer_diameter_mm: 12,
      tube_inner_diameter_mm: 10,
      tube_pitch_transverse_mm: 30,
      tube_pitch_longitudinal_mm: 26,
      fin_height_mm: 600,
      fin_thickness_mm: 0.1,
      coil_width_m: 0.6,
      coil_height_m: 0.6,
      tube_material: "copper",
      fin_material: "aluminum",
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
      air_temperature_in_c: 5,
      air_relative_humidity_in: 0.85,
      air_mass_flow_kg_s: 1.2,
      T_evaporating_c: -8,
      frost_thickness_mm_per_roll: [3.0, 0.5],
    });

    const cleanResult = normalizeOperationalOutput(clean);
    const frostedResult = normalizeOperationalOutput(frosted);

    expect(frostedResult.effective_capacity_w).toBeLessThan(cleanResult.effective_capacity_w);
    expect(frostedResult.progressive!.roll_frost_thickness_mm[0]).toBe(3.0);
    expect(frostedResult.progressive!.roll_frost_thickness_mm[1]).toBe(0.5);
    expect(frostedResult.frost.frost_detected).toBe(true);
    expect(frostedResult.frost.critical_frost_thickness_mm).toBe(3.0);
  });
});

describe("Teste 4: Warnings propagados corretamente", () => {
  it("deve propagar warnings do motor para a saída unificada", () => {
    const raw = calculateOperationalCycle({
      ...STD_INPUT,
      operation_time_h: 8,
      frost: {
        ...STD_INPUT.frost,
        defrost_threshold_frost_thickness_mm: 0.1,
      },
    });
    const result = normalizeOperationalOutput(raw);

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("Teste 5: Input inválido retorna erro", () => {
  it("deve retornar error para input vazio", () => {
    const result = normalizeOperationalOutput({});

    expect(result.status).toBe("error");
    expect(result.cycle_status).toBe("error");
    expect(result.warnings).toContain("normalizeOperationalOutput: input shape not recognized.");
    expect(result.mode).toBe("standard");
    expect(result.effective_capacity_w).toBe(0);
  });
});
