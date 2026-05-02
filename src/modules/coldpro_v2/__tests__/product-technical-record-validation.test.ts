import { describe, expect, it } from "vitest";
import type {
  PerformanceOperatingPoint,
  ProductIdentity,
  ProgressiveCoilInput,
  SystemComponentsInput,
} from "../domain/types";
import { buildProductTechnicalRecord } from "../database/productTechnicalRecordBuilder";

const BASE_EVAP_INPUT: ProgressiveCoilInput = {
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

const BASE_SYSTEM: SystemComponentsInput = {
  compressor: {
    cooling_capacity_w: 5000,
    power_w: 1800,
    refrigerant: "R404A",
    evap_temp_c: -8,
    cond_temp_c: 35,
  },
  evaporator: { progressive_input: BASE_EVAP_INPUT },
  condenser: {
    heat_rejection_capacity_w: 7500,
    max_cond_temp_c: 50,
  },
  system_conditions: {
    ambient_temp_c: 32,
    required_airflow_m3_h: 4000,
  },
};

const VALIDATED_SYSTEM: SystemComponentsInput = {
  ...BASE_SYSTEM,
  compressor: {
    ...BASE_SYSTEM.compressor,
    cooling_capacity_w: 100000,
    power_w: 80000,
  },
  condenser: {
    heat_rejection_capacity_w: 91558,
    max_cond_temp_c: 50,
  },
};

const BASE_IDENTITY: ProductIdentity = {
  id: "CN-TEST-001",
  model: "EVAP-4T-R404A",
  family: "Industrial Evaporators",
  line: "CN COLD",
  refrigerant: "R404A",
  application: "cold_storage",
};

const SIXTEEN_POINT_GRID: PerformanceOperatingPoint[] = [
  { evap_temp_c: -15, cond_temp_c: 30 },
  { evap_temp_c: -15, cond_temp_c: 35 },
  { evap_temp_c: -15, cond_temp_c: 40 },
  { evap_temp_c: -15, cond_temp_c: 45 },
  { evap_temp_c: -10, cond_temp_c: 30 },
  { evap_temp_c: -10, cond_temp_c: 35 },
  { evap_temp_c: -10, cond_temp_c: 40 },
  { evap_temp_c: -10, cond_temp_c: 45 },
  { evap_temp_c: -5, cond_temp_c: 30 },
  { evap_temp_c: -5, cond_temp_c: 35 },
  { evap_temp_c: -5, cond_temp_c: 40 },
  { evap_temp_c: -5, cond_temp_c: 45 },
  { evap_temp_c: 0, cond_temp_c: 30 },
  { evap_temp_c: 0, cond_temp_c: 35 },
  { evap_temp_c: 0, cond_temp_c: 40 },
  { evap_temp_c: 0, cond_temp_c: 45 },
];

function buildValidatedRecord() {
  return buildProductTechnicalRecord({
    identity: BASE_IDENTITY,
    system: VALIDATED_SYSTEM,
    operating_points: SIXTEEN_POINT_GRID,
  });
}

describe("Product Technical Record Builder", () => {
  it("builds a complete technical record", () => {
    const record = buildValidatedRecord();

    expect(record.identity.model).toBe("EVAP-4T-R404A");
    expect(record.identity.id).toBe("CN-TEST-001");
    expect(record.equilibrium).toHaveProperty("status");
    expect(record.performance_curve.points.length).toBeGreaterThanOrEqual(6);
    expect(record.polynomial_coefficients.coefficients.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(record.traceability.generated_at))).toBe(false);
    expect(record.traceability.engine_version).toBe("coldpro_v2");
    expect(record.traceability.source).toBe("calculated");
    expect(["approved", "warning"]).toContain(record.validation.final_status);
  });

  it("calculates operating limits from valid operating points", () => {
    const record = buildValidatedRecord();

    expect(record.operating_limits.max_capacity_w).toBeGreaterThanOrEqual(
      record.operating_limits.min_capacity_w,
    );
    expect(record.operating_limits.max_cop).toBeGreaterThanOrEqual(record.operating_limits.min_cop);
    expect(record.operating_limits.max_evap_temp_c).toBeGreaterThanOrEqual(
      record.operating_limits.min_evap_temp_c,
    );
    expect(record.operating_limits.max_cond_temp_c).toBeGreaterThanOrEqual(
      record.operating_limits.min_cond_temp_c,
    );
    expect(record.operating_limits.min_capacity_w).toBeGreaterThan(0);
    expect(record.operating_limits.min_cop).toBeGreaterThan(0);
  });

  it("deduplicates consolidated warnings", () => {
    const record = buildValidatedRecord();

    expect(record.warnings).toHaveLength(new Set(record.warnings).size);
  });

  it("rejects invalid input without identity model", () => {
    const record = buildProductTechnicalRecord({
      identity: {
        id: "CN-TEST-002",
        model: "",
        family: "Test",
        line: "CN COLD",
        refrigerant: "R404A",
      },
      system: BASE_SYSTEM,
      operating_points: SIXTEEN_POINT_GRID,
    });

    expect(record.validation.final_status).toBe("rejected");
    expect(record.warnings.some((warning) => warning.toLowerCase().includes("model"))).toBe(true);
  });

  it("uses custom traceability options", () => {
    const record = buildProductTechnicalRecord({
      identity: BASE_IDENTITY,
      system: VALIDATED_SYSTEM,
      operating_points: SIXTEEN_POINT_GRID,
      options: {
        engine_version: "test-v2.0",
        source: "calculated",
      },
    });

    expect(record.traceability.engine_version).toBe("test-v2.0");
    expect(record.traceability.source).toBe("calculated");
    expect(record.traceability.generated_at).not.toBe("");
  });
});
