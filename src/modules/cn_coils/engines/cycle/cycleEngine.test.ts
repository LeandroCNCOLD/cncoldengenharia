import { describe, expect, it, vi } from "vitest";
import { runCycleSimulation } from "./cycleEngine";
import type { CycleSystemConfig } from "./cycleTypes";

vi.mock("../compressor/compressorModel", () => ({
  evaluateCompressor: vi.fn().mockResolvedValue({
    Q_evap_W: 10000,
    W_comp_W: 3500,
    Q_cond_W: 13500,
    m_dot_kgS: 0.055,
    COP: 2.86,
    compressionRatio: 4.2,
    mode: "bitzer_native",
    warnings: [],
  }),
}));

vi.mock("../coil/coilCycleAdapter", () => ({
  runCoilForCycle: vi.fn().mockResolvedValue({
    totalCapacityW: 10000,
    sensibleCapacityW: 7500,
    latentCapacityW: 2500,
    airOutletTempC: 2.0,
    airOutletRH: 0.95,
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

const baseConfig: CycleSystemConfig = {
  id: "test-system-01",
  name: "Câmara Fria Teste",
  refrigerantId: "R404A",
  compressor: {
    id: "BITZER_2KES05",
    model: "2KES-05",
    manufacturer: "BITZER",
    refrigerant: "R404A",
    modelType: "bitzer_native",
    bitzerNative: {
      displacement_m3h: 4.06,
      coeff_lambda: [1.08, -0.0069, 4.66e-5],
      coeff_current: [-0.116, 0.00605, -9.54e-5],
      coeff_specific_power: [0.565, 0.0155, 1.99e-4],
      rpm: 1450,
    },
  },
  evaporator: {
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
    superheatK: 5,
    subcoolingK: 5,
    htCatalog: {},
    tubeMaterialConductivity: 385,
  },
  condenser: {
    physical: {
      rows: 2,
      finnedLengthMm: 800,
      finnedHeightMm: 600,
      finPitchMm: 3,
      tubePitchTransversalMm: 25.4,
      tubePitchLongitudinalMm: 22,
      tubeExternalDiameterMm: 9.52,
      tubeInternalDiameterMm: 8.5,
      tubesPerRow: 24,
      circuits: 4,
      finThicknessMm: 0.1,
      finType: "plain",
    },
    airInletTempC: 32,
    airRelativeHumidity: 0.5,
    airFlowM3H: 8000,
    superheatK: 0,
    subcoolingK: 5,
    htCatalog: {},
    tubeMaterialConductivity: 385,
  },
  expansionDevice: {
    type: "txv",
    superheatTarget_K: 5,
  },
  solver: {
    Te_initial_C: -10,
    Tc_initial_C: 40,
    tolerance: 0.01,
    maxIterations: 30,
    relaxation: 0.4,
  },
};

describe("runCycleSimulation", () => {
  it("deve retornar resultado com campos obrigatórios", async () => {
    const result = await runCycleSimulation(baseConfig);
    expect(result).toHaveProperty("converged");
    expect(result).toHaveProperty("Te_C");
    expect(result).toHaveProperty("Tc_C");
    expect(result).toHaveProperty("Q_evap_W");
    expect(result).toHaveProperty("COP");
    expect(result).toHaveProperty("statePoints");
  });

  it("COP deve ser positivo", async () => {
    const result = await runCycleSimulation(baseConfig);
    expect(result.COP).toBeGreaterThan(0);
  });

  it("balanço de energia: Q_cond ≈ Q_evap + W_comp (±5%)", async () => {
    const result = await runCycleSimulation(baseConfig);
    const balance = Math.abs(result.Q_cond_W - (result.Q_evap_W + result.W_comp_W));
    const tolerance = result.Q_evap_W * 0.05;
    expect(balance).toBeLessThan(tolerance);
  });

  it("Te deve ser menor que Tc", async () => {
    const result = await runCycleSimulation(baseConfig);
    expect(result.Te_C).toBeLessThan(result.Tc_C);
  });

  it("4 pontos do diagrama P-h devem existir", async () => {
    const result = await runCycleSimulation(baseConfig);
    expect(result.statePoints.point1_evapOut).toBeDefined();
    expect(result.statePoints.point2_compOut).toBeDefined();
    expect(result.statePoints.point3_condOut).toBeDefined();
    expect(result.statePoints.point4_valveOut).toBeDefined();
  });

  it("ponto 4 (válvula) deve ter quality entre 0 e 1", async () => {
    const result = await runCycleSimulation(baseConfig);
    const q4 = result.statePoints.point4_valveOut.quality;
    expect(q4).toBeGreaterThanOrEqual(0);
    expect(q4).toBeLessThanOrEqual(1);
  });

  it("EER = COP × 3.412 (±1%)", async () => {
    const result = await runCycleSimulation(baseConfig);
    expect(Math.abs(result.EER - result.COP * 3.41214)).toBeLessThan(result.COP * 0.01);
  });

  it("deve retornar aviso quando não convergir (maxIterations=1)", async () => {
    const result = await runCycleSimulation({
      ...baseConfig,
      solver: { ...baseConfig.solver, maxIterations: 1, tolerance: 0.0001 },
    });
    if (!result.converged) {
      expect(result.warnings.some((w) => w.includes("não convergiu"))).toBe(true);
    }
  });
});
