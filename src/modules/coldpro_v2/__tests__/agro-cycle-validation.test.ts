import { describe, it, expect } from "vitest";
import { calculateAgroCycle } from "../engines/agro/agroCycle";

describe("Teste 1: Desumidificação necessária", () => {
  it("deve calcular ciclo AGRO com desumidificação", () => {
    const result = calculateAgroCycle({
      T_room_c: 20,
      RH_room: 0.8,
      T_setpoint_c: 16,
      RH_setpoint: 0.5,
      air_mass_flow_kg_s: 1.0,
    });

    expect(result.status).toBe("ok");
    expect(result.mode).toBe("dehumidification");
    expect(result.W_in).toBeGreaterThan(result.W_setpoint);
    expect(result.T_evap_out_required_c).toBeLessThan(result.T_setpoint_c);
    expect(result.Q_evap_w).toBeGreaterThan(0);
    expect(result.Q_reheat_w).toBeGreaterThan(0);
    expect(result.water_removed_kg_h).toBeGreaterThan(0);
    expect(result.final_RH_error).toBeLessThan(0.001);
    expect(result.converged).toBe(true);
  });
});

describe("Teste 2: Apenas resfriamento", () => {
  it("deve operar em cooling_only quando W_in <= W_setpoint", () => {
    const result = calculateAgroCycle({
      T_room_c: 20,
      RH_room: 0.3,
      T_setpoint_c: 16,
      RH_setpoint: 0.5,
      air_mass_flow_kg_s: 1.0,
    });

    expect(result.mode).toBe("cooling_only");
    expect(result.Q_reheat_w).toBe(0);
    expect(result.water_removed_kg_h).toBe(0);
    expect(result.T_evap_out_required_c).toBe(result.T_setpoint_c);
    expect(result.converged).toBe(true);
  });
});

describe("Teste 3: Consistência termodinâmica", () => {
  it("deve verificar que RH final é consistente com setpoint", () => {
    const result = calculateAgroCycle({
      T_room_c: 20,
      RH_room: 0.8,
      T_setpoint_c: 16,
      RH_setpoint: 0.5,
      air_mass_flow_kg_s: 1.0,
    });

    expect(result.final_RH_check).toBeCloseTo(result.RH_setpoint, 2);
    expect(Math.abs(result.final_RH_error)).toBeLessThan(0.001);
    expect(result.RH_evap_out).toBe(1.0);
    expect(result.Q_evap_kcalh).toBeGreaterThan(0);
    expect(result.Q_reheat_kcalh).toBeGreaterThan(0);
    expect(result.Q_total_cycle_w).toBe(result.Q_evap_w + result.Q_reheat_w);
  });
});

describe("Teste 4: RH em porcentagem", () => {
  it("deve converter RH de porcentagem para fração decimal", () => {
    const result = calculateAgroCycle({
      T_room_c: 20,
      RH_room: 80,
      T_setpoint_c: 16,
      RH_setpoint: 50,
      air_mass_flow_kg_s: 1.0,
    });

    expect(result.status).not.toBe("error");
    expect(result.mode).toBe("dehumidification");
    expect(result.RH_room).toBeCloseTo(0.8, 2);
    expect(result.RH_setpoint).toBeCloseTo(0.5, 2);
    expect(result.warnings.some((w) => w.includes("porcentagem"))).toBe(true);
  });
});

describe("Teste 5: Proteção física — vazão zero", () => {
  it("deve retornar error com air_mass_flow_kg_s = 0", () => {
    const result = calculateAgroCycle({
      T_room_c: 20,
      RH_room: 0.8,
      T_setpoint_c: 16,
      RH_setpoint: 0.5,
      air_mass_flow_kg_s: 0,
    });

    expect(result.status).toBe("error");
    expect(result.mode).toBe("invalid");
    expect(result.converged).toBe(false);
  });
});
