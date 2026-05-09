import { describe, it, expect } from "vitest";

import { solveCoupledCoil } from "../engines/solver/coupledCoilSolver";
import type { CoilAdvancedInput } from "../domain/types";

const BASE: CoilAdvancedInput = {
  rows: 3,
  tubes_per_row: 16,
  circuits: 2,
  fin_spacing_mm: 5.0,
  length_mm: 600,
  tube_diameter_mm: 12.7,
  tube_thickness_mm: 0.3,
  airflow_m3h: 2989,
  delta_t_k: null,
  mass_flow_kgs: null,
  air_inlet_temp_c: 25,
  air_outlet_temp_c: null,
  fluid_inlet_temp_c: 5,
  fluid_outlet_temp_c: 5,
  fluid_h_w_m2k: 1000,
  fin_conductivity_w_mk: 200,
  fin_thickness_m: 0.0001,
  wall_resistance_m2k_w: null,
  fouling_air_m2k_w: 0,
  fouling_fluid_m2k_w: 0,
  tube_roughness_m: 0.0000015,
  air_relative_humidity: 0.5,
  tube_pitch_transverse_m: 0.0315,
  tube_pitch_longitudinal_m: 0.027,
};

describe("Caso 1: Modo seco — T_surface > T_dp", () => {
  it("deve operar em modo seco sem condensação", () => {
    const result = solveCoupledCoil({
      ...BASE,
      air_inlet_temp_c: 25,
      air_relative_humidity: 0.3,
      fluid_inlet_temp_c: 20,
      fluid_outlet_temp_c: 20,
    });

    expect(result.coil_surface_mode).toBe("dry");
    expect(result.W_out).toBeCloseTo(result.W_in, 4);
    expect(result.water_removed_kg_h).toBeCloseTo(0, 2);
    expect(result.latent_load_w).toBeCloseTo(0, 0);
  });
});

describe("Caso 2: Modo molhado — W_out < W_in", () => {
  it("deve operar em modo wet com condensação", () => {
    // Geometria: 4 filas × 24 tubos × 1670 mm, P_t=31.5mm, P_l=27mm, F_p=3.6mm
    // Área total com aletas ≈ 200 m² → airflow compatível com coil de grande porte
    // Atualizado: airflow_m3h=8000 para Q_th ≈ Q_psy (correção C_AREA aplicada)
    const result = solveCoupledCoil({
      ...BASE,
      rows: 4,
      tubes_per_row: 24,
      circuits: 12,
      fin_spacing_mm: 3.6,
      length_mm: 1670,
      airflow_m3h: 8000,
      air_inlet_temp_c: 30,
      air_relative_humidity: 0.6,
      fluid_inlet_temp_c: -10,
      fluid_outlet_temp_c: -10,
      fluid_h_w_m2k: 5000,
    });

    expect(result.converged).toBe(true);
    expect(result.coil_surface_mode).toBe("wet");
    expect(result.W_out).toBeLessThan(result.W_in);
    expect(result.water_removed_kg_h).toBeGreaterThan(0);
    expect(result.latent_load_w).toBeGreaterThan(0);
  });
});

describe("Caso 3: Transição — fator molhado aplicado", () => {
  it("deve ter fator de correção entre 1.0 e 1.5 em modo wet", () => {
    const result = solveCoupledCoil({
      ...BASE,
      air_inlet_temp_c: 25,
      air_relative_humidity: 0.7,
      fluid_inlet_temp_c: 8,
      fluid_outlet_temp_c: 8,
    });

    expect(result.wet_air_correction_factor).toBeGreaterThanOrEqual(1.0);
    expect(result.wet_air_correction_factor).toBeLessThanOrEqual(1.5);
    expect(result.air_h_corrected_w_m2k).toBeGreaterThanOrEqual(result.air_h_dry_w_m2k);
  });
});

describe("Caso 4: Solver converge", () => {
  it("deve convergir dentro do limite de iterações", () => {
    const result = solveCoupledCoil({
      ...BASE,
      air_inlet_temp_c: 25,
      air_relative_humidity: 0.6,
      fluid_inlet_temp_c: 5,
      fluid_outlet_temp_c: 5,
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(100);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.capacity_w).toBeGreaterThan(0);
    expect(result.u_w_m2k).toBeGreaterThan(0);
    expect(result.lmtd_k).toBeGreaterThan(0);
  });
});

describe("Caso 5: CN COLD real — CN_100_HT acoplado", () => {
  it("deve convergir com dados reais do evaporador CN_100_HT", () => {
    const result = solveCoupledCoil({
      ...BASE,
      air_inlet_temp_c: 20,
      air_relative_humidity: 0.85,
      fluid_inlet_temp_c: 10.8,
      fluid_outlet_temp_c: 10.8,
      fluid_h_w_m2k: 2000,
    });

    expect(result.converged).toBe(true);
    expect(result.solver_type).toBe("coupled");
    expect(result.coil_surface_mode).toBe("wet");
    expect(result.dew_point_c).toBeCloseTo(17.4, 0);
    expect(result.air_outlet_temperature_c).toBeGreaterThan(result.surface_temperature_c);
    expect(result.air_outlet_temperature_c).toBeLessThan(result.air_inlet_temperature_c);
    expect(result.capacity_w).toBeGreaterThan(0);
    expect(result.sensible_load_w).toBeGreaterThan(0);
  });
});
