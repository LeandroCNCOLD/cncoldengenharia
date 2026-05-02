import type {
  OperatingEnvelope,
  OperatingIsoline,
  OperatingMapInput,
  OperatingMapPoint,
  OperatingMapResult,
  OperatingMapStats,
  PerformanceOperatingPoint,
} from "../../domain/types";
import { generateProductPerformanceCurve } from "../performance/productPerformanceCurveEngine";

const EMPTY_ENVELOPE: OperatingEnvelope = {
  feasible_points: [],
  rejected_points: [],
};

const EMPTY_STATS: OperatingMapStats = {
  total_points: 0,
  approved_points: 0,
  warning_points: 0,
  rejected_points: 0,
  min_capacity_w: 0,
  max_capacity_w: 0,
  min_cop: 0,
  max_cop: 0,
  min_compressor_power_w: 0,
  max_compressor_power_w: 0,
};

function buildEmptyResult(warnings: string[]): OperatingMapResult {
  return {
    map_points: [],
    capacity_isolines: [],
    cop_isolines: [],
    envelope: EMPTY_ENVELOPE,
    max_capacity_point: null,
    max_cop_point: null,
    stats: EMPTY_STATS,
    warnings,
  };
}

function hasOnlyFiniteValues(values: number[] | undefined): values is number[] {
  return Array.isArray(values) && values.length > 0 && values.every(Number.isFinite);
}

function validateInput(input: OperatingMapInput): string[] {
  const warnings: string[] = [];

  if (!input.system) warnings.push("generateOperatingMap: system input is required.");
  if (!hasOnlyFiniteValues(input.grid?.evap_temps_c)) {
    warnings.push(
      "generateOperatingMap: grid.evap_temps_c must be a non-empty finite number array.",
    );
  }
  if (!hasOnlyFiniteValues(input.grid?.cond_temps_c)) {
    warnings.push(
      "generateOperatingMap: grid.cond_temps_c must be a non-empty finite number array.",
    );
  }

  return warnings;
}

function buildOperatingPoints(input: OperatingMapInput): PerformanceOperatingPoint[] {
  const operatingPoints: PerformanceOperatingPoint[] = [];

  for (const evap_temp_c of input.grid.evap_temps_c) {
    for (const cond_temp_c of input.grid.cond_temps_c) {
      operatingPoints.push({ evap_temp_c, cond_temp_c });
    }
  }

  return operatingPoints;
}

function buildEnvelope(mapPoints: OperatingMapPoint[]): OperatingEnvelope {
  return {
    feasible_points: mapPoints
      .filter((point) => point.status === "approved" || point.status === "warning")
      .map((point) => ({
        evap_temp_c: point.evap_temp_c,
        cond_temp_c: point.cond_temp_c,
      })),
    rejected_points: mapPoints
      .filter((point) => point.status === "rejected")
      .map((point) => ({
        evap_temp_c: point.evap_temp_c,
        cond_temp_c: point.cond_temp_c,
      })),
  };
}

function findPeakPoint(
  points: OperatingMapPoint[],
  valueSelector: (point: OperatingMapPoint) => number,
): OperatingMapPoint | null {
  if (points.length === 0) return null;

  return points.reduce((best, point) =>
    valueSelector(point) > valueSelector(best) ? point : best,
  );
}

function buildIsolineValues(minValue: number, maxValue: number, count: number): number[] {
  if (count <= 1) return [minValue, maxValue];

  const step = (maxValue - minValue) / (count - 1);
  return Array.from({ length: count }, (_, index) => minValue + step * index);
}

function buildIsolines(
  feasiblePoints: OperatingMapPoint[],
  count: number,
  valueSelector: (point: OperatingMapPoint) => number,
  labelBuilder: (value: number) => string,
): OperatingIsoline[] {
  if (feasiblePoints.length === 0) return [];

  const values = feasiblePoints.map(valueSelector);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  if (minValue >= maxValue) return [];

  const isolineCount = Math.max(Math.floor(count), 2);
  const step = (maxValue - minValue) / (isolineCount - 1);

  return buildIsolineValues(minValue, maxValue, isolineCount)
    .map((isolineValue) => {
      const matchingPoints = feasiblePoints
        .filter((point) => Math.abs(valueSelector(point) - isolineValue) <= step * 0.5)
        .map((point) => ({
          evap_temp_c: point.evap_temp_c,
          cond_temp_c: point.cond_temp_c,
        }));

      return {
        label: labelBuilder(isolineValue),
        value: isolineValue,
        points: matchingPoints,
      };
    })
    .filter((isoline) => isoline.points.length >= 2);
}

