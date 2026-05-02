import { describe, expect, it } from "vitest";
import type {
  ComponentUtilization,
  ProductPerformancePoint,
  ProgressiveCoilInput,
  SystemComponentsInput,
} from "../domain/types";
import { generateProductPerformanceCurve } from "../engines/performance/productPerformanceCurveEngine";
import { generatePolynomialCoefficients } from "../engines/polynomial/polynomialCoefficientGenerator";

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

const NINE_POINT_GRID = [
  { evap_temp_c: -15, cond_temp_c: 30 },
  { evap_temp_c: -15, cond_temp_c: 35 },
  { evap_temp_c: -15, cond_temp_c: 40 },
  { evap_temp_c: -8, cond_temp_c: 30 },
  { evap_temp_c: -8, cond_temp_c: 35 },
  { evap_temp_c: -8, cond_temp_c: 40 },
  { evap_temp_c: -2, cond_temp_c: 30 },
  { evap_temp_c: -2, cond_temp_c: 35 },
  { evap_temp_c: -2, cond_temp_c: 40 },
];

const SIXTEEN_POINT_GRID = [
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

function generateCurve(operatingPoints: typeof NINE_POINT_GRID) {
  return generateProductPerformanceCurve({
    system: BASE_SYSTEM,
    operating_points: operatingPoints,
  });
}

function generateNinePointCurve() {
  return generateCurve(NINE_POINT_GRID);
}

function generateSixteenPointCurve() {
  return generateCurve(SIXTEEN_POINT_GRID);
}

function evaluateCapacity(
  coefficients: {
    a0: number;
    a1: number;
    a2: number;
    a3: number;
    a4: number;
    a5: number;
  },
  point: ProductPerformancePoint,
): number {
  return (
    coefficients.a0 +
    coefficients.a1 * point.evap_temp_c +
    coefficients.a2 * point.cond_temp_c +
    coefficients.a3 * point.evap_temp_c * point.evap_temp_c +
    coefficients.a4 * point.cond_temp_c * point.cond_temp_c +
    coefficients.a5 * point.evap_temp_c * point.cond_temp_c
  );
}

describe("Polynomial Coefficient Generator", () => {
  it("generates coefficients with sixteen operating points", () => {
    const curve = generateSixteenPointCurve();
    const result = generatePolynomialCoefficients({
      points: curve.points,
      options: { include_rejected_points: true },
    });

    expect(["ok", "warning"]).toContain(result.status);
    expect(result.coefficients).toHaveLength(4);
    expect(result.used_points).toBeGreaterThanOrEqual(6);
    result.coefficients.forEach((set) => {
      expect(Number.isFinite(set.fit_quality.r2)).toBe(true);
      expect(set.fit_quality.rmse).toBeGreaterThanOrEqual(0);
    });
    expect(
      result.warnings.some((warning) => warning.includes("AHRI") || warning.includes("EN 12900")),
    ).toBe(false);
  });

  it("fails with fewer than six points", () => {
    const threePoints: ProductPerformancePoint[] = [
      {
        evap_temp_c: -10,
        cond_temp_c: 35,
        capacity_w: 4000,
        compressor_power_w: 1600,
        cop: 2.5,
        q_cond_w: 5600,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -8,
        cond_temp_c: 35,
        capacity_w: 4200,
        compressor_power_w: 1700,
        cop: 2.47,
        q_cond_w: 5900,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -5,
        cond_temp_c: 35,
        capacity_w: 4500,
        compressor_power_w: 1800,
        cop: 2.5,
        q_cond_w: 6300,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
    ];

    const result = generatePolynomialCoefficients({ points: threePoints });

    expect(result.status).toBe("error");
    expect(result.warnings[0]).toMatch(/insufficient|min_points/);
    expect(result.coefficients).toHaveLength(0);
  });

  it("approximates a real training point with the capacity polynomial", () => {
    const curve = generateSixteenPointCurve();
    const result = generatePolynomialCoefficients({
      points: curve.points,
      targets: ["capacity_w"],
      options: { include_rejected_points: true },
    });
    const capacitySet = result.coefficients.find((set) => set.target === "capacity_w");
    const trainingPoint = curve.points[4];

    expect(capacitySet).toBeDefined();
    const yPred = evaluateCapacity(capacitySet!.coefficients, trainingPoint);
    const errorPct = (Math.abs(yPred - trainingPoint.capacity_w) / trainingPoint.capacity_w) * 100;

    expect(errorPct).toBeLessThan(15);
  });

  it("does not use rejected points by default", () => {
    const mixedPoints: ProductPerformancePoint[] = [
      {
        evap_temp_c: -15,
        cond_temp_c: 30,
        capacity_w: 3500,
        compressor_power_w: 1500,
        cop: 2.33,
        q_cond_w: 5000,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -15,
        cond_temp_c: 35,
        capacity_w: 3300,
        compressor_power_w: 1550,
        cop: 2.13,
        q_cond_w: 4850,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -10,
        cond_temp_c: 30,
        capacity_w: 4000,
        compressor_power_w: 1600,
        cop: 2.5,
        q_cond_w: 5600,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -10,
        cond_temp_c: 35,
        capacity_w: 3800,
        compressor_power_w: 1650,
        cop: 2.3,
        q_cond_w: 5450,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -5,
        cond_temp_c: 30,
        capacity_w: 4500,
        compressor_power_w: 1700,
        cop: 2.65,
        q_cond_w: 6200,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -5,
        cond_temp_c: 35,
        capacity_w: 4200,
        compressor_power_w: 1750,
        cop: 2.4,
        q_cond_w: 5950,
        balance_error_pct: 2,
        status: "approved",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: [],
      },
      {
        evap_temp_c: -2,
        cond_temp_c: 50,
        capacity_w: 0,
        compressor_power_w: 0,
        cop: 0,
        q_cond_w: 0,
        balance_error_pct: 99,
        status: "rejected",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: ["condenser_undersized"],
      },
      {
        evap_temp_c: -2,
        cond_temp_c: 55,
        capacity_w: 0,
        compressor_power_w: 0,
        cop: 0,
        q_cond_w: 0,
        balance_error_pct: 99,
        status: "rejected",
        utilization: {} as ComponentUtilization,
        warnings: [],
        bottleneck_codes: ["condenser_undersized"],
      },
    ];

    const result = generatePolynomialCoefficients({ points: mixedPoints });

    expect(result.filtered_points).toBe(2);
    expect(result.used_points).toBe(6);
    expect(["ok", "warning"]).toContain(result.status);
  });

  it("returns valid fit quality metrics for all targets", () => {
    const curve = generateSixteenPointCurve();
    const result = generatePolynomialCoefficients({
      points: curve.points,
      options: { include_rejected_points: true },
    });

    result.coefficients.forEach((set) => {
      expect(set.fit_quality.rmse).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(set.fit_quality.r2)).toBe(false);
      expect(set.fit_quality.r2).not.toBeUndefined();
      expect(set.fit_quality.max_error_pct).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(set.coefficients.a0)).toBe(false);
      expect(set.coefficients.a0).not.toBeUndefined();
    });
  });

  it("emits AHRI/EN 12900 warning when fewer than nine points are used", () => {
    const curve = generateNinePointCurve();
    const sevenPoints = curve.points.slice(0, 7);

    const result = generatePolynomialCoefficients({
      points: sevenPoints,
      options: { include_rejected_points: true },
    });

    expect(["ok", "warning"]).toContain(result.status);
    expect(result.used_points).toBe(7);
    expect(
      result.warnings.some((warning) => warning.includes("AHRI") || warning.includes("EN 12900")),
    ).toBe(true);
  });
});
