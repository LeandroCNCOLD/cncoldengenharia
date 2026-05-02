import { describe, expect, it } from "vitest";
import type {
  OperatingMapPoint,
  OperatingMapResult,
  PolynomialCoefficientSet,
  ProductPerformancePoint,
  ProductTechnicalRecord,
} from "../domain/types";
import { exportProductTechnicalData } from "../adapters/productTechnicalExportAdapter";

function makeExportRecord(overrides?: {
  id?: string;
  model?: string;
  withPoints?: boolean;
  withCoefficients?: boolean;
  warnings?: string[];
}): ProductTechnicalRecord {
  const points: ProductPerformancePoint[] = overrides?.withPoints
    ? [
        {
          evap_temp_c: -8,
          cond_temp_c: 35,
          capacity_w: 5000,
          compressor_power_w: 1800,
          cop: 2.78,
          q_cond_w: 6800,
          balance_error_pct: 1.5,
          status: "approved",
          utilization: { compressor_pct: 100, evaporator_pct: 100, condenser_pct: 91 },
          warnings: [],
          bottleneck_codes: [],
        },
        {
          evap_temp_c: -8,
          cond_temp_c: 40,
          capacity_w: 4500,
          compressor_power_w: 1900,
          cop: 2.37,
          q_cond_w: 6400,
          balance_error_pct: 1.8,
          status: "approved",
          utilization: { compressor_pct: 90, evaporator_pct: 90, condenser_pct: 85 },
          warnings: [],
          bottleneck_codes: [],
        },
      ]
    : [];

  const coefficients: PolynomialCoefficientSet[] = overrides?.withCoefficients
    ? [
        {
          target: "capacity_w",
          coefficients: { a0: 5000, a1: 100, a2: -50, a3: 0, a4: 0, a5: 0 },
          fit_quality: { rmse: 10, max_error_pct: 0.2, r2: 0.99 },
        },
      ]
    : [];

  return {
    identity: {
      id: overrides?.id ?? "REC-EXPORT-001",
      model: overrides?.model ?? "EVAP-EXPORT-TEST",
      family: "Test Family",
      line: "Test Line",
      refrigerant: "R404A",
    },
    components: {} as ProductTechnicalRecord["components"],
    equilibrium: {} as ProductTechnicalRecord["equilibrium"],
    performance_curve: {
      status: "ok",
      points,
      summary: {} as ProductTechnicalRecord["performance_curve"]["summary"],
      envelope: {} as ProductTechnicalRecord["performance_curve"]["envelope"],
      warnings: [],
    },
    polynomial_coefficients: {
      status: "ok",
      coefficients,
      used_points: points.length,
      filtered_points: 0,
      warnings: [],
    },
    operating_limits: {
      min_capacity_w: 4000,
      max_capacity_w: 6000,
      min_cop: 2,
      max_cop: 3,
      min_evap_temp_c: -15,
      max_evap_temp_c: 0,
      min_cond_temp_c: 30,
      max_cond_temp_c: 45,
    },
    validation: {
      equilibrium_status: "approved",
      curve_status: "ok",
      polynomial_status: "ok",
      final_status: "approved",
    },
    warnings: overrides?.warnings ?? [],
    traceability: {
      generated_at: "2025-01-01T00:00:00.000Z",
      engine_version: "coldpro_v2",
      source: "calculated",
    },
  };
}

function makeExportMap(): OperatingMapResult {
  const point: OperatingMapPoint = {
    evap_temp_c: -8,
    cond_temp_c: 35,
    capacity_w: 5000,
    cop: 2.78,
    compressor_power_w: 1800,
    status: "approved",
    warnings: [],
  };

  return {
    map_points: [point],
    capacity_isolines: [],
    cop_isolines: [],
    envelope: { feasible_points: [{ evap_temp_c: -8, cond_temp_c: 35 }], rejected_points: [] },
    max_capacity_point: point,
    max_cop_point: point,
    stats: {
      total_points: 1,
      approved_points: 1,
      warning_points: 0,
      rejected_points: 0,
      min_capacity_w: 5000,
      max_capacity_w: 5000,
      min_cop: 2.78,
      max_cop: 2.78,
      min_compressor_power_w: 1800,
      max_compressor_power_w: 1800,
    },
    warnings: [],
  };
}

describe("Product Technical Export Adapter", () => {
  it("exports complete product payload", () => {
    const record = makeExportRecord({ withPoints: true, withCoefficients: true });
    const payload = exportProductTechnicalData({ record });

    expect(payload.schema_version).toBe("coldpro-v2-product-export-v1");
    expect(payload.exported_at).not.toBe("");
    expect(payload.product.model).toBe("EVAP-EXPORT-TEST");
    expect(payload.performance_curve).toHaveLength(2);
    expect(payload.polynomial_coefficients).toHaveLength(1);
    expect(payload.operating_map).toBeUndefined();
  });

  it("does not export internal heavy objects", () => {
    const record = makeExportRecord();
    const payload = exportProductTechnicalData({ record });

    expect(Object.keys(payload)).not.toContain("components");
    expect(Object.keys(payload)).not.toContain("equilibrium");
    expect(Object.keys(payload)).not.toContain("evaporator_result");
  });

  it("includes operating map summary when provided", () => {
    const record = makeExportRecord();
    const map = makeExportMap();
    const payload = exportProductTechnicalData({ record, operating_map: map });

    expect(payload.operating_map).toBeDefined();
    expect(payload.operating_map!.stats.total_points).toBe(1);
    expect(payload.operating_map!.max_capacity_point).not.toBeNull();
    expect(payload.operating_map!.max_cop_point).not.toBeNull();
  });

  it("deduplicates warnings", () => {
    const record = makeExportRecord({
      warnings: ["duplicate warning", "unique warning A"],
    });
    const map = makeExportMap();
    map.warnings = ["duplicate warning", "unique warning B"];

    const payload = exportProductTechnicalData({ record, operating_map: map });

    expect(payload.warnings).toContain("duplicate warning");
    expect(payload.warnings).toContain("unique warning A");
    expect(payload.warnings).toContain("unique warning B");
    expect(payload.warnings.filter((warning) => warning === "duplicate warning")).toHaveLength(1);
  });

  it("throws when record is missing", () => {
    expect(() => exportProductTechnicalData({ record: undefined as never })).toThrow(/required/);
  });
});
