import type {
  FitQuality,
  PolynomialCoefficientSet,
  PolynomialCoefficients,
  PolynomialGenerationInput,
  PolynomialGenerationResult,
  PolynomialTarget,
  ProductPerformancePoint,
} from "../../domain/types";

type FitPoint = {
  evap_temp_c: number;
  cond_temp_c: number;
  y: number;
};

const DEFAULT_TARGETS: PolynomialTarget[] = ["capacity_w", "compressor_power_w", "cop", "q_cond_w"];

function evaluatePolynomial(
  coeffs: PolynomialCoefficients,
  evap_temp_c: number,
  cond_temp_c: number,
): number {
  return (
    coeffs.a0 +
    coeffs.a1 * evap_temp_c +
    coeffs.a2 * cond_temp_c +
    coeffs.a3 * evap_temp_c * evap_temp_c +
    coeffs.a4 * cond_temp_c * cond_temp_c +
    coeffs.a5 * evap_temp_c * cond_temp_c
  );
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;

  for (let k = 0; k < n; k += 1) {
    let maxRow = k;
    let maxAbs = Math.abs(A[k][k]);

    for (let i = k + 1; i < n; i += 1) {
      const absValue = Math.abs(A[i][k]);
      if (absValue > maxAbs) {
        maxAbs = absValue;
        maxRow = i;
      }
    }

    [A[k], A[maxRow]] = [A[maxRow], A[k]];
    [b[k], b[maxRow]] = [b[maxRow], b[k]];

    if (Math.abs(A[k][k]) < 1e-12) return null;

    const pivot = A[k][k];
    for (let j = 0; j < n; j += 1) {
      A[k][j] /= pivot;
    }
    b[k] /= pivot;

    for (let i = 0; i < n; i += 1) {
      if (i === k) continue;

      const factor = A[i][k];
      for (let j = 0; j < n; j += 1) {
        A[i][j] -= factor * A[k][j];
      }
      b[i] -= factor * b[k];
    }
  }

  return b;
}

function buildPolynomialRow(evap_temp_c: number, cond_temp_c: number): number[] {
  return [
    1,
    evap_temp_c,
    cond_temp_c,
    evap_temp_c * evap_temp_c,
    cond_temp_c * cond_temp_c,
    evap_temp_c * cond_temp_c,
  ];
}

function countUniqueOperatingPoints(points: FitPoint[]): number {
  return new Set(points.map((point) => `${point.evap_temp_c}:${point.cond_temp_c}`)).size;
}

function addDiagonalRegularization(A: number[][]): number[][] {
  const diagonalMean =
    A.reduce((sum, row, index) => sum + Math.abs(row[index]), 0) / Math.max(A.length, 1);
  const lambda = Math.max(diagonalMean * 1e-12, 1e-12);

  return A.map((row, index) => {
    const nextRow = [...row];
    nextRow[index] += lambda;
    return nextRow;
  });
}

function fitPolynomial(points: FitPoint[]): PolynomialCoefficients | null {
  const termCount = 6;
  const A = Array.from({ length: termCount }, () => Array(termCount).fill(0));
  const b = Array(termCount).fill(0);

  for (const point of points) {
    const row = buildPolynomialRow(point.evap_temp_c, point.cond_temp_c);

    for (let i = 0; i < termCount; i += 1) {
      b[i] += row[i] * point.y;

      for (let j = 0; j < termCount; j += 1) {
        A[i][j] += row[i] * row[j];
      }
    }
  }

  const solution = solveLinearSystem(
    A.map((row) => [...row]),
    [...b],
  );

  const stableSolution =
    solution ??
    (countUniqueOperatingPoints(points) >= termCount
      ? solveLinearSystem(addDiagonalRegularization(A), [...b])
      : null);

  if (!stableSolution) return null;

  return {
    a0: stableSolution[0],
    a1: stableSolution[1],
    a2: stableSolution[2],
    a3: stableSolution[3],
    a4: stableSolution[4],
    a5: stableSolution[5],
  };
}

