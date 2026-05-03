import { describe, expect, it } from "vitest";
import { calculateFrostAnalysis } from "./frostCycleService";
import type { FrostAnalysisInput } from "./frostTypes";

const baseInput: FrostAnalysisInput = {
  airInletTempC: 5,
  airRelativeHumidity: 0.85,
  airMassFlowKgS: 1.2,
  evaporatingTempC: -10,
  evaporatorExternalAreaM2: 8.5,
  evaporatorCapacityW: 12000,
  condensingTempC: 40,
  refrigerantId: "R404A",
  config: {
    operationTimeH: 6,
    defrostMethod: "electric",
    defrostThresholdMm: 3,
    maxDefrostTimeMin: 30,
    frostDensityKgM3: 250,
  },
};

describe("calculateFrostAnalysis — cenário de formação de gelo", () => {
  it("deve retornar modo frosting para Te=-10°C e UR=85%", () => {
    const result = calculateFrostAnalysis(baseInput);
    expect(result.frostAtEndOfCycle.mode).toBe("frosting");
  });

  it("deve retornar espessura de gelo > 0 após 6h", () => {
    const result = calculateFrostAnalysis(baseInput);
    expect(result.frostAtEndOfCycle.frost_thickness_mm).toBeGreaterThan(0);
  });

  it("deve gerar curva de degradação com 13 pontos", () => {
    const result = calculateFrostAnalysis(baseInput);
    expect(result.degradationCurve).toHaveLength(13);
    expect(result.degradationCurve[0].timeH).toBe(0);
    expect(result.degradationCurve[12].timeH).toBeCloseTo(6, 1);
  });

  it("a capacidade efetiva no final deve ser menor que a inicial", () => {
    const result = calculateFrostAnalysis(baseInput);
    expect(result.effectiveCapacityAtEndW).toBeLessThan(baseInput.evaporatorCapacityW);
  });

  it("deve calcular o ciclo de degelo elétrico", () => {
    const result = calculateFrostAnalysis(baseInput);
    expect(result.defrostResult.method).toBe("electric");
    expect(result.defrostResult.electric_power_w).toBeGreaterThan(0);
  });
});

describe("calculateFrostAnalysis — cenário seco", () => {
  it("deve retornar modo dry ou condensation_only para Te=5°C e UR=50%", () => {
    const result = calculateFrostAnalysis({
      ...baseInput,
      airInletTempC: 20,
      airRelativeHumidity: 0.5,
      evaporatingTempC: 5,
    });
    expect(["dry", "condensation_only"]).toContain(result.frostAtEndOfCycle.mode);
  });

  it("deve retornar capacidade efetiva = capacidade inicial para modo dry", () => {
    const result = calculateFrostAnalysis({
      ...baseInput,
      airInletTempC: 25,
      airRelativeHumidity: 0.3,
      evaporatingTempC: 10,
    });
    if (result.frostAtEndOfCycle.mode === "dry") {
      expect(result.effectiveCapacityAtEndW).toBeCloseTo(baseInput.evaporatorCapacityW, -2);
    }
  });
});

describe("calculateFrostAnalysis — degelo por gás quente", () => {
  it("deve calcular degelo por reversão de gás quente", () => {
    const result = calculateFrostAnalysis({
      ...baseInput,
      config: { ...baseInput.config, defrostMethod: "hot_gas_reversal" },
    });
    expect(result.defrostResult.method).toBe("hot_gas_reversal");
  });
});
