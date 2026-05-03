import { describe, expect, it } from "vitest";
import { findFanOperatingPointSimple } from "../fanOperatingPoint";
import type { AxialFanRecord } from "../../../services/cncoilsCoefficientsService";

const mockFan: AxialFanRecord = {
  fanType: 0,
  idFanModel: 1,
  model: "Mock fan",
  voltage: 220,
  frequency: 60,
  rpm: 1200,
  powerW: 250,
  currentA: 1.2,
  xMin: 0,
  xMax: 6000,
  soundPower: 0,
  soundPressure: 0,
  source: "curve",
  curve: {
    x: [0, 6000],
    y: [300, 0],
  },
};

describe("findFanOperatingPointSimple", () => {
  it("deve retornar vazão dentro da faixa válida", () => {
    const result = findFanOperatingPointSimple(mockFan, 1, 5000, 200);

    expect(result.airFlowM3H).toBeGreaterThan(0);
    expect(result.staticPressurePa).toBeGreaterThan(0);
  });

  it("dois ventiladores em paralelo devem ter vazão maior", () => {
    const result1 = findFanOperatingPointSimple(mockFan, 1, 5000, 200);
    const result2 = findFanOperatingPointSimple(mockFan, 2, 5000, 200);

    expect(result2.airFlowM3H).toBeGreaterThan(result1.airFlowM3H);
  });
});
