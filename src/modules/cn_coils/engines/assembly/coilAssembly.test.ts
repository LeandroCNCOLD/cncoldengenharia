import { describe, expect, it, vi } from "vitest";
import { runAssemblySimulation } from "./coilAssembly";
import type { CoilAssemblyConfig } from "./assemblyTypes";

vi.mock("../coil/coilCycleAdapter", () => ({
  runCoilForCycle: vi.fn().mockResolvedValue({
    totalCapacityW: 5000,
    sensibleCapacityW: 3500,
    latentCapacityW: 1500,
    airOutletTempC: 2.0,
    airOutletRH: 0.92,
    airPressureDropPa: 45,
    fluidPressureDropKPa: 12,
    overallU_WM2K: 28.5,
    safetyFactor: 1.12,
    refrigerantOutletTempC: -5,
    inletQuality: 0.15,
    warnings: [],
    success: true,
  }),
}));

const baseCoilInputs = {
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
    finType: "plain" as const,
  },
  airFlowM3H: 2500,
  htCatalog: {},
  tubeMaterialConductivity: 385,
};

const baseConfig: CoilAssemblyConfig = {
  id: "test-assembly",
  name: "Assembly Teste",
  arrangement: "single",
  coils: [{ id: "coil-1", name: "Evaporador 1", position: 1, coilInputs: baseCoilInputs }],
  airInlet: { tempC: 5, relativeHumidity: 0.85, totalFlowM3H: 5000 },
  refrigerant: {
    id: "R404A",
    evaporatingTempC: -10,
    totalMassFlowKgS: 0.055,
    superheatK: 5,
    subcoolingK: 5,
  },
  componentType: "evaporator",
};

describe("runAssemblySimulation — single", () => {
  it("deve retornar resultado com totalCapacityW > 0", async () => {
    const result = await runAssemblySimulation(baseConfig);
    expect(result.totals.totalCapacityW).toBeGreaterThan(0);
    expect(result.units).toHaveLength(1);
    expect(result.arrangement).toBe("single");
  });
});

describe("runAssemblySimulation — series_air", () => {
  it("deve processar 2 trocadores em série e somar capacidades", async () => {
    const config: CoilAssemblyConfig = {
      ...baseConfig,
      arrangement: "series_air",
      coils: [
        { id: "coil-1", name: "Evaporador 1", position: 1, coilInputs: baseCoilInputs },
        { id: "coil-2", name: "Evaporador 2", position: 2, coilInputs: baseCoilInputs },
      ],
    };
    const result = await runAssemblySimulation(config);
    expect(result.units).toHaveLength(2);
    expect(result.totals.totalCapacityW).toBeGreaterThan(0);
    expect(result.totals.totalAirPressureDropPa).toBeGreaterThanOrEqual(
      result.totals.maxAirPressureDropPa,
    );
  });

  it("o segundo trocador deve receber a temperatura de saída do primeiro", async () => {
    const { runCoilForCycle } = await import("../coil/coilCycleAdapter");
    const mockFn = vi.mocked(runCoilForCycle);
    mockFn.mockClear();
    const config: CoilAssemblyConfig = {
      ...baseConfig,
      arrangement: "series_air",
      coils: [
        { id: "coil-1", name: "Evaporador 1", position: 1, coilInputs: baseCoilInputs },
        { id: "coil-2", name: "Evaporador 2", position: 2, coilInputs: baseCoilInputs },
      ],
    };

    await runAssemblySimulation(config);

    expect(mockFn).toHaveBeenCalledTimes(2);
    const secondCall = mockFn.mock.calls[1][0];
    expect(secondCall.airInletTempC).toBe(2.0);
  });
});

describe("runAssemblySimulation — parallel_air", () => {
  it("deve processar 2 trocadores em paralelo e somar capacidades", async () => {
    const config: CoilAssemblyConfig = {
      ...baseConfig,
      arrangement: "parallel_air",
      coils: [
        { id: "coil-1", name: "Evaporador 1", position: 1, coilInputs: baseCoilInputs, airFlowFraction: 0.5 },
        { id: "coil-2", name: "Evaporador 2", position: 2, coilInputs: baseCoilInputs, airFlowFraction: 0.5 },
      ],
    };
    const result = await runAssemblySimulation(config);
    expect(result.units).toHaveLength(2);
    expect(result.totals.totalCapacityW).toBeGreaterThan(0);
    expect(result.totals.totalAirPressureDropPa).toBeLessThanOrEqual(
      result.totals.maxAirPressureDropPa * 1.01,
    );
  });
});

describe("runAssemblySimulation — vbank", () => {
  it("deve processar V-bank com 2 trocadores", async () => {
    const config: CoilAssemblyConfig = {
      ...baseConfig,
      arrangement: "vbank",
      coils: [
        { id: "coil-1", name: "Lado A", position: 1, coilInputs: baseCoilInputs, vbankAngleDeg: 35 },
        { id: "coil-2", name: "Lado B", position: 2, coilInputs: baseCoilInputs, vbankAngleDeg: 35 },
      ],
    };
    const result = await runAssemblySimulation(config);
    expect(result.arrangement).toBe("vbank");
    expect(result.units).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes("V-bank"))).toBe(true);
  });

  it("deve retornar erro para V-bank com ≠ 2 trocadores", async () => {
    const config: CoilAssemblyConfig = {
      ...baseConfig,
      arrangement: "vbank",
      coils: [{ id: "coil-1", name: "Lado A", position: 1, coilInputs: baseCoilInputs }],
    };
    const result = await runAssemblySimulation(config);
    expect(result.converged).toBe(false);
    expect(result.warnings.some((w) => w.includes("2 trocadores"))).toBe(true);
  });
});

describe("runAssemblySimulation — validações", () => {
  it("deve lançar erro para assembly sem trocadores", async () => {
    const config: CoilAssemblyConfig = { ...baseConfig, coils: [] };
    await expect(runAssemblySimulation(config)).rejects.toThrow("nenhum trocador configurado");
  });
});
