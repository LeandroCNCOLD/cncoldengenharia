import { describe, expect, it } from "vitest";
import type { ProductTechnicalRecord } from "../domain/types";
import { createProductTechnicalRegistry } from "../database/productTechnicalRegistry";

function makeRecord(
  id: string,
  model: string,
  overrides?: Partial<{
    family: string;
    line: string;
    refrigerant: string;
    application: string;
    final_status: "approved" | "warning" | "rejected";
    min_capacity_w: number;
    max_capacity_w: number;
    min_cop: number;
    max_cop: number;
    min_evap_temp_c: number;
    max_evap_temp_c: number;
    min_cond_temp_c: number;
    max_cond_temp_c: number;
  }>,
): ProductTechnicalRecord {
  return {
    identity: {
      id,
      model,
      family: overrides?.family ?? "Test Family",
      line: overrides?.line ?? "Test Line",
      refrigerant: overrides?.refrigerant ?? "R404A",
      application: overrides?.application,
    },
    components: {} as ProductTechnicalRecord["components"],
    equilibrium: {} as ProductTechnicalRecord["equilibrium"],
    performance_curve: {
      points: [],
      status: "ok",
      summary: {} as ProductTechnicalRecord["performance_curve"]["summary"],
      envelope: {} as ProductTechnicalRecord["performance_curve"]["envelope"],
      warnings: [],
    },
    polynomial_coefficients: {
      coefficients: [],
      status: "ok",
      used_points: 0,
      filtered_points: 0,
      warnings: [],
    },
    operating_limits: {
      min_capacity_w: overrides?.min_capacity_w ?? 3000,
      max_capacity_w: overrides?.max_capacity_w ?? 6000,
      min_cop: overrides?.min_cop ?? 1.5,
      max_cop: overrides?.max_cop ?? 3.0,
      min_evap_temp_c: overrides?.min_evap_temp_c ?? -15,
      max_evap_temp_c: overrides?.max_evap_temp_c ?? 0,
      min_cond_temp_c: overrides?.min_cond_temp_c ?? 30,
      max_cond_temp_c: overrides?.max_cond_temp_c ?? 45,
    },
    validation: {
      equilibrium_status: "approved",
      curve_status: "ok",
      polynomial_status: "ok",
      final_status: overrides?.final_status ?? "approved",
    },
    warnings: [],
    traceability: {
      generated_at: new Date().toISOString(),
      engine_version: "coldpro_v2",
      source: "calculated",
    },
  };
}

describe("Product Technical Registry", () => {
  it("adds and retrieves by id and model", () => {
    const registry = createProductTechnicalRegistry();
    const record = makeRecord("REC-001", "EVAP-4T-R404A");

    const result = registry.add(record);

    expect(result.status).toBe("added");
    expect(registry.getById("REC-001")).toBe(record);
    expect(registry.getByModel("EVAP-4T-R404A")).toBe(record);
  });

  it("blocks duplicate ids and models", () => {
    const registry = createProductTechnicalRegistry();

    registry.add(makeRecord("REC-001", "EVAP-4T-R404A"));
    const duplicateId = registry.add(makeRecord("REC-001", "EVAP-OTHER"));
    const duplicateModel = registry.add(makeRecord("REC-002", "EVAP-4T-R404A"));

    expect(duplicateId.status).toBe("duplicate");
    expect(duplicateModel.status).toBe("duplicate");
  });

  it("filters records by technical fields", () => {
    const registry = createProductTechnicalRegistry([
      makeRecord("A", "M-A", {
        family: "Evaporadores",
        line: "CN COLD",
        refrigerant: "R404A",
        final_status: "approved",
      }),
      makeRecord("B", "M-B", {
        family: "Condensadores",
        line: "CN COLD",
        refrigerant: "R22",
        final_status: "warning",
      }),
      makeRecord("C", "M-C", {
        family: "Evaporadores",
        line: "AGRO",
        refrigerant: "R404A",
        final_status: "rejected",
      }),
    ]);

    expect(registry.filter({ family: "Evaporadores" })).toHaveLength(2);
    expect(registry.filter({ line: "CN COLD" })).toHaveLength(2);
    expect(registry.filter({ refrigerant: "R404A" })).toHaveLength(2);
    expect(registry.filter({ final_status: "approved" })).toHaveLength(1);
    expect(registry.filter({})).toHaveLength(3);
  });

  it("compares operating limits", () => {
    const registry = createProductTechnicalRegistry([
      makeRecord("X1", "MODEL-X1", {
        min_capacity_w: 3000,
        max_capacity_w: 5000,
        min_cop: 1.8,
        max_cop: 2.8,
      }),
      makeRecord("X2", "MODEL-X2", {
        min_capacity_w: 4000,
        max_capacity_w: 7000,
        min_cop: 2,
        max_cop: 3.2,
      }),
    ]);

    const all = registry.compare();
    const onlyX1 = registry.compare(["X1"]);

    expect(all).toHaveLength(2);
    expect(all[0].model).toBeDefined();
    expect(all[0].min_capacity_w).toBeDefined();
    expect(all[0].max_capacity_w).toBeDefined();
    expect(all[0].min_cop).toBeDefined();
    expect(all[0].max_cop).toBeDefined();
    expect(onlyX1).toHaveLength(1);
    expect(registry.compare(["NONEXISTENT"])).toHaveLength(0);
  });

  it("returns registry statistics", () => {
    const registry = createProductTechnicalRegistry([
      makeRecord("S1", "MS1", {
        final_status: "approved",
        family: "Evap",
        line: "CN COLD",
        refrigerant: "R404A",
      }),
      makeRecord("S2", "MS2", {
        final_status: "warning",
        family: "Evap",
        line: "AGRO",
        refrigerant: "R22",
      }),
      makeRecord("S3", "MS3", {
        final_status: "rejected",
        family: "Cond",
        line: "CN COLD",
        refrigerant: "R404A",
      }),
    ]);

    const stats = registry.stats();

    expect(stats.total).toBe(3);
    expect(stats.approved).toBe(1);
    expect(stats.warning).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.by_family["Evap"]).toBe(2);
    expect(stats.by_family["Cond"]).toBe(1);
    expect(stats.by_line["CN COLD"]).toBe(2);
    expect(stats.by_refrigerant["R404A"]).toBe(2);
  });

  it("addMany does not abort all records", () => {
    const registry = createProductTechnicalRegistry();
    const invalid = makeRecord("", "");

    const results = registry.addMany([
      makeRecord("VALID-1", "VALID-MODEL-1"),
      makeRecord("VALID-1", "VALID-MODEL-2"),
      invalid,
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("added");
    expect(results[1].status).toBe("duplicate");
    expect(results[2].status).toBe("error");
  });
});
