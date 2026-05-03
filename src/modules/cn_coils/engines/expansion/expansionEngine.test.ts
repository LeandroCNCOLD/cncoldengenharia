import { describe, expect, it } from "vitest";
import { evaluateExpansionDevice } from "./expansionEngine";
import type { ExpansionDeviceInput } from "./expansionTypes";

const baseInput: ExpansionDeviceInput = {
  mode: "active",
  evaporatingTempC: -10,
  condensingTempC: 40,
  subcoolingK: 5,
  actualSuperheatK: 5,
  refrigerantId: "R404A",
};

const txv = {
  type: "txv" as const,
  nominalCapacityW: 12000,
  refrigerantId: "R404A",
  nominalDeltaPressureKPa: 600,
  superheatTargetK: 5,
  superheatMinK: 3,
  superheatMaxK: 10,
  springConstantKPaPerK: 15,
};

describe("evaluateExpansionDevice — modo disabled", () => {
  it("deve retornar massFlowKgS null e inletQuality > 0", async () => {
    const result = await evaluateExpansionDevice({ ...baseInput, mode: "disabled" });

    expect(result.massFlowKgS).toBeNull();
    expect(result.inletQuality).toBeGreaterThanOrEqual(0);
    expect(result.inletQuality).toBeLessThan(0.4);
    expect(result.converged).toBe(true);
  });
});

describe("evaluateExpansionDevice — TXV", () => {
  it("deve calcular vazão mássica positiva para TXV bem dimensionada", async () => {
    const result = await evaluateExpansionDevice({ ...baseInput, device: txv });

    expect(result.massFlowKgS).not.toBeNull();
    expect(result.massFlowKgS!).toBeGreaterThan(0);
    expect(result.effectiveOpening).toBeGreaterThanOrEqual(0);
    expect(result.effectiveOpening!).toBeLessThanOrEqual(1);
  });

  it("deve emitir aviso quando SH real está abaixo do mínimo", async () => {
    const result = await evaluateExpansionDevice({
      ...baseInput,
      actualSuperheatK: 1,
      device: txv,
    });

    expect(result.warnings.some((w) => w.includes("retorno de líquido") || w.includes("mínimo"))).toBe(true);
  });
});

describe("evaluateExpansionDevice — EEV", () => {
  it("deve calcular vazão mássica proporcional à abertura", async () => {
    const r50 = await evaluateExpansionDevice({
      ...baseInput,
      device: {
        type: "eev",
        openingFraction: 0.5,
        orificeDiameterMm: 2.5,
        dischargeCoefficient: 0.65,
        superheatTargetK: 5,
        controlToleranceK: 0.5,
      },
    });
    const r100 = await evaluateExpansionDevice({
      ...baseInput,
      device: {
        type: "eev",
        openingFraction: 1,
        orificeDiameterMm: 2.5,
        dischargeCoefficient: 0.65,
        superheatTargetK: 5,
        controlToleranceK: 0.5,
      },
    });

    expect(r100.massFlowKgS!).toBeGreaterThan(r50.massFlowKgS!);
  });
});

describe("evaluateExpansionDevice — Tubo Capilar", () => {
  it("deve calcular vazão mássica positiva para capilar típico", async () => {
    const result = await evaluateExpansionDevice({
      ...baseInput,
      device: { type: "capillary", lengthM: 2.0, internalDiameterMm: 1.5 },
    });

    expect(result.massFlowKgS).not.toBeNull();
    expect(result.massFlowKgS!).toBeGreaterThan(0);
  });
});

describe("evaluateExpansionDevice — Flash na expansão", () => {
  it("deve calcular flash com subresfriamento zero", async () => {
    const result = await evaluateExpansionDevice({
      ...baseInput,
      subcoolingK: 0,
      mode: "disabled",
    });

    expect(result.inletQuality).toBeGreaterThanOrEqual(0);
  });

  it("deve ter inletQuality menor com maior subresfriamento", async () => {
    const r5 = await evaluateExpansionDevice({ ...baseInput, subcoolingK: 5, mode: "disabled" });
    const r15 = await evaluateExpansionDevice({ ...baseInput, subcoolingK: 15, mode: "disabled" });

    expect(r15.inletQuality).toBeLessThanOrEqual(r5.inletQuality);
  });
});

describe("evaluateExpansionDevice — Orifício Fixo", () => {
  it("deve calcular vazão mássica positiva", async () => {
    const result = await evaluateExpansionDevice({
      ...baseInput,
      device: {
        type: "fixed_orifice",
        orificeDiameterMm: 3,
        dischargeCoefficient: 0.65,
      },
    });

    expect(result.massFlowKgS!).toBeGreaterThan(0);
  });
});