function computeStats(
  mapPoints: OperatingMapPoint[],
  feasiblePoints: OperatingMapPoint[],
): OperatingMapStats {
  const capacities = feasiblePoints.map((point) => point.capacity_w);
  const cops = feasiblePoints.map((point) => point.cop);
  const compressorPowers = feasiblePoints.map((point) => point.compressor_power_w);

  return {
    total_points: mapPoints.length,
    approved_points: mapPoints.filter((point) => point.status === "approved").length,
    warning_points: mapPoints.filter((point) => point.status === "warning").length,
    rejected_points: mapPoints.filter((point) => point.status === "rejected").length,
    min_capacity_w: capacities.length > 0 ? Math.min(...capacities) : 0,
    max_capacity_w: capacities.length > 0 ? Math.max(...capacities) : 0,
    min_cop: cops.length > 0 ? Math.min(...cops) : 0,
    max_cop: cops.length > 0 ? Math.max(...cops) : 0,
    min_compressor_power_w: compressorPowers.length > 0 ? Math.min(...compressorPowers) : 0,
    max_compressor_power_w: compressorPowers.length > 0 ? Math.max(...compressorPowers) : 0,
  };
}

function resolveIsolineCount(
  value: number | undefined,
  optionName: "capacity_isoline_count" | "cop_isoline_count",
  warnings: string[],
): number {
  if (value === undefined) return 5;

  if (value < 2) {
    warnings.push(`${optionName}=${value} is invalid (minimum 2). Using default of 5.`);
    return 5;
  }

  return value;
}

export function generateOperatingMap(input: OperatingMapInput): OperatingMapResult {
  const validationWarnings = validateInput(input);
  if (validationWarnings.length > 0) return buildEmptyResult(validationWarnings);
  const optionWarnings: string[] = [];
  const capacityIsolineCount = resolveIsolineCount(
    input.options?.capacity_isoline_count,
    "capacity_isoline_count",
    optionWarnings,
  );
  const copIsolineCount = resolveIsolineCount(
    input.options?.cop_isoline_count,
    "cop_isoline_count",
    optionWarnings,
  );

  const operatingPoints = buildOperatingPoints(input);
  const curve = generateProductPerformanceCurve({
    system: input.system,
    operating_points: operatingPoints,
    options: {
      stop_on_rejection: input.options?.stop_on_rejection ?? false,
    },
  });

  const mapPoints: OperatingMapPoint[] = curve.points.map((point) => ({
    evap_temp_c: point.evap_temp_c,
    cond_temp_c: point.cond_temp_c,
    capacity_w: point.capacity_w,
    cop: point.cop,
    compressor_power_w: point.compressor_power_w,
    status: point.status,
    warnings: point.warnings ?? [],
  }));
  const envelope = buildEnvelope(mapPoints);
  const feasiblePoints = mapPoints.filter(
    (point) => point.status === "approved" || point.status === "warning",
  );

  return {
    map_points: mapPoints,
    capacity_isolines: buildIsolines(
      feasiblePoints,
      capacityIsolineCount,
      (point) => point.capacity_w,
      (value) => `${Math.round(value)} W`,
    ),
    cop_isolines: buildIsolines(
      feasiblePoints,
      copIsolineCount,
      (point) => point.cop,
      (value) => `COP ${value.toFixed(2)}`,
    ),
    envelope,
    max_capacity_point: findPeakPoint(feasiblePoints, (point) => point.capacity_w),
    max_cop_point: findPeakPoint(feasiblePoints, (point) => point.cop),
    stats: computeStats(mapPoints, feasiblePoints),
    warnings: Array.from(
      new Set([...validationWarnings, ...optionWarnings, ...(curve.warnings ?? [])]),
    ),
  };
}
