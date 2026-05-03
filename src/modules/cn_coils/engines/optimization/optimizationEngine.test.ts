import { describe, expect, it, vi } from "vitest";
import { runOptimization } from "./optimizationEngine";
import type { CoilCycleInputs } from "../coil/coilCycleAdapter";

vi.mock("../coil/coilCycleAdapter", () => ({
  runCoilForCycle: vi.fn().mockImplementation(async (inputs: CoilCycleInputs) => {
    const rows = inputs.physical.rows;
    const fp = inputs.physical.finPitchMm;
    const circuits = inputs.physical.circuits;
    const capacity = 8000 * rows * (6 / fp) * Math.sqrt(circuits / 5);
    const dp = 50 * rows * (6 / fp) ** 2;
    return {
      totalCapacityW: capacity,
      sensibleCapacityW: capacity * 0.7,
      latentCapacityW: capacity * 0.3,
      airOutletTempC: 2,
      airOutletRH: 0.9,
      airPressureDropPa: dp,
      fluidPressureDropKPa: 10,
      overallU_WM2K: 25 + rows * 2,
      safetyFactor: 1,
      refrigerantOutletTempC: -5,
      inletQuality: 0.1,
      success: true,
      warnings: [],
    };
  }),
}));

const baseInputs: CoilCycleInputs = {
  physical: {
    rows: 4,
    finnedLengthMm: 1250,
    finnedHeightMm: 400,
    finPitchMm: 6,
    tubePitchTransversalMm: 38.1,
    tubePitchLongitudinalMm: 33,
    tubeExternalDiameterMm: 12.7,
    tubeInternalDiameterMm: 11.5,
    tubesPerRow: 10,
    circuits: 5,
    finThicknessMm: 0.15,
    finType: "plain",
  },
  airFlowM3H: 2500,
  refrigerantId: "R404A",
  evaporatingTempC: -10,
  condensingTempC: 40,
  refrigerantMassFlowKgS: 0.055,
  airInletTempC: 5,
  airRelativeHumidity: 0.85,
  componentType: "evaporator",
  superheatK: 5,
  subcoolingK: 5,
  tubeMaterialConductivity: 385,
  htCatalog: {},
};

describe("runOptimization", () => {
  it("deve encontrar solução factível para capacidade mínima de 10 kW", async () => {
    const result = await runOptimization(baseInputs, {
      objective: "minimize_weight",
      constraints: { minCapacityW: 10000 },
      searchSpace: {
        rowsOptions: [3, 4, 5],
        finPitchOptions: [5, 6, 7],
        maxEvaluations: 50,
      },
    });

    expect(result.converged).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.totalCapacityW).toBeGreaterThanOrEqual(10000);
    expect(result.best!.feasible).toBe(true);
  });

  it("deve retornar top 5 candidatos ordenados pelo objetivo", async () => {
    const result = await runOptimization(baseInputs, {
      objective: "minimize_weight",
      constraints: { minCapacityW: 5000 },
      searchSpace: {
        rowsOptions: [2, 3, 4],
        finPitchOptions: [5, 6, 7],
        maxEvaluations: 50,
      },
    });

    expect(result.topCandidates.length).toBeGreaterThan(0);
    for (let i = 1; i < result.topCandidates.length; i++) {
      expect(result.topCandidates[i].objectiveValue).toBeGreaterThanOrEqual(
        result.topCandidates[i - 1].objectiveValue,
      );
    }
  });

  it("deve reportar quando não há solução factível", async () => {
    const result = await runOptimization(baseInputs, {
      objective: "minimize_weight",
      constraints: { minCapacityW: 999999999 },
      searchSpace: { rowsOptions: [2, 3], finPitchOptions: [6], maxEvaluations: 20 },
    });

    expect(result.converged).toBe(false);
    expect(result.best).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("deve respeitar restrição de DP máximo", async () => {
    const result = await runOptimization(baseInputs, {
      objective: "maximize_capacity",
      constraints: { minCapacityW: 5000, maxAirPressureDropPa: 100 },
      searchSpace: {
        rowsOptions: [2, 3, 4, 5, 6],
        finPitchOptions: [4, 5, 6, 7, 8],
        maxEvaluations: 100,
      },
    });

    if (result.best) {
      expect(result.best.airPressureDropPa).toBeLessThanOrEqual(100);
    }
  });

  it("deve completar em menos de 10 segundos para até 500 combinações", async () => {
    const result = await runOptimization(baseInputs, {
      objective: "minimize_weight",
      constraints: { minCapacityW: 5000 },
      searchSpace: {
        rowsOptions: [2, 3, 4, 5, 6],
        finPitchOptions: [4, 5, 6, 7, 8],
        maxEvaluations: 500,
      },
    });

    expect(result.computeTimeMs).toBeLessThan(10000);
    expect(result.evaluationsCount).toBeGreaterThan(0);
  });
});
