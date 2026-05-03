import { describe, expect, it, vi } from "vitest";
import { runUncertaintyAnalysis } from "./uncertaintyEngine";
import type { CoilCycleInputs, CoilCycleResult } from "../coil/coilCycleAdapter";

vi.mock("../coil/coilCycleAdapter", () => ({
  runCoilForCycle: vi.fn().mockImplementation(async (inputs: CoilCycleInputs) => {
    const variation = 1 + ((inputs.physical.finPitchMm - 6) / 6) * 0.5;
    return {
      totalCapacityW: 12000 * variation,
      sensibleCapacityW: 8400 * variation,
      latentCapacityW: 3600 * variation,
      airOutletTempC: 2,
      airOutletRH: 0.95,
      airPressureDropPa: 185 * variation,
      fluidPressureDropKPa: 12,
      overallU_WM2K: 28.5 * variation,
      safetyFactor: 1,
      refrigerantOutletTempC: -5,
      inletQuality: 0.1,
      success: true,
      warnings: [],
    } satisfies CoilCycleResult;
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

const nominalResult: CoilCycleResult = {
  totalCapacityW: 12000,
  sensibleCapacityW: 8400,
  latentCapacityW: 3600,
  airOutletTempC: 2,
  airOutletRH: 0.95,
  airPressureDropPa: 185,
  fluidPressureDropKPa: 12,
  overallU_WM2K: 28.5,
  safetyFactor: 1,
  refrigerantOutletTempC: -5,
  inletQuality: 0.1,
  success: true,
  warnings: [],
};

describe("runUncertaintyAnalysis", () => {
  it("deve retornar bandas com lower < nominal < upper", async () => {
    const result = await runUncertaintyAnalysis(baseInputs, nominalResult, {
      samples: 50,
    });
    expect(result.totalCapacityW.lower).toBeLessThan(result.totalCapacityW.nominal);
    expect(result.totalCapacityW.upper).toBeGreaterThan(result.totalCapacityW.nominal);
  });

  it("deve retornar banda de DP ar com lower < nominal < upper", async () => {
    const result = await runUncertaintyAnalysis(baseInputs, nominalResult, {
      samples: 50,
    });
    expect(result.airPressureDropPa.lower).toBeLessThan(result.airPressureDropPa.nominal);
    expect(result.airPressureDropPa.upper).toBeGreaterThan(result.airPressureDropPa.nominal);
  });

  it("deve ser determinístico com a mesma semente", async () => {
    const r1 = await runUncertaintyAnalysis(baseInputs, nominalResult, {
      samples: 50,
      seed: 123,
    });
    const r2 = await runUncertaintyAnalysis(baseInputs, nominalResult, {
      samples: 50,
      seed: 123,
    });
    expect(r1.totalCapacityW.lower).toBeCloseTo(r2.totalCapacityW.lower, 1);
    expect(r1.totalCapacityW.upper).toBeCloseTo(r2.totalCapacityW.upper, 1);
  });

  it("deve retornar samplesUsed <= samples configurado", async () => {
    const result = await runUncertaintyAnalysis(baseInputs, nominalResult, {
      samples: 50,
    });
    expect(result.samplesUsed).toBeLessThanOrEqual(50);
    expect(result.samplesUsed).toBeGreaterThan(0);
  });

  it("deve respeitar o nível de confiança configurado", async () => {
    const result = await runUncertaintyAnalysis(baseInputs, nominalResult, {
      samples: 50,
      confidenceLevel: 0.95,
    });
    expect(result.totalCapacityW.confidenceLevel).toBe(0.95);
  });
});
