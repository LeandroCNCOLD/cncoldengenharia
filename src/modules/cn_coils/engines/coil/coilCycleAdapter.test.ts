import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCoilForCycle, type CoilCycleInputs } from "./coilCycleAdapter";
import { runSimulationV2 } from "../../engine_v2/simulatorCoreV2";

vi.mock("../../engine_v2/simulatorCoreV2", () => ({
  runSimulationV2: vi.fn().mockReturnValue({
    totalCapacityKw: 10.5,
    sensibleCapacityKw: 8.2,
    latentCapacityKw: 2.3,
    airOutletTempC: 2.1,
    airOutletRhPercent: 95,
    airPressureDropPa: 45,
    fluidPressureDropKpa: 12,
    U_Wm2K: 28.5,
    correctionFactor: 1.12,
    warnings: [],
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
  airInletTempC: 5,
  airRelativeHumidity: 0.85,
  airFlowM3H: 5000,
  refrigerantId: "R404A",
  evaporatingTempC: -10,
  superheatK: 5,
  subcoolingK: 5,
  refrigerantMassFlowKgS: 0.08,
  componentType: "evaporator",
  htCatalog: {},
  tubeMaterialConductivity: 385,
};

describe("runCoilForCycle", () => {
  beforeEach(() => {
    vi.mocked(runSimulationV2).mockReturnValue({
      totalCapacityKw: 10.5,
      sensibleCapacityKw: 8.2,
      latentCapacityKw: 2.3,
      airOutletTempC: 2.1,
      airOutletRhPercent: 95,
      airPressureDropPa: 45,
      fluidPressureDropKpa: 12,
      faceAreaM2: 1,
      faceVelocityMs: 1,
      airMassFlowKgS: 1,
      regime: "WET",
      correctionFactor: 1.12,
      warnings: [],
      fluidPhase: "bifasico",
      hasCondensation: true,
      U_Wm2K: 28.5,
      hAir_Wm2K: 50,
      hFluid_Wm2K: 1000,
      shf: 0.78,
    });
  });

  it("deve retornar success=true com inputs válidos", async () => {
    const result = await runCoilForCycle(baseInputs);
    expect(result.success).toBe(true);
    expect(result.totalCapacityW).toBe(10500);
  });

  it("temperatura de saída do refrigerante = T_evap + superheat", async () => {
    const result = await runCoilForCycle(baseInputs);
    expect(result.refrigerantOutletTempC).toBe(-10 + 5);
  });

  it("deve calcular flash na expansão quando subcooling = 0", async () => {
    const result = await runCoilForCycle({ ...baseInputs, subcoolingK: 0 });
    expect(result.inletQuality).toBeGreaterThanOrEqual(0);
    expect(result.inletQuality).toBeLessThanOrEqual(1);
  });

  it("inletQuality deve ser 0 quando subcooling é alto (>= 10 K)", async () => {
    const result = await runCoilForCycle({ ...baseInputs, subcoolingK: 15 });
    expect(result.inletQuality).toBe(0);
  });

  it("deve retornar success=false sem lançar exceção quando motor falha", async () => {
    vi.mocked(runSimulationV2).mockImplementationOnce(() => {
      throw new Error("Motor falhou");
    });
    const result = await runCoilForCycle(baseInputs);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Motor falhou");
  });

  it("balanço de energia: totalCapacity ~= sensível + latente", async () => {
    const result = await runCoilForCycle(baseInputs);
    if (result.success) {
      const balance = Math.abs(
        result.totalCapacityW -
          (result.sensibleCapacityW + result.latentCapacityW),
      );
      expect(balance).toBeLessThan(10);
    }
  });
});

describe("getRefrigerantFluidProps — integração", () => {
  it("deve usar propriedades reais do R404A (não placeholder)", async () => {
    const result = await runCoilForCycle(baseInputs);
    expect(result.warnings.filter((w) => w.includes("placeholder"))).toHaveLength(0);
  });
});
