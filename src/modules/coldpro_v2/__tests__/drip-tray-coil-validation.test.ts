import { describe, it, expect } from "vitest";
import { calculateDripTrayCoil } from "../engines/subcooling/dripTrayCoil";
import type { DripTrayCoilInput } from "../domain/types";

const BASE_INPUT: DripTrayCoilInput = {
  tube_outer_diameter_m: 0.00952,
  tube_thickness_m: 0.0008,
  tube_material: "copper",
  tray_length_m: 1.0,
  number_of_bends: 4,
  pitch_m: 0.02,
  liquid_mass_flow_kgs: 0.05,
  T_liquid_in_c: 35,
  tray_condition: "water",
  T_tray_c: 10,
};

describe("Teste 1: Geometria da serpentina", () => {
  it("deve calcular geometria corretamente", () => {
    const result = calculateDripTrayCoil(BASE_INPUT);

    expect(result.number_of_passes).toBe(5);
    expect(result.straight_length_m).toBeCloseTo(5.0, 2);
    expect(result.bend_length_m).toBeCloseTo(4 * ((Math.PI * 0.02) / 2), 4);
    expect(result.total_length_m).toBeCloseTo(5.0 + 4 * ((Math.PI * 0.02) / 2), 3);
    expect(result.external_area_m2).toBeGreaterThan(0);
    expect(result.tube_inner_diameter_m).toBeCloseTo(0.00952 - 2 * 0.0008, 5);
  });
});

describe("Teste 2: melting_ice", () => {
  it("deve convergir com h_external=500 e subresfriamento positivo", () => {
    const result = calculateDripTrayCoil({
      ...BASE_INPUT,
      tray_condition: "melting_ice",
      T_tray_c: 0,
      T_liquid_in_c: 35,
    });

    expect(result.converged).toBe(true);
    expect(result.h_external_w_m2k).toBe(500);
    expect(result.q_tray_w).toBeGreaterThan(0);
    expect(result.T_liquid_out_c).toBeLessThan(result.T_liquid_in_c);
    expect(result.liquid_subcooling_k).toBeGreaterThan(0);
  });
});

describe("Teste 3: dry_air", () => {
  it("deve convergir com h_external=8 e subresfriamento positivo", () => {
    const result = calculateDripTrayCoil({
      ...BASE_INPUT,
      tray_condition: "dry_air",
      T_tray_c: -5,
      T_liquid_in_c: 35,
    });

    expect(result.converged).toBe(true);
    expect(result.h_external_w_m2k).toBe(8);
    expect(result.q_tray_w).toBeGreaterThan(0);
    expect(result.T_liquid_out_c).toBeLessThan(result.T_liquid_in_c);
  });
});

describe("Teste 4: water", () => {
  it("deve convergir com h_external calculado e subresfriamento positivo", () => {
    const result = calculateDripTrayCoil({
      ...BASE_INPUT,
      tray_condition: "water",
      T_tray_c: 10,
      T_liquid_in_c: 35,
    });

    expect(result.converged).toBe(true);
    expect(result.h_external_w_m2k).toBeGreaterThan(0);
    expect(result.q_tray_w).toBeGreaterThan(0);
    expect(result.T_liquid_out_c).toBeLessThan(result.T_liquid_in_c);
    expect(result.u_w_m2k).toBeGreaterThan(0);
    expect(result.lmtd_k).toBeGreaterThan(0);
    expect(result.q_tray_kcalh).toBeGreaterThan(0);
  });
});

describe("Teste 5: Proteção física — T_liquid_in <= T_tray", () => {
  it("deve retornar error quando T_liquid_in <= T_tray", () => {
    const result = calculateDripTrayCoil({
      ...BASE_INPUT,
      T_liquid_in_c: 5,
      T_tray_c: 10,
    });

    expect(result.status).toBe("error");
    expect(result.converged).toBe(false);
    expect(result.q_tray_w).toBe(0);
    expect(result.T_liquid_out_c).toBe(result.T_liquid_in_c);
  });
});
