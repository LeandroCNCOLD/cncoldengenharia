import { describe, expect, it } from "vitest";
import { evaluateCompressor } from "./compressorModel";
import type { CompressorInputs, CompressorRecord } from "./compressorModel";

const bitzer_2KES05_R404A: CompressorRecord = {
  id: "BITZER_1450_2KES-05_R404A",
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
};

const fallbackCompressor: CompressorRecord = {
  id: "TEST_FALLBACK",
  model: "Generic",
  manufacturer: "Generic",
  refrigerant: "R404A",
  modelType: "constant_efficiency",
  constantEfficiency: {
    eta_vol: 0.75,
    eta_is: 0.7,
    displacement_m3h: 10.0,
  },
};

const inputs_R404A: CompressorInputs = {
  Te_C: -10,
  Tc_C: 40,
  superheat_K: 5,
  subcooling_K: 5,
  refrigerantId: "R404A",
};

describe("evaluateCompressor — Bitzer Nativo", () => {
  it("deve calcular Q_evap > 0 para R404A a Te=-10°C, Tc=40°C", async () => {
    const result = await evaluateCompressor(inputs_R404A, bitzer_2KES05_R404A);

    expect(result.Q_evap_W).toBeGreaterThan(0);
    expect(result.W_comp_W).toBeGreaterThan(0);
    expect(result.COP).toBeGreaterThan(1);
    expect(result.COP).toBeLessThan(10);
    expect(result.mode).toBe("bitzer_native");
  });

  it("deve ter COP > 1 para condições normais de câmara fria", async () => {
    const result = await evaluateCompressor(inputs_R404A, bitzer_2KES05_R404A);

    expect(result.COP).toBeGreaterThan(1.0);
  });

  it("deve retornar erro quando Te >= Tc", async () => {
    const badInputs = { ...inputs_R404A, Te_C: 40, Tc_C: 40 };
    const result = await evaluateCompressor(badInputs, bitzer_2KES05_R404A);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.Q_evap_W).toBe(0);
  });
});

describe("evaluateCompressor — Eficiências Constantes (fallback)", () => {
  it("deve calcular Q_evap > 0 com fallback", async () => {
    const result = await evaluateCompressor(inputs_R404A, fallbackCompressor);

    expect(result.Q_evap_W).toBeGreaterThan(0);
    expect(result.mode).toBe("constant_efficiency");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("evaluateCompressor — Validações físicas", () => {
  it("Q_cond deve ser maior que Q_evap (balanço de energia)", async () => {
    const result = await evaluateCompressor(inputs_R404A, bitzer_2KES05_R404A);

    expect(result.Q_cond_W).toBeGreaterThan(result.Q_evap_W);
  });

  it("razão de compressão deve ser > 1", async () => {
    const result = await evaluateCompressor(inputs_R404A, bitzer_2KES05_R404A);

    expect(result.compressionRatio).toBeGreaterThan(1);
  });

  it("balanço de energia: Q_cond ≈ Q_evap + W_comp", async () => {
    const result = await evaluateCompressor(inputs_R404A, bitzer_2KES05_R404A);
    const balance = Math.abs(result.Q_cond_W - (result.Q_evap_W + result.W_comp_W));

    expect(balance).toBeLessThan(1);
  });
});
