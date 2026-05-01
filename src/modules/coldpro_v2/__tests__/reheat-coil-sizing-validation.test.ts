import { describe, it, expect } from "vitest";
import { calculateReheatCoilSizing } from "../engines/agro/reheatCoilSizing";
import type { ReheatCoilSizingInput } from "../domain/types";

const BASE: ReheatCoilSizingInput = {
  Q_reheat_target_w: 15,
  T_air_in_c: -1.0,
  T_air_out_c: 16.0,
  air_mass_flow_kg_s: 0.5,
  T_condensing_c: 40,
  T_hot_gas_in_c: 55,
  tube_outer_diameter_m: 0.00952,
  tube_thickness_m: 0.0008,
  fin_spacing_m: 0.0025,
  fin_thickness_m: 0.0001,
  tube_pitch_transversal_m: 0.0254,
  tube_pitch_longitudinal_m: 0.022,
  coil_length_m: 0.75,
  circuits: 4,
};

describe("Teste 1: CN_750_AGRO dimensionamento", () => {
  it("deve dimensionar bateria de reaquecimento viável", () => {
    const result = calculateReheatCoilSizing(BASE);

    expect(result.sizing_feasible).toBe(true);
    expect(result.rows_required).toBeGreaterThanOrEqual(1);
    expect(result.capacity_ratio).toBeGreaterThanOrEqual(1);
    expect(result.Q_available_w).toBeGreaterThanOrEqual(result.Q_target_w);
    expect(result.converged).toBe(true);
  });
});

describe("Teste 2: Capacidade impossível", () => {
  it("deve retornar sizing_feasible=false com Q impossível", () => {
    const result = calculateReheatCoilSizing({
      ...BASE,
      Q_reheat_target_w: 999999,
    });

    expect(result.sizing_feasible).toBe(false);
    expect(result.rows_required).toBe(4);
    expect(result.warnings.some((w) => w.includes("Capacidade insuficiente"))).toBe(true);
  });
});

describe("Teste 3: Consistência capacity_ratio", () => {
  it("deve ter capacity_ratio ≈ Q_available / Q_target", () => {
    const result = calculateReheatCoilSizing(BASE);

    const expected = result.Q_available_w / result.Q_target_w;
    expect(result.capacity_ratio).toBeCloseTo(expected, 3);
  });
});

describe("Teste 4: Erro físico — T_ar >= T_condensing", () => {
  it("deve retornar error quando T_ar >= T_condensing", () => {
    const result = calculateReheatCoilSizing({
      ...BASE,
      T_air_in_c: 45,
      T_condensing_c: 40,
    });

    expect(result.status).toBe("error");
    expect(result.sizing_feasible).toBe(false);
  });
});

describe("Teste 5: Perda de carga com duas serpentinas", () => {
  it("deve calcular ΔP total e verificar viabilidade do ventilador", () => {
    const result = calculateReheatCoilSizing({
      ...BASE,
      evaporator_air_pressure_drop_pa: 25,
      fan_static_pressure_pa: 200,
    });

    expect(result.reheat_air_pressure_drop_pa).toBeGreaterThan(0);
    expect(result.total_air_pressure_drop_pa).toBeGreaterThan(25);
    expect(result.fan_feasible).toBe(true);
  });
});