function calculateFitQuality(coeffs: PolynomialCoefficients, points: FitPoint[]): FitQuality {
  const residuals = points.map((point) => {
    const predicted = evaluatePolynomial(coeffs, point.evap_temp_c, point.cond_temp_c);
    return predicted - point.y;
  });

  const ssRes = residuals.reduce((sum, residual) => sum + residual * residual, 0);
  const rmse = Math.sqrt(ssRes / points.length);
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const ssTot = points.reduce((sum, point) => {
    const diff = point.y - yMean;
    return sum + diff * diff;
  }, 0);

  const errorPercentages = residuals
    .map((residual, index) => {
      const actual = points[index].y;
      if (actual === 0) return null;
      return (Math.abs(residual) / Math.abs(actual)) * 100;
    })
    .filter((value): value is number => value !== null);

  return {
    rmse,
    max_error_pct: errorPercentages.length > 0 ? Math.max(...errorPercentages) : 0,
    r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
  };
}

function getTargetValue(point: ProductPerformancePoint, target: PolynomialTarget): number {
  switch (target) {
    case "capacity_w":
      return point.capacity_w;
    case "compressor_power_w":
      return point.compressor_power_w;
    case "cop":
      return point.cop;
    case "q_cond_w":
      return point.q_cond_w;
  }
}

function filterValidPoints(
  points: ProductPerformancePoint[],
  includeWarningPoints: boolean,
  includeRejectedPoints: boolean,
): ProductPerformancePoint[] {
  return points.filter((point) => {
    if (point.status === "approved") return true;
    if (point.status === "warning") return includeWarningPoints;
    return includeRejectedPoints;
  });
}

export function generatePolynomialCoefficients(
  input: PolynomialGenerationInput,
): PolynomialGenerationResult {
  if (!input.points?.length) {
    return {
      status: "error",
      coefficients: [],
      used_points: 0,
      filtered_points: 0,
      warnings: ["generatePolynomialCoefficients: points array cannot be empty."],
    };
  }

  const minPoints = input.options?.min_points ?? 6;
  const includeWarningPoints = input.options?.include_warning_points ?? true;
  const includeRejectedPoints = input.options?.include_rejected_points ?? false;
  const validPoints = filterValidPoints(input.points, includeWarningPoints, includeRejectedPoints);

  if (validPoints.length < minPoints) {
    return {
      status: "error",
      coefficients: [],
      used_points: validPoints.length,
      filtered_points: input.points.length - validPoints.length,
      warnings: [
        `generatePolynomialCoefficients: insufficient valid points. Required: ${minPoints}, available: ${validPoints.length}.`,
      ],
    };
  }

  const targets = input.targets?.length ? input.targets : DEFAULT_TARGETS;
  const warnings: string[] = [];
  const coefficientSets: PolynomialCoefficientSet[] = [];

  for (const target of targets) {
    const fitPoints = validPoints.map((point) => ({
      evap_temp_c: point.evap_temp_c,
      cond_temp_c: point.cond_temp_c,
      y: getTargetValue(point, target),
    }));
    const coefficients = fitPolynomial(fitPoints);

    if (!coefficients) {
      warnings.push(
        `generatePolynomialCoefficients: singular matrix for target "${target}". Skipping.`,
      );
      continue;
    }

    const fitQuality = calculateFitQuality(coefficients, fitPoints);

    if (fitQuality.r2 < 0.95) {
      warnings.push(
        `Target "${target}": R² = ${fitQuality.r2.toFixed(3)} (< 0.95). Polynomial fit may be inaccurate.`,
      );
    }
    if (fitQuality.max_error_pct > 10) {
      warnings.push(
        `Target "${target}": max error = ${fitQuality.max_error_pct.toFixed(1)}% (> 10%). Consider adding more operating points.`,
      );
    }

    coefficientSets.push({
      target,
      coefficients,
      fit_quality: fitQuality,
    });
  }

  return {
    status: coefficientSets.length === 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    coefficients: coefficientSets,
    used_points: validPoints.length,
    filtered_points: input.points.length - validPoints.length,
    warnings,
  };
}
