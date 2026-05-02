import type {
  PerformanceEnvelope,
  PolynomialGenerationResult,
  ProductOperatingLimits,
  ProductPerformanceCurveResult,
  ProductTechnicalRecord,
  ProductTechnicalRecordInput,
  ProductValidationSummary,
  ProgressiveCoilResult,
  SystemEquilibriumResult,
} from "../domain/types";
import { evaluateSystemEquilibrium } from "../engines/equilibrium/systemEquilibriumEngine";
import { generateProductPerformanceCurve } from "../engines/performance/productPerformanceCurveEngine";
import { generatePolynomialCoefficients } from "../engines/polynomial/polynomialCoefficientGenerator";

const ZERO_LIMITS: ProductOperatingLimits = {
  min_evap_temp_c: 0,
  max_evap_temp_c: 0,
  min_cond_temp_c: 0,
  max_cond_temp_c: 0,
  min_capacity_w: 0,
  max_capacity_w: 0,
  min_cop: 0,
  max_cop: 0,
};

const EMPTY_ENVELOPE: PerformanceEnvelope = {
  min_capacity_w: 0,
  max_capacity_w: 0,
  min_cop: 0,
  max_cop: 0,
};

function buildEmptyProgressiveCoilResult(): ProgressiveCoilResult {
  return {
    status: "error",
    warnings: [],
    rolls: [],
    total_capacity_w: 0,
    total_air_pressure_drop_pa: 0,
    total_condensation_rate_kg_s: 0,
    air_temperature_out_c: 0,
    air_relative_humidity_out: 0,
    W_out_kg_kg: 0,
    enthalpy_out_j_kg: 0,
    estimated_time_to_defrost_h: null,
    energy_balance_error_pct: 0,
  };
}

function buildRejectedEquilibrium(warnings: string[]): SystemEquilibriumResult {
  return {
    status: "rejected",
    thermal_balance: {
      q_evap_w: 0,
      q_cond_required_w: 0,
      q_cond_available_w: 0,
      compressor_power_w: 0,
      balance_error_pct: 0,
    },
    utilization: { compressor_pct: 0, evaporator_pct: 0, condenser_pct: 0 },
    bottleneck_codes: ["invalid_product_technical_record_input"],
    bottlenecks: warnings,
    warnings,
    recommendations: [],
    evaporator_result: buildEmptyProgressiveCoilResult(),
  };
}

function buildEmptyPerformanceCurve(warnings: string[]): ProductPerformanceCurveResult {
  return {
    status: "error",
    points: [],
    summary: {
      total_points: 0,
      approved_points: 0,
      warning_points: 0,
      rejected_points: 0,
      executed_points: 0,
    },
    envelope: EMPTY_ENVELOPE,
    warnings,
  };
}

