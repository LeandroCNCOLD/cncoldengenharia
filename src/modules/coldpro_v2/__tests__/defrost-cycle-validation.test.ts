import { describe, it, expect } from "vitest";
import { calculateDefrostCycle } from "../engines/defrost/defrostCycle";

const BASE = {
  frost_mass_kg: 2.0,
  frost_temperature_c: -10,
  compressor_capacity_w: 5000,
  T_condensing_c: 40,
  T_evaporating_c: -10,
};

describe("Teste 1: hot_gas_reversal", () => {
  it("deve calcular tempo de degelo válido", () => {
    const result = calculateDefrostCycle({ ...BASE, method: "hot_gas_reversal" });

    expect(result.status).toBe("ok");
    expect(result.defrost_time_feasible).toBe(true);
    expect(result.defrost_time_min).toBeGreaterThan(0);
    expect(result.Q_total_required_kj).toBeGreaterThan(0);
    expect(result.Q_defrost_available_w).toBeGreaterThan(0);
    expect(result.reversal_q_fraction).toBe(0.8);
    expect(result.liquid_return_risk).toBe("medium");
    expect(result.components.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Teste 2: hot_gas_bypass", () => {
  it("deve calcular vazão e diâmetro de bypass", () => {
    const result = calculateDefrostCycle({ ...BASE, method: "hot_gas_bypass" });

    expect(result.status).toBe("ok");
    expect(result.bypass_mass_flow_kg_s).toBeGreaterThan(0);
    expect(result.bypass_line_diameter_mm).toBeGreaterThan(0);
    expect(result.accumulator_volume_l).toBeGreaterThan(0);
    expect(result.liquid_return_risk).toBe("high");
    expect(result.components.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Teste 3: electric", () => {
  it("deve calcular potência elétrica", () => {
    const result = calculateDefrostCycle({
      ...BASE,
      method: "electric",
      evaporator_external_area_m2: 5.0,
    });

    expect(result.status).toBe("ok");
    expect(result.electric_power_w).toBeGreaterThan(0);
    expect(result.electric_power_density_w_m2).toBeGreaterThan(0);
    expect(result.liquid_return_risk).toBe("low");
    expect(result.Q_defrost_available_w).toBe(result.electric_power_w);
  });
});

describe("Teste 4: excesso de gelo", () => {
  it("deve gerar warning de tempo excedido", () => {
    const result = calculateDefrostCycle({
      ...BASE,
      method: "hot_gas_reversal",
      frost_mass_kg: 50,
      max_defrost_time_min: 10,
    });

    expect(result.defrost_time_feasible).toBe(false);
    expect(result.status).toBe("warning");
    expect(result.warnings.some((w) => w.includes("excede limite"))).toBe(true);
  });
});

describe("Teste 5: elétrico sem área", () => {
  it("deve retornar error sem evaporator_external_area_m2", () => {
    const result = calculateDefrostCycle({
      ...BASE,
      method: "electric",
    });

    expect(result.status).toBe("error");
  });
});
