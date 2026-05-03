import { describe, expect, it, vi } from "vitest";
import { generateOperatingMap } from "./operatingMapEngine";
import type { CoilCycleInputs } from "../coil/coilCycleAdapter";

vi.mock("../coil/coilCycleAdapter", () => ({
  runCoilForCycle: vi.fn().mockImplementation(async (inputs: CoilCycleInputs) => ({
    totalCapacityW: 12000 + (inputs.evaporatingTempC ?? -10) * 200,
    sensibleCapacityW: 8400,
    latentCapacityW: 3600,
    airOutletTempC: inputs.airInletTempC - 5,
    airOutletRH: 0.9,
    airPressureDropPa: 185,
    fluidPressureDropKPa: 12,
    overallU_WM2K: 28.5,
    safetyFactor: 1,
    refrigerantOutletTempC: -5,
    inletQuality: 0.1,
    success: true,
    warnings: [],
  })),
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

describe("generateOperatingMap", () => {
  it("deve gerar uma curva por temperatura de condensação", async () => {
    const result = await generateOperatingMap(baseInputs, {
      evapTempRange: { min: -20, max: 0, step: 5 },
      condensingTemps: [35, 40, 45],
      airInletTempC: 5,
      airFlowM3H: 2500,
    });

    expect(result.curves.length).toBe(3);
  });

  it("deve ter pontos ordenados por temperatura de evaporação", async () => {
    const result = await generateOperatingMap(baseInputs, {
      evapTempRange: { min: -20, max: 0, step: 5 },
      condensingTemps: [40],
      airInletTempC: 5,
      airFlowM3H: 2500,
    });
    const pts = result.curves[0].points;

    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].evapTempC).toBeGreaterThan(pts[i - 1].evapTempC);
    }
  });

  it("deve destacar o ponto de projeto quando fornecido", async () => {
    const result = await generateOperatingMap(baseInputs, {
      evapTempRange: { min: -20, max: 0, step: 5 },
      condensingTemps: [40],
      airInletTempC: 5,
      airFlowM3H: 2500,
      designPoint: { evapTempC: -10, condensingTempC: 40, capacityW: 12000 },
    });

    expect(result.designPoint).toBeDefined();
  });

  it("deve completar em menos de 5 segundos", async () => {
    const result = await generateOperatingMap(baseInputs, {
      evapTempRange: { min: -30, max: 10, step: 2 },
      condensingTemps: [30, 35, 40, 45, 50],
      airInletTempC: 5,
      airFlowM3H: 2500,
    });

    expect(result.computeTimeMs).toBeLessThan(5000);
  });
});