function buildEmptyPolynomialResult(warnings: string[]): PolynomialGenerationResult {
  return {
    status: "error",
    coefficients: [],
    used_points: 0,
    filtered_points: 0,
    warnings,
  };
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function validateInput(input: ProductTechnicalRecordInput): string[] {
  const warnings: string[] = [];

  if (isBlank(input.identity?.id))
    warnings.push("buildProductTechnicalRecord: identity.id is required.");
  if (isBlank(input.identity?.model))
    warnings.push("buildProductTechnicalRecord: identity.model is required.");
  if (isBlank(input.identity?.family))
    warnings.push("buildProductTechnicalRecord: identity.family is required.");
  if (isBlank(input.identity?.line))
    warnings.push("buildProductTechnicalRecord: identity.line is required.");
  if (isBlank(input.identity?.refrigerant))
    warnings.push("buildProductTechnicalRecord: identity.refrigerant is required.");
  if (!input.system) warnings.push("buildProductTechnicalRecord: system input is required.");
  if (!input.operating_points?.length)
    warnings.push("buildProductTechnicalRecord: operating_points cannot be empty.");

  return warnings;
}

function buildTraceability(
  input: ProductTechnicalRecordInput,
): ProductTechnicalRecord["traceability"] {
  return {
    generated_at: new Date().toISOString(),
    engine_version: input.options?.engine_version ?? "coldpro_v2",
    source: input.options?.source ?? "calculated",
  };
}

function calculateOperatingLimits(curve: ProductPerformanceCurveResult): {
  limits: ProductOperatingLimits;
  warnings: string[];
} {
  const validPoints = curve.points.filter(
    (point) =>
      (point.status === "approved" || point.status === "warning") &&
      point.capacity_w > 0 &&
      point.compressor_power_w > 0 &&
      point.cop > 0,
  );

  if (validPoints.length === 0) {
    return {
      limits: ZERO_LIMITS,
      warnings: [
        "buildProductTechnicalRecord: no valid operating points found for limit calculation.",
      ],
    };
  }

  return {
    limits: {
      min_evap_temp_c: Math.min(...validPoints.map((point) => point.evap_temp_c)),
      max_evap_temp_c: Math.max(...validPoints.map((point) => point.evap_temp_c)),
      min_cond_temp_c: Math.min(...validPoints.map((point) => point.cond_temp_c)),
      max_cond_temp_c: Math.max(...validPoints.map((point) => point.cond_temp_c)),
      min_capacity_w: Math.min(...validPoints.map((point) => point.capacity_w)),
      max_capacity_w: Math.max(...validPoints.map((point) => point.capacity_w)),
      min_cop: Math.min(...validPoints.map((point) => point.cop)),
      max_cop: Math.max(...validPoints.map((point) => point.cop)),
    },
    warnings: [],
  };
}

function calculateValidation(
  equilibrium: SystemEquilibriumResult,
  performanceCurve: ProductPerformanceCurveResult,
  polynomialCoefficients: PolynomialGenerationResult,
): ProductValidationSummary {
  const equilibriumStatus = equilibrium.status;
  const curveStatus = performanceCurve.status;
  const polynomialStatus = polynomialCoefficients.status;

  let finalStatus: ProductValidationSummary["final_status"];
  if (equilibriumStatus === "rejected" || curveStatus === "error" || polynomialStatus === "error") {
    finalStatus = "rejected";
  } else if (
    equilibriumStatus === "warning" ||
    curveStatus === "warning" ||
    polynomialStatus === "warning"
  ) {
    finalStatus = "warning";
  } else {
    finalStatus = "approved";
  }

  return {
    equilibrium_status: equilibriumStatus,
    curve_status: curveStatus,
    polynomial_status: polynomialStatus,
    final_status: finalStatus,
  };
}

function mergeWarnings(...warningGroups: string[][]): string[] {
  return Array.from(new Set(warningGroups.flat()));
}

export function buildProductTechnicalRecord(
  input: ProductTechnicalRecordInput,
): ProductTechnicalRecord {
  const initialWarnings = validateInput(input);
  const traceability = buildTraceability(input);

  if (initialWarnings.length > 0) {
    const equilibrium = buildRejectedEquilibrium(initialWarnings);
    const performanceCurve = buildEmptyPerformanceCurve(initialWarnings);
    const polynomialCoefficients = buildEmptyPolynomialResult(initialWarnings);

    return {
      identity: input.identity,
      components: input.system,
      equilibrium,
      performance_curve: performanceCurve,
      polynomial_coefficients: polynomialCoefficients,
      operating_limits: ZERO_LIMITS,
      validation: {
        equilibrium_status: "rejected",
        curve_status: "error",
        polynomial_status: "error",
        final_status: "rejected",
      },
      warnings: initialWarnings,
      traceability,
    };
  }

  const equilibrium = evaluateSystemEquilibrium(input.system);
  const performanceCurve = generateProductPerformanceCurve({
    system: input.system,
    operating_points: input.operating_points,
    options: {
      stop_on_rejection: input.options?.stop_on_rejection ?? false,
    },
  });
  const polynomialCoefficients = generatePolynomialCoefficients({
    points: performanceCurve.points,
  });
  const { limits: operatingLimits, warnings: limitWarnings } =
    calculateOperatingLimits(performanceCurve);
  const validation = calculateValidation(equilibrium, performanceCurve, polynomialCoefficients);
  const warnings = mergeWarnings(
    initialWarnings,
    equilibrium.warnings ?? [],
    performanceCurve.warnings ?? [],
    polynomialCoefficients.warnings ?? [],
    limitWarnings,
  );

  return {
    identity: input.identity,
    components: input.system,
    equilibrium,
    performance_curve: performanceCurve,
    polynomial_coefficients: polynomialCoefficients,
    operating_limits: operatingLimits,
    validation,
    warnings,
    traceability,
  };
}
