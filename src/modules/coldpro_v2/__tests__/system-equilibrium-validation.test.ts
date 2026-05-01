import { describe, it, expect } from "vitest";
import { evaluateSystemEquilibrium } from "../engines/equilibrium/systemEquilibriumEngine";
import type { ProgressiveCoilInput } from "../domain/types";

const BASE_EVAP: ProgressiveCoilInput = {
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

const BASE_INPUT = {
  compressor: {
    cooling_capacity_w: 50000,
    power_w: 2000,
    refrigerant: "R404A",
    evap_temp_c: -8,
    cond_temp_c: 35,
  },
  evaporator: { progressive_input: BASE_EVAP },
  condenser: {
    heat_rejection_capacity_w: 50000,
    max_cond_temp_c: 45,
  },
  system_conditions: {
    ambient_temp_c: 32,
    required_airflow_m3_h: 4000,
  },
};

describe("Teste 1: Sistema equilibrado", () => {
  it("deve calcular sistema e identificar q_evap corretamente", () => {
    const result = evaluateSystemEquilibrium(BASE_INPUT);

    expect(result.thermal_balance.q_evap_w).toBeGreaterThan(0);
    expect(result.thermal_balance.balance_error_pct).toBeGreaterThanOrEqual(0);
    expect(result.thermal_balance.q_cond_required_w).toBeGreaterThan(
      result.thermal_balance.q_evap_w,
    );
    expect(result.utilization.compressor_pct).toBeGreaterThan(0);
    expect(result.utilization.condenser_pct).toBeGreaterThan(0);
    expect(result.evaporator_result.total_capacity_w).toBeGreaterThan(0);
    expect(result.bottleneck_codes).not.toContain("evaporator_solver_error");
  });
});

describe("Teste 2: Condensador insuficiente", () => {
  it("deve identificar condensador subdimensionado", () => {
    const result = evaluateSystemEquilibrium({
      ...BASE_INPUT,
      condenser: { heat_rejection_capacity_w: 3000, max_cond_temp_c: 45 },
    });

    expect(result.utilization.condenser_pct).toBeGreaterThan(100);
    expect(result.bottleneck_codes).toContain("condenser_undersized");
    expect(result.bottlenecks.some((b) => b.includes("Condenser"))).toBe(true);
    expect(result.recommendations.some((r) => r.toLowerCase().includes("condenser"))).toBe(true);
  });
});

describe("Teste 3: Compressor subdimensionado", () => {
  it("deve identificar compressor subdimensionado", () => {
    const result = evaluateSystemEquilibrium({
      ...BASE_INPUT,
      compressor: { ...BASE_INPUT.compressor, cooling_capacity_w: 500 },
    });

    expect(result.utilization.compressor_pct).toBeGreaterThan(100);
    expect(result.bottleneck_codes).toContain("compressor_undersized");
    expect(result.bottlenecks.some((b) => b.includes("Compressor"))).toBe(true);
  });
});

describe("Teste 4: Válvula de expansão limitante", () => {
  it("deve identificar válvula subdimensionada", () => {
    const result = evaluateSystemEquilibrium({
      ...BASE_INPUT,
      expansion_valve: { nominal_capacity_w: 100 },
    });

    expect(result.utilization.expansion_valve_pct).toBeGreaterThan(100);
    expect(result.bottleneck_codes).toContain("expansion_valve_undersized");
    expect(result.bottlenecks.some((b) => /[Vv]alve/.test(b))).toBe(true);
  });
});

describe("Teste 5: Ventilador do evaporador insuficiente", () => {
  it("deve identificar ventilador subdimensionado", () => {
    const result = evaluateSystemEquilibrium({
      ...BASE_INPUT,
      evaporator_fan: { airflow_m3_h: 100, available_static_pressure_pa: 50 },
    });

    expect(result.utilization.evaporator_fan_pct).toBeGreaterThan(100);
    expect(result.bottleneck_codes).toContain("evaporator_fan_undersized");
    expect(result.bottlenecks.some((b) => /[Ff]an/.test(b))).toBe(true);
  });
});

describe("Teste 6: Balanço térmico inválido", () => {
  it("deve detectar erro de balanço com potência absurda", () => {
    const result = evaluateSystemEquilibrium({
      ...BASE_INPUT,
      compressor: { ...BASE_INPUT.compressor, power_w: 50000 },
    });

    expect(result.thermal_balance.balance_error_pct).toBeGreaterThan(5);
    const hasBalanceIssue =
      result.bottleneck_codes.includes("thermal_balance_error") ||
      result.warnings.some((w) => /[Bb]alance/.test(w));
    expect(hasBalanceIssue).toBe(true);
  });
});
