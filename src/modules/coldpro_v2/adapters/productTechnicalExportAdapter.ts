import type { ProductTechnicalExportInput, ProductTechnicalExportPayload } from "../domain/types";

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function exportProductTechnicalData(
  input: ProductTechnicalExportInput,
): ProductTechnicalExportPayload {
  const record = input.record;
  if (!record) throw new Error("ProductTechnicalRecord is required.");

  const validationWarnings: string[] = [];
  if (isBlank(record.identity?.id)) {
    validationWarnings.push("exportProductTechnicalData: record.identity.id is missing.");
  }
  if (isBlank(record.identity?.model)) {
    validationWarnings.push("exportProductTechnicalData: record.identity.model is missing.");
  }
  if (isBlank(record.identity?.family)) {
    validationWarnings.push("exportProductTechnicalData: record.identity.family is missing.");
  }

  return {
    schema_version: input.options?.schema_version ?? "coldpro-v2-product-export-v1",
    exported_at: new Date().toISOString(),
    product: {
      id: record.identity.id,
      model: record.identity.model,
      family: record.identity.family,
      line: record.identity.line,
      refrigerant: record.identity.refrigerant,
      application: record.identity.application,
    },
    validation: record.validation,
    operating_limits: record.operating_limits,
    performance_curve: (record.performance_curve.points ?? []).map((point) => ({
      evap_temp_c: point.evap_temp_c,
      cond_temp_c: point.cond_temp_c,
      capacity_w: point.capacity_w,
      compressor_power_w: point.compressor_power_w,
      cop: point.cop,
      q_cond_w: point.q_cond_w,
      status: point.status,
    })),
    polynomial_coefficients: record.polynomial_coefficients.coefficients ?? [],
    operating_map: input.operating_map
      ? {
          stats: input.operating_map.stats,
          max_capacity_point: input.operating_map.max_capacity_point,
          max_cop_point: input.operating_map.max_cop_point,
        }
      : undefined,
    warnings: Array.from(
      new Set([
        ...(record.warnings ?? []),
        ...(input.operating_map?.warnings ?? []),
        ...validationWarnings,
      ]),
    ),
    traceability: record.traceability,
  };
}
