import { describe, it, expect } from "vitest";
import { calculateOperationalCycle } from "../engines/operation/operationalOrchestrator";
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

const BASE_INPUT: OperationalOrchestratorInput = {
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

describe("Teste 1: Ciclo normal sem degelo", () => {
  it("deve operar normalmente sem recomendar degelo", () => {
    const result = calculateOperationalCycle(BASE_INPUT);

    expect(result.status).not.toBe("error");
    expect(result.cycle_status).toBe("normal");
    expect(result.recommended_defrost).toBe(false);
    expect(result.defrost_result).toBeNull();
    expect(result.operational_availability_pct).toBe(100);
    expect(result.coupled_result.converged).toBe(true);
  });
});

describe("Teste 2: Ciclo com degelo recomendado", () => {
  it("deve recomendar degelo com threshold baixo", () => {
    const result = calculateOperationalCycle({
      ...BASE_INPUT,
      operation_time_h: 8,
      frost: {
        ...BASE_INPUT.frost,
        defrost_threshold_frost_thickness_mm: 0.1,
      },
    });

    expect(result.recommended_defrost).toBe(true);
    expect(result.defrost_result).not.toBeNull();
    expect(result.defrost_time_min).toBeGreaterThan(0);
    expect(result.operational_availability_pct).toBeLessThan(100);
    expect(result.cycle_status).toBe("defrost_recommended");
  });
});

describe("Teste 3: Capacidade efetiva reduzida", () => {
  it("deve ter capacidade efetiva <= capacidade acoplada", () => {
    const result = calculateOperationalCycle(BASE_INPUT);

    expect(result.capacity_loss_pct).toBeGreaterThanOrEqual(0);
    expect(result.effective_capacity_w).toBeLessThanOrEqual(result.coupled_result.capacity_w);
  });
});

describe("Teste 4: Proteção física — operation_time = 0", () => {
  it("deve retornar error com operation_time_h = 0", () => {
    const result = calculateOperationalCycle({
      ...BASE_INPUT,
      operation_time_h: 0,
    });

    expect(result.status).toBe("error");
    expect(result.cycle_status).toBe("error");
  });
});

describe("Teste 5: Degelo inviável", () => {
  it("deve retornar defrost_required com compressor fraco", () => {
    const result = calculateOperationalCycle({
      ...BASE_INPUT,
      operation_time_h: 8,
      frost: {
        ...BASE_INPUT.frost,
        defrost_threshold_frost_thickness_mm: 0.01,
      },
      defrost: {
        ...BASE_INPUT.defrost,
        compressor_capacity_w: 100,
        max_defrost_time_min: 1,
      },
    });

    expect(result.cycle_status).toBe("defrost_required");
    expect(result.status).toBe("warning");
  });
});
