import { describe, it, expect } from "vitest";
import {
  validateCycleInputs,
  validateCondenserInputs,
  validateCompressorInputs,
} from "../useInputValidation";
import type { CycleSystemConfig } from "../../engines/cycle/cycleTypes";
import type { CondenserInputs } from "../useCondenserSimulation";
import type { CompressorWorkspaceInputs } from "../useCompressorEnvelopeGenerator";

// ── Fixture base válida para CycleSystemConfig ────────────────────────────────
const validCycleConfig: CycleSystemConfig = {
  id: "test-01",
  name: "Teste",
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
      rows: 3,
      finnedLengthMm: 1200,
      finnedHeightMm: 400,
      finPitchMm: 2.1,
      tubePitchTransversalMm: 25,
      tubePitchLongitudinalMm: 22,
      tubeExternalDiameterMm: 9.52,
      tubeInternalDiameterMm: 8.5,
      tubesPerRow: 12,
      circuits: 4,
      finThicknessMm: 0.12,
      finType: "plain",
    },
    airInletTempC: 25,
    airRelativeHumidity: 0.6,
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
  expansionDevice: { type: "txv", superheatTarget_K: 5 },
  solver: { Te_initial_C: -10, Tc_initial_C: 40 },
};

// ── Teste 1: inputs válidos → isValid true ────────────────────────────────────
describe("validateCycleInputs", () => {
  it("retorna isValid=true para inputs válidos", () => {
    const result = validateCycleInputs(validCycleConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── Teste 2: geometria ausente → erro ────────────────────────────────────────
  it("retorna erro quando finnedHeightMm é 0", () => {
    const config: CycleSystemConfig = {
      ...validCycleConfig,
      evaporator: {
        ...validCycleConfig.evaporator,
        physical: {
          ...validCycleConfig.evaporator.physical!,
          finnedHeightMm: 0,
        },
      },
    };
    const result = validateCycleInputs(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("altura"))).toBe(true);
  });

  // ── Teste 3: Te >= Tc → erro ──────────────────────────────────────────────────
  it("retorna erro quando Te >= Tc", () => {
    const config: CycleSystemConfig = {
      ...validCycleConfig,
      solver: { Te_initial_C: 40, Tc_initial_C: 40 },
    };
    const result = validateCycleInputs(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("evaporação"))).toBe(true);
  });

  // ── Teste 4: SH > 30 K → warning ─────────────────────────────────────────────
  it("retorna warning quando superaquecimento > 30 K", () => {
    const config: CycleSystemConfig = {
      ...validCycleConfig,
      evaporator: {
        ...validCycleConfig.evaporator,
        superheatK: 35,
      },
    };
    const result = validateCycleInputs(config);
    // Pode ter ou não erros, mas deve ter warning de SH
    expect(result.warnings.some((w) => w.includes("superaquecimento"))).toBe(true);
  });
});

// ── Testes adicionais para condensador e compressor ───────────────────────────
describe("validateCondenserInputs", () => {
  it("retorna erro quando Tc <= Tamb + 5", () => {
    const inputs: CondenserInputs = {
      Tc: 35,
      Tair_in: 32,
      geometryId: "geo-01",
      refrigerant: "R404A",
      subcooling: 5,
      fanCount: 2,
      fanId: "fan-01",
    };
    const result = validateCondenserInputs(inputs);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Tc"))).toBe(true);
  });
});

describe("validateCompressorInputs", () => {
  it("retorna erro quando nenhum compressor selecionado", () => {
    const inputs: CompressorWorkspaceInputs = {
      compressorId: "",
      compressorModel: "",
      compressorBrand: "",
      Te_C: -10,
      Tc_C: 40,
      Tsuperheating_K: 5,
      Tsubcooling_K: 5,
      refrigerant: "R404A",
      voltage_V: 380,
      frequency_Hz: 60,
    };
    const result = validateCompressorInputs(inputs);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("compressor"))).toBe(true);
  });
});
