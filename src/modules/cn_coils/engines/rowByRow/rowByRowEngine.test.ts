import { describe, expect, it, vi } from "vitest";
import { runRowByRowSimulation } from "./rowByRowEngine";
import type { CoilCycleInputs } from "../coil/coilCycleAdapter";

vi.mock("../coil/coilCycleAdapter", () => ({
  runCoilForCycle: vi.fn().mockImplementation(async (inputs: CoilCycleInputs) => ({
    totalCapacityW: 12000 / inputs.physical.rows,
    sensibleCapacityW: 8400 / inputs.physical.rows,
    latentCapacityW: 3600 / inputs.physical.rows,
    airOutletTempC: inputs.airInletTempC - 5 / inputs.physical.rows,
    airOutletRH: inputs.airRelativeHumidity,
    airPressureDropPa: 185 / inputs.physical.rows,
    fluidPressureDropKPa: 12,
    overallU_WM2K: 28.5,
    safetyFactor: 1,
    refrigerantOutletTempC: -5,
    inletQuality: 0.15,
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

describe("runRowByRowSimulation", () => {
  it("deve retornar N resultados de fileira quando enabled=true", async () => {
    const result = await runRowByRowSimulation({ baseInputs, enabled: true });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.totalCapacityW).toBeGreaterThan(0);
  });

  it("deve usar fallback global quando enabled=false", async () => {
    const result = await runRowByRowSimulation({ baseInputs, enabled: false });
    expect(result.method).toBe("global_fallback");
    expect(result.totalCapacityW).toBeGreaterThan(0);
  });

  it("deve ter temperatura de saída menor que temperatura de entrada", async () => {
    const result = await runRowByRowSimulation({ baseInputs, enabled: true });
    expect(result.airOutletTempC).toBeLessThan(baseInputs.airInletTempC);
  });

  it("deve calcular ΔP total como soma das fileiras", async () => {
    const result = await runRowByRowSimulation({ baseInputs, enabled: true });
    const sumDp = result.rows.reduce((sum, row) => sum + row.airPressureDropPa, 0);
    expect(Math.abs(result.totalAirPressureDropPa - sumDp)).toBeLessThan(1);
  });
});
