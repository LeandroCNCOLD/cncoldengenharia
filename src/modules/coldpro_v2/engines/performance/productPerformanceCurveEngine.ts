import type {
  PerformanceEnvelope,
  PerformanceSummary,
  ProductPerformanceCurveInput,
  ProductPerformanceCurveResult,
  ProductPerformancePoint,
  SystemComponentsInput,
} from "../../domain/types";
import { evaluateSystemEquilibrium } from "../equilibrium/systemEquilibriumEngine";

function safeDivide(num: number, den: number): number {
  if (!den || den === 0) return 0;
  return num / den;
}

const EMPTY_SUMMARY: PerformanceSummary = {
  total_points: 0,
  approved_points: 0,
  warning_points: 0,
  rejected_points: 0,
  executed_points: 0,
};

const EMPTY_ENVELOPE: PerformanceEnvelope = {
  min_capacity_w: 0,
  max_capacity_w: 0,
  min_cop: 0,
  max_cop: 0,
};

function buildSystemForPoint(
  input: ProductPerformanceCurveInput,
  evap_temp_c: number,
  cond_temp_c: number,
): SystemComponentsInput {
  return {
    ...input.system,
    compressor: {
      ...input.system.compressor,
      evap_temp_c,
      cond_temp_c,
    },
    evaporator: {
      progressive_input: {
        ...input.system.evaporator.progressive_input,
        rolls: input.system.evaporator.progressive_input.rolls.map((roll) => ({ ...roll })),
        T_evaporating_c: evap_temp_c,
      },
    },
    condenser: { ...input.system.condenser },
    evaporator_fan: input.system.evaporator_fan ? { ...input.system.evaporator_fan } : undefined,
    condenser_fan: input.system.condenser_fan ? { ...input.system.condenser_fan } : undefined,
    expansion_valve: input.system.expansion_valve ? { ...input.system.expansion_valve } : undefined,
    four_way_valve: input.system.four_way_valve ? { ...input.system.four_way_valve } : undefined,
    system_conditions: { ...input.system.system_conditions },
  };
}

function calculateEnvelope(points: ProductPerformancePoint[]): PerformanceEnvelope {
  const validPoints = points.filter((point) => point.capacity_w > 0);

  if (validPoints.length === 0) return EMPTY_ENVELOPE;

  const capacities = validPoints.map((point) => point.capacity_w);
  const cops = validPoints.map((point) => point.cop);

  return {
    min_capacity_w: Math.min(...capacities),
    max_capacity_w: Math.max(...capacities),
    min_cop: Math.min(...cops),
    max_cop: Math.max(...cops),
  };
}

function calculateSummary(
  totalPoints: number,
  points: ProductPerformancePoint[],
): PerformanceSummary {
  return {
    total_points: totalPoints,
    executed_points: points.length,
    approved_points: points.filter((point) => point.status === "approved").length,
    warning_points: points.filter((point) => point.status === "warning").length,
    rejected_points: points.filter((point) => point.status === "rejected").length,
  };
}

function calculateStatus(
  summary: PerformanceSummary,
  globalWarnings: string[],
): ProductPerformanceCurveResult["status"] {
  if (summary.executed_points === 0 || summary.rejected_points === summary.executed_points) {
    return "error";
  }

  if (summary.rejected_points > 0 || globalWarnings.length > 0) return "warning";

  return "ok";
}

export function generateProductPerformanceCurve(
  input: ProductPerformanceCurveInput,
): ProductPerformanceCurveResult {
  if (!input.system) {
    return {
      status: "error",
      points: [],
      summary: EMPTY_SUMMARY,
      envelope: EMPTY_ENVELOPE,
      warnings: ["generateProductPerformanceCurve: system input is required."],
    };
  }

  if (!input.operating_points?.length) {
    return {
      status: "error",
      points: [],
      summary: EMPTY_SUMMARY,
      envelope: EMPTY_ENVELOPE,
      warnings: ["generateProductPerformanceCurve: operating_points cannot be empty."],
    };
  }

  const points: ProductPerformancePoint[] = [];
  const globalWarnings: string[] = [];

  for (const point of input.operating_points) {
    const systemForPoint = buildSystemForPoint(input, point.evap_temp_c, point.cond_temp_c);
    const equilibriumResult = evaluateSystemEquilibrium(systemForPoint);

    const capacity_w = equilibriumResult.thermal_balance.q_evap_w;
    const compressor_power_w = equilibriumResult.thermal_balance.compressor_power_w;

    points.push({
      evap_temp_c: point.evap_temp_c,
      cond_temp_c: point.cond_temp_c,
      capacity_w,
      compressor_power_w,
      cop: safeDivide(capacity_w, compressor_power_w),
      q_cond_w: equilibriumResult.thermal_balance.q_cond_required_w,
      balance_error_pct: equilibriumResult.thermal_balance.balance_error_pct,
      status: equilibriumResult.status,
      utilization: equilibriumResult.utilization,
      warnings: equilibriumResult.warnings,
      bottleneck_codes: equilibriumResult.bottleneck_codes,
    });

    if (input.options?.stop_on_rejection === true && equilibriumResult.status === "rejected") {
      globalWarnings.push("Curve generation stopped at first rejected point.");
      break;
    }
  }

  const envelope = calculateEnvelope(points);
  const summary = calculateSummary(input.operating_points.length, points);
  const validPoints = points.filter((point) => point.capacity_w > 0);

  if (
    summary.executed_points > 0 &&
    safeDivide(summary.rejected_points, summary.executed_points) > 0.3
  ) {
    const rejectionPct = Math.round(
      safeDivide(summary.rejected_points, summary.executed_points) * 100,
    );
    globalWarnings.push(
      `${summary.rejected_points} of ${summary.executed_points} points rejected (>${rejectionPct}%). System may be undersized for part of the operating range.`,
    );
  }

  if (validPoints.length >= 2) {
    const copVariation = safeDivide(envelope.max_cop - envelope.min_cop, envelope.min_cop) * 100;
    if (copVariation > 50) {
      globalWarnings.push(
        `COP varies by ${Math.round(copVariation)}% across operating points. Verify component sizing consistency.`,
      );
    }

    const capacityVariation =
      safeDivide(envelope.max_capacity_w - envelope.min_capacity_w, envelope.min_capacity_w) * 100;
    if (capacityVariation > 80) {
      globalWarnings.push(
        `Capacity varies by ${Math.round(capacityVariation)}% across operating points. Large variation may indicate instability.`,
      );
    }
  }

  return {
    status: calculateStatus(summary, globalWarnings),
    points,
    summary,
    envelope,
    warnings: globalWarnings,
  };
}
