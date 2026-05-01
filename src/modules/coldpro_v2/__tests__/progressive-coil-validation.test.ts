import { describe, it, expect } from "vitest";
import { calculateProgressiveCoil } from "../engines/progressive/progressiveCoilSolver";
import type { ProgressiveCoilInput } from "../domain/types";

const BASE: ProgressiveCoilInput = {
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
    { fin_spacing_mm: 6, rows_in_roll: 2 },
    { fin_spacing_mm: 6, rows_in_roll: 2 },
  ],
  air_temperature_in_c: 5,
  air_relative_humidity_in: 0.85,
  air_mass_flow_kg_s: 1.2,
  T_evaporating_c: -8,
};

describe("Teste 1: Passo uniforme", () => {
  it("deve calcular resultado coerente com 2 rolls iguais", () => {
    const result = calculateProgressiveCoil(BASE);

    expect(result.status).not.toBe("error");
    expect(result.total_capacity_w).toBeGreaterThan(0);
    expect(result.rolls).toHaveLength(2);
    expect(result.air_temperature_out_c).toBeLessThan(BASE.air_temperature_in_c);
    expect(result.total_air_pressure_drop_pa).toBeGreaterThan(0);
  });
});

describe("Teste 2: Passo progressivo (largo → estreito)", () => {
  it("deve ter maior ΔP no roll com passo menor", () => {
    const result = calculateProgressiveCoil({
      ...BASE,
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
    });

    expect(result.status).not.toBe("error");
    expect(result.rolls[0]!.air_pressure_drop_pa).toBeLessThan(
      result.rolls[1]!.air_pressure_drop_pa,
    );
    expect(result.rolls[0]!.air_temperature_out_c).toBeGreaterThan(
      result.rolls[1]!.air_temperature_out_c,
    );
    expect(result.total_capacity_w).toBeGreaterThan(0);
  });
});

describe("Teste 3: Impacto do gelo no roll frontal", () => {
  it("deve aumentar ΔP e reduzir capacidade com gelo", () => {
    const clean = calculateProgressiveCoil({
      ...BASE,
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
    });

    const frosted = calculateProgressiveCoil({
      ...BASE,
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
      frost_thickness_mm_per_roll: [3.0, 0.0],
    });

    expect(frosted.rolls[0]!.frost_thickness_mm).toBe(3.0);
    expect(frosted.rolls[0]!.frost_resistance_m2k_w).toBeGreaterThan(0);
    expect(frosted.rolls[0]!.air_pressure_drop_pa).toBeGreaterThan(
      clean.rolls[0]!.air_pressure_drop_pa,
    );
    expect(frosted.total_capacity_w).toBeLessThan(clean.total_capacity_w);
  });
});

describe("Teste 4: Proteção física (T_evap > T_ar)", () => {
  it("deve retornar error quando T_evap >= T_air_in", () => {
    const result = calculateProgressiveCoil({
      ...BASE,
      T_evaporating_c: 10,
      air_temperature_in_c: 5,
    });

    expect(result.status).toBe("error");
  });
});

describe("Teste 5: Encadeamento térmico com 3 rolls", () => {
  it("deve resfriar progressivamente e somar capacidades", () => {
    const result = calculateProgressiveCoil({
      ...BASE,
      rolls: [
        { fin_spacing_mm: 12, rows_in_roll: 2 },
        { fin_spacing_mm: 8, rows_in_roll: 2 },
        { fin_spacing_mm: 5, rows_in_roll: 2 },
      ],
    });

    expect(result.rolls).toHaveLength(3);
    expect(result.rolls[1]!.air_temperature_out_c).toBeLessThan(
      result.rolls[0]!.air_temperature_out_c,
    );
    expect(result.rolls[2]!.air_temperature_out_c).toBeLessThan(
      result.rolls[1]!.air_temperature_out_c,
    );

    const sumCap =
      result.rolls[0]!.capacity_w + result.rolls[1]!.capacity_w + result.rolls[2]!.capacity_w;
    expect(Math.abs(result.total_capacity_w - sumCap)).toBeLessThan(0.1);
  });
});

describe("Teste 6: Violação física — rolls com fin_spacing zero", () => {
  it("deve retornar error para condição fisicamente impossível", () => {
    const result = calculateProgressiveCoil({
      ...BASE,
      rolls: [
        { fin_spacing_mm: 0, rows_in_roll: 2 },
        { fin_spacing_mm: 6, rows_in_roll: 2 },
      ],
    });

    expect(result.status).toBe("error");
    expect(result.total_capacity_w).toBe(0);
    expect(result.rolls).toHaveLength(0);
  });
});

describe("Teste 7: Conservação de energia — Q_coil ≈ m*(h_in - h_out)", () => {
  it("deve ter erro de balanço de energia < 5%", () => {
    const result = calculateProgressiveCoil(BASE);

    expect(result.status).not.toBe("error");
    expect(result.total_capacity_w).toBeGreaterThan(0);
    expect(result.energy_balance_error_pct).toBeLessThan(5);
  });
});
