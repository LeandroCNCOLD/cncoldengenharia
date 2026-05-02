import {
  evaluateSystemEquilibrium,
  generateProductPerformanceCurve,
  generatePolynomialCoefficients,
  buildProductTechnicalRecord,
  generateOperatingMap,
  exportProductTechnicalData,
  createProductTechnicalRegistry,
} from "@/modules/coldpro_v2";

import type {
  SystemComponentsInput,
  SystemEquilibriumResult,
  ProductPerformanceCurveInput,
  ProductPerformanceCurveResult,
  PolynomialGenerationInput,
  PolynomialGenerationResult,
  ProductTechnicalRecordInput,
  ProductTechnicalRecord,
  OperatingMapInput,
  OperatingMapResult,
  ProductTechnicalExportInput,
  ProductTechnicalExportPayload,
  ProductTechnicalRegistryHandle,
} from "@/modules/coldpro_v2";

// Tipo padrão de retorno de todas as funções do service
export type EngineCallResult<T> =
  | { success: true; data: T; warnings: string[] }
  | { success: false; error: string; warnings: string[] };

// Extrai warnings de qualquer resultado do motor
function extractWarnings(result: unknown): string[] {
  if (
    typeof result === "object" &&
    result !== null &&
    "warnings" in result &&
    Array.isArray((result as Record<string, unknown>).warnings)
  ) {
    return (result as { warnings: string[] }).warnings;
  }
  return [];
}

export function runEquilibrium(
  input: SystemComponentsInput,
): EngineCallResult<SystemEquilibriumResult> {
  try {
    const result = evaluateSystemEquilibrium(input);
    return { success: true, data: result, warnings: extractWarnings(result) };
  } catch (e) {
    return { success: false, error: String(e), warnings: [] };
  }
}

export function runPerformanceCurve(
  input: ProductPerformanceCurveInput,
): EngineCallResult<ProductPerformanceCurveResult> {
  try {
    const result = generateProductPerformanceCurve(input);
    return { success: true, data: result, warnings: extractWarnings(result) };
  } catch (e) {
    return { success: false, error: String(e), warnings: [] };
  }
}

export function runPolynomialCoefficients(
  input: PolynomialGenerationInput,
): EngineCallResult<PolynomialGenerationResult> {
  try {
    const result = generatePolynomialCoefficients(input);
    return { success: true, data: result, warnings: extractWarnings(result) };
  } catch (e) {
    return { success: false, error: String(e), warnings: [] };
  }
}

export function runBuildRecord(
  input: ProductTechnicalRecordInput,
): EngineCallResult<ProductTechnicalRecord> {
  try {
    const result = buildProductTechnicalRecord(input);
    return { success: true, data: result, warnings: extractWarnings(result) };
  } catch (e) {
    return { success: false, error: String(e), warnings: [] };
  }
}

export function runOperatingMap(
  input: OperatingMapInput,
): EngineCallResult<OperatingMapResult> {
  try {
    const result = generateOperatingMap(input);
    return { success: true, data: result, warnings: extractWarnings(result) };
  } catch (e) {
    return { success: false, error: String(e), warnings: [] };
  }
}

export function runExportAdapter(
  input: ProductTechnicalExportInput,
): EngineCallResult<ProductTechnicalExportPayload> {
  try {
    const result = exportProductTechnicalData(input);
    return { success: true, data: result, warnings: [] };
  } catch (e) {
    return { success: false, error: String(e), warnings: [] };
  }
}

export function createRegistry(): ProductTechnicalRegistryHandle {
  return createProductTechnicalRegistry();
}
