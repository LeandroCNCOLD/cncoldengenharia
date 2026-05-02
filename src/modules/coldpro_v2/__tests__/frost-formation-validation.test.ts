import { describe, it, expect } from "vitest";
import { calculateFrostFormation } from "../engines/defrost/frostFormation";

describe("Teste 1: Modo seco", () => {
  it("deve retornar dry sem formação de gelo", () => {
    const result = calculateFrostFormation({
      air_temperature_c: 10,
      air_relative_humidity: 0.5,
      coil_surface_temperature_c: 8,
      air_mass_flow_kg_s: 1,
      operation_time_h: 4,
      evaporator_external_area_m2: 5,
    });

    expect(result.mode).toBe("dry");
    expect(result.frost_mass_kg).toBe(0);
    expect(result.recommended_defrost).toBe(false);
    expect(result.status).toBe("ok");
  });
});

describe("Teste 2: Condensação sem gelo", () => {
  it("deve retornar condensation_only com água mas sem gelo", () => {
    const result = calculateFrostFormation({
      air_temperature_c: 10,
      air_relative_humidity: 0.9,
      coil_surface_temperature_c: 2,
      air_mass_flow_kg_s: 1,
      operation_time_h: 4,
      evaporator_external_area_m2: 5,
    });

    expect(result.mode).toBe("condensation_only");
    expect(result.water_condensed_kg_h).toBeGreaterThan(0);
    expect(result.frost_mass_kg).toBe(0);
    expect(result.frost_fraction).toBe(0);
  });
});

describe("Teste 3: Formação de gelo", () => {
  it("deve calcular frosting com massa e espessura de gelo", () => {
    const result = calculateFrostFormation({
      air_temperature_c: 5,
      air_relative_humidity: 0.9,
      coil_surface_temperature_c: -5,
      air_mass_flow_kg_s: 1,
      operation_time_h: 4,
      evaporator_external_area_m2: 5,
    });

    expect(result.mode).toBe("frosting");
    expect(result.water_condensed_kg_h).toBeGreaterThan(0);
    expect(result.frost_formation_kg_h).toBeGreaterThan(0);
    expect(result.frost_mass_kg).toBeGreaterThan(0);
    expect(result.frost_thickness_mm).toBeGreaterThan(0);
    expect(result.frost_fraction).toBe(1.0);
  });
});

describe("Teste 4: Recomendação de degelo por espessura", () => {
  it("deve recomendar degelo quando espessura excede threshold", () => {
    const result = calculateFrostFormation({
      air_temperature_c: 5,
      air_relative_humidity: 0.9,
      coil_surface_temperature_c: -5,
      air_mass_flow_kg_s: 1,
      operation_time_h: 4,
      evaporator_external_area_m2: 5,
      defrost_threshold_frost_thickness_mm: 0.1,
    });

    expect(result.recommended_defrost).toBe(true);
    expect(result.status).toBe("warning");
    expect(result.estimated_time_to_defrost_h).not.toBeNull();
    expect(result.estimated_time_to_defrost_h!).toBeGreaterThan(0);
  });
});

describe("Teste 5: RH em porcentagem", () => {
  it("deve converter RH de porcentagem para fração", () => {
    const result = calculateFrostFormation({
      air_temperature_c: 5,
      air_relative_humidity: 90,
      coil_surface_temperature_c: -5,
      air_mass_flow_kg_s: 1,
      operation_time_h: 4,
      evaporator_external_area_m2: 5,
    });

    expect(result.status).not.toBe("error");
    expect(result.warnings.some((w) => w.includes("porcentagem"))).toBe(true);
    expect(result.mode).toBe("frosting");
  });
});

describe("Teste 6: Proteção física — vazão zero", () => {
  it("deve retornar error com air_mass_flow_kg_s = 0", () => {
    const result = calculateFrostFormation({
      air_temperature_c: 5,
      air_relative_humidity: 0.9,
      coil_surface_temperature_c: -5,
      air_mass_flow_kg_s: 0,
      operation_time_h: 4,
      evaporator_external_area_m2: 5,
    });

    expect(result.status).toBe("error");
  });
});
