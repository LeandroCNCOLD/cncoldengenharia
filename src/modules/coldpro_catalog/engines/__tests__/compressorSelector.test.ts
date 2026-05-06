/**
 * Testes unitários para o compressorSelector.
 *
 * Cobre:
 * - evalPoly10: equação ARI 540 com valores conhecidos
 * - checkEnvelope: verificação de limites operacionais
 * - evaluateCompressorAtPoint: avaliação com coeficientes e nominal
 * - selectBestCompressorRecord: seleção do melhor registro
 */

import { describe, it, expect } from "vitest";
import {
  evalPoly10,
  checkEnvelope,
  evaluateCompressorAtPoint,
  selectBestCompressorRecord,
  selectAndEvaluateCompressor,
  type CompressorRecord,
} from "../compressorSelector";

// ─── Coeficientes de teste (Copeland ZR22K3E-TFD, R407C, VAPCYC) ─────────────
// Coeficientes ARI 540 fictícios para teste (valores razoáveis para um compressor de 5 kW)
const TEST_CAP_COEF = [
  5.0,    // C1 (kW na origem)
  0.08,   // C2 · Te
  -0.04,  // C3 · Tc
  0.001,  // C4 · Te²
  0.0005, // C5 · Te·Tc
  0.0002, // C6 · Tc²
  0.0,    // C7 · Te³
  0.0,    // C8 · Te²·Tc
  0.0,    // C9 · Te·Tc²
  0.0,    // C10 · Tc³
];

const TEST_PWR_COEF = [
  1.5,    // C1
  -0.01,  // C2 · Te
  0.02,   // C3 · Tc
  0.0,    // C4..C10
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
];

const RECORD_WITH_COEF: CompressorRecord = {
  id: "test_comp_1",
  source: "VAPCYC_COPELAND_V4",
  model: "ZR22K3E-TFD",
  manufacturer: "Copeland",
  refrigerant: ["R407C"],
  type: "scroll",
  cooling_capacity_kw: 5.0,
  power_input_kw: 1.5,
  cop: 3.33,
  min_evap_temp_c: -20,
  max_evap_temp_c: 10,
  min_cond_temp_c: 25,
  max_cond_temp_c: 55,
  nominal_conditions: { te_c: -10, tc_c: 40, superheat_k: 10, subcooling_k: 5 },
  capacity_coefficients: TEST_CAP_COEF,
  power_coefficients: TEST_PWR_COEF,
  data_quality: "validated",
};

const RECORD_NOMINAL_ONLY: CompressorRecord = {
  id: "test_comp_2",
  source: "VAPCYC_BRISTOL",
  model: "H29B383ABCA",
  manufacturer: "Bristol",
  refrigerant: ["R404A"],
  type: "reciprocating",
  cooling_capacity_kw: 3.5,
  power_input_kw: 1.2,
  cop: 2.92,
  min_evap_temp_c: -25,
  max_evap_temp_c: 5,
  min_cond_temp_c: 20,
  max_cond_temp_c: 50,
  nominal_conditions: { te_c: -10, tc_c: 40 },
  capacity_coefficients: [],
  power_coefficients: [],
  data_quality: "check_required",
};

// ─── evalPoly10 ───────────────────────────────────────────────────────────────

describe("evalPoly10", () => {
  it("retorna C1 quando Te=0 e Tc=0", () => {
    const coef = [5.0, 0.1, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    expect(evalPoly10(coef, 0, 0)).toBeCloseTo(5.0, 6);
  });

  it("calcula corretamente com termos lineares", () => {
    // Y = 5 + 0.1·Te + 0.2·Tc
    const coef = [5.0, 0.1, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    // Te=-10, Tc=40: Y = 5 + 0.1·(-10) + 0.2·40 = 5 - 1 + 8 = 12
    expect(evalPoly10(coef, -10, 40)).toBeCloseTo(12.0, 6);
  });

  it("retorna NaN para array com menos de 10 coeficientes", () => {
    const coef = [1.0, 2.0, 3.0];
    expect(evalPoly10(coef, 0, 0)).toBeNaN();
  });

  it("calcula corretamente com termos quadráticos", () => {
    // Y = 0 + 0·Te + 0·Tc + 1·Te² + 0 + 1·Tc²
    const coef = [0, 0, 0, 1, 0, 1, 0, 0, 0, 0];
    // Te=3, Tc=4: Y = 9 + 16 = 25
    expect(evalPoly10(coef, 3, 4)).toBeCloseTo(25.0, 6);
  });

  it("calcula corretamente com termos cúbicos", () => {
    // Y = 0 + 0 + 0 + 0 + 0 + 0 + 1·Te³ + 0 + 0 + 1·Tc³
    const coef = [0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
    // Te=2, Tc=3: Y = 8 + 27 = 35
    expect(evalPoly10(coef, 2, 3)).toBeCloseTo(35.0, 6);
  });
});

// ─── checkEnvelope ────────────────────────────────────────────────────────────

describe("checkEnvelope", () => {
  it("retorna inside=true quando Te e Tc estão dentro do envelope", () => {
    const result = checkEnvelope(RECORD_WITH_COEF, -10, 40);
    expect(result.inside).toBe(true);
    expect(result.te_clamped).toBe(-10);
    expect(result.tc_clamped).toBe(40);
    expect(result.te_warning).toBeNull();
    expect(result.tc_warning).toBeNull();
  });

  it("clampeia Te quando abaixo do mínimo", () => {
    const result = checkEnvelope(RECORD_WITH_COEF, -30, 40);
    expect(result.inside).toBe(false);
    expect(result.te_clamped).toBe(-20); // min_evap_temp_c
    expect(result.te_warning).toContain("abaixo do mínimo");
  });

  it("clampeia Te quando acima do máximo", () => {
    const result = checkEnvelope(RECORD_WITH_COEF, 20, 40);
    expect(result.inside).toBe(false);
    expect(result.te_clamped).toBe(10); // max_evap_temp_c
    expect(result.te_warning).toContain("acima do máximo");
  });

  it("clampeia Tc quando abaixo do mínimo", () => {
    const result = checkEnvelope(RECORD_WITH_COEF, -10, 15);
    expect(result.inside).toBe(false);
    expect(result.tc_clamped).toBe(25); // min_cond_temp_c
    expect(result.tc_warning).toContain("abaixo do mínimo");
  });

  it("clampeia Tc quando acima do máximo", () => {
    const result = checkEnvelope(RECORD_WITH_COEF, -10, 65);
    expect(result.inside).toBe(false);
    expect(result.tc_clamped).toBe(55); // max_cond_temp_c
    expect(result.tc_warning).toContain("acima do máximo");
  });

  it("normaliza min/max_cond invertidos (bug histórico CN Coils)", () => {
    const recordInverted: CompressorRecord = {
      ...RECORD_WITH_COEF,
      min_cond_temp_c: 65, // invertido
      max_cond_temp_c: 25, // invertido
    };
    const result = checkEnvelope(recordInverted, -10, 40);
    expect(result.inside).toBe(true); // deve normalizar e aceitar 40 entre 25 e 65
  });
});

// ─── evaluateCompressorAtPoint ────────────────────────────────────────────────

describe("evaluateCompressorAtPoint", () => {
  it("usa coeficientes ARI 540 quando disponíveis", () => {
    const result = evaluateCompressorAtPoint(RECORD_WITH_COEF, -10, 40);
    expect(result.status).toBe("ok");
    expect(result.data_type).toBe("polynomial_ari540");
    expect(result.cooling_capacity_kw).toBeGreaterThan(0);
    expect(result.power_input_kw).toBeGreaterThan(0);
    expect(result.cop).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("retorna status clamped quando ponto está fora do envelope", () => {
    const result = evaluateCompressorAtPoint(RECORD_WITH_COEF, -35, 40);
    expect(result.status).toBe("clamped");
    expect(result.te_used_c).toBe(-20); // clampado ao mínimo
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("usa dados nominais quando não há coeficientes", () => {
    const result = evaluateCompressorAtPoint(RECORD_NOMINAL_ONLY, -10, 40);
    expect(result.status).toBe("ok_nominal");
    expect(result.data_type).toBe("nominal");
    expect(result.cooling_capacity_kw).toBeCloseTo(3.5, 2);
    expect(result.power_input_kw).toBeCloseTo(1.2, 2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Sem coeficientes");
  });

  it("retorna no_data quando não há capacidade nem coeficientes", () => {
    const emptyRecord: CompressorRecord = {
      id: "empty",
      model: "EMPTY",
      cooling_capacity_kw: 0,
      power_input_kw: 0,
    };
    const result = evaluateCompressorAtPoint(emptyRecord, -10, 40);
    expect(result.status).toBe("no_data");
    expect(result.cooling_capacity_kw).toBe(0);
  });

  it("calcula COP corretamente como Q/W", () => {
    const result = evaluateCompressorAtPoint(RECORD_WITH_COEF, -10, 40);
    const expectedCop = result.cooling_capacity_kw / result.power_input_kw;
    expect(result.cop).toBeCloseTo(expectedCop, 3);
  });

  it("identifica fonte CN Coils corretamente", () => {
    const cnRecord: CompressorRecord = {
      ...RECORD_WITH_COEF,
      source: "CN Coils_COILS6",
      capacity_coefficients: [...TEST_CAP_COEF, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 20 termos
    };
    const result = evaluateCompressorAtPoint(cnRecord, -10, 40);
    expect(result.data_type).toBe("polynomial_cn_coils");
  });
});

// ─── selectBestCompressorRecord ───────────────────────────────────────────────

describe("selectBestCompressorRecord", () => {
  it("lança erro quando lista está vazia", () => {
    expect(() => selectBestCompressorRecord([], -10, 40)).toThrow();
  });

  it("retorna o único registro quando há apenas um", () => {
    const result = selectBestCompressorRecord([RECORD_WITH_COEF], -10, 40);
    expect(result.index).toBe(0);
    expect(result.record.model).toBe("ZR22K3E-TFD");
  });

  it("prefere registro com coeficientes dentro do envelope", () => {
    // Dois registros: um com coeficientes (envelope cobre o ponto), outro nominal
    const candidates = [RECORD_NOMINAL_ONLY, RECORD_WITH_COEF];
    const result = selectBestCompressorRecord(candidates, -10, 40);
    expect(result.record.model).toBe("ZR22K3E-TFD"); // tem coeficientes
    expect(result.index).toBe(1);
  });

  it("prefere registro UNILAB sobre VAPCYC quando ambos têm coeficientes", () => {
    const unilabRecord: CompressorRecord = {
      ...RECORD_WITH_COEF,
      id: "unilab_1",
      source: "UNILAB_Standard",
    };
    const candidates = [RECORD_WITH_COEF, unilabRecord]; // VAPCYC primeiro, UNILAB segundo
    const result = selectBestCompressorRecord(candidates, -10, 40);
    expect(result.record.source).toBe("UNILAB_Standard");
    expect(result.index).toBe(1);
  });

  it("seleciona registro com envelope mais amplo quando ponto está na borda", () => {
    const narrowRecord: CompressorRecord = {
      ...RECORD_WITH_COEF,
      id: "narrow",
      min_evap_temp_c: -15, // envelope menor
      max_evap_temp_c: 5,
    };
    const wideRecord: CompressorRecord = {
      ...RECORD_WITH_COEF,
      id: "wide",
      min_evap_temp_c: -25, // envelope maior
      max_evap_temp_c: 10,
    };
    // Ponto em Te=-18: fora do envelope estreito, dentro do amplo
    const result = selectBestCompressorRecord([narrowRecord, wideRecord], -18, 40);
    expect(result.record.id).toBe("wide");
  });
});

// ─── selectAndEvaluateCompressor ─────────────────────────────────────────────

describe("selectAndEvaluateCompressor", () => {
  it("seleciona e avalia corretamente", () => {
    const result = selectAndEvaluateCompressor(
      [RECORD_NOMINAL_ONLY, RECORD_WITH_COEF],
      -10,
      40
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.selected_index).toBe(1); // RECORD_WITH_COEF tem coeficientes
    expect(result.evaluation.status).toBe("ok");
    expect(result.evaluation.cooling_capacity_kw).toBeGreaterThan(0);
  });

  it("resultado é consistente com evaluateCompressorAtPoint direto", () => {
    const direct = evaluateCompressorAtPoint(RECORD_WITH_COEF, -10, 40);
    const selected = selectAndEvaluateCompressor([RECORD_WITH_COEF], -10, 40);
    expect(selected.evaluation.cooling_capacity_kw).toBeCloseTo(
      direct.cooling_capacity_kw,
      6
    );
    expect(selected.evaluation.power_input_kw).toBeCloseTo(
      direct.power_input_kw,
      6
    );
  });
});

// ─── Testes de integração com dados reais ────────────────────────────────────

describe("Integração: coeficientes ARI 540 sintéticos com comportamento físico correto", () => {
  // Coeficientes sintéticos EN 12900 (°C, kW) com comportamento físico garantido:
  // Q aumenta com Te, diminui com Tc
  // Q(Te=-10, Tc=40) = 10 + 0.12·(-10) - 0.06·40 = 10 - 1.2 - 2.4 = 6.4 kW
  // W(Te=-10, Tc=40) = 2.0 - 0.01·(-10) + 0.02·40 = 2.0 + 0.1 + 0.8 = 2.9 kW
  // COP = 6.4 / 2.9 = 2.2 (razoável)
  const synCapCoef = [10.0, 0.12, -0.06, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  // W = 2.0 - 0.01·Te + 0.02·Tc
  const synPwrCoef = [2.0, -0.01, 0.02, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

  const synRecord: CompressorRecord = {
    id: "synthetic_test",
    source: "UNILAB_Standard",
    model: "SYNTH-TEST-5kW",
    manufacturer: "Test",
    refrigerant: ["R404A"],
    type: "scroll",
    cooling_capacity_kw: 5.0,
    power_input_kw: 1.5,
    cop: 3.33,
    min_evap_temp_c: -25,
    max_evap_temp_c: 10,
    min_cond_temp_c: 20,
    max_cond_temp_c: 55,
    nominal_conditions: { te_c: -10, tc_c: 40, superheat_k: 10, subcooling_k: 5 },
    capacity_coefficients: synCapCoef,
    power_coefficients: synPwrCoef,
    data_quality: "validated",
    standard: "EN12900",
  };

  it("capacidade calculada é positiva nas condições nominais", () => {
    const result = evaluateCompressorAtPoint(synRecord, -10, 40);
    expect(result.cooling_capacity_kw).toBeGreaterThan(0);
    expect(result.power_input_kw).toBeGreaterThan(0);
    expect(result.cop).toBeGreaterThan(1.0);
    expect(result.status).toBe("ok");
  });

  it("capacidade aumenta com Te mais alto (mesma Tc)", () => {
    const r1 = evaluateCompressorAtPoint(synRecord, -20, 40);
    const r2 = evaluateCompressorAtPoint(synRecord, -10, 40);
    const r3 = evaluateCompressorAtPoint(synRecord, 0, 40);
    // Q = 5 + 0.12·Te - 0.06·Tc + ...: aumenta com Te
    expect(r2.cooling_capacity_kw).toBeGreaterThan(r1.cooling_capacity_kw);
    expect(r3.cooling_capacity_kw).toBeGreaterThan(r2.cooling_capacity_kw);
  });

  it("capacidade diminui com Tc mais alto (mesma Te)", () => {
    const r1 = evaluateCompressorAtPoint(synRecord, -10, 30);
    const r2 = evaluateCompressorAtPoint(synRecord, -10, 40);
    const r3 = evaluateCompressorAtPoint(synRecord, -10, 50);
    // Q = 5 + 0.12·Te - 0.06·Tc + ...: diminui com Tc
    expect(r2.cooling_capacity_kw).toBeLessThan(r1.cooling_capacity_kw);
    expect(r3.cooling_capacity_kw).toBeLessThan(r2.cooling_capacity_kw);
  });

  it("potência aumenta com Tc mais alto", () => {
    const r1 = evaluateCompressorAtPoint(synRecord, -10, 30);
    const r2 = evaluateCompressorAtPoint(synRecord, -10, 40);
    // W = 1.5 - 0.01·Te + 0.025·Tc: aumenta com Tc
    expect(r2.power_input_kw).toBeGreaterThan(r1.power_input_kw);
  });

  it("COP calculado é consistente com Q/W", () => {
    const result = evaluateCompressorAtPoint(synRecord, -10, 40);
    const expectedCop = result.cooling_capacity_kw / result.power_input_kw;
    expect(result.cop).toBeCloseTo(expectedCop, 3);
  });

  it("AHRI 540 (°F, BTU/h): converte corretamente para kW", () => {
    // Coeficientes AHRI 540 em BTU/h com Te/Tc em °F
    // Q(14°F, 113°F) deve dar ~17.065 kBTU/h = 5.0 kW
    // Usando coeficientes simples: Q = 17065 BTU/h (constante)
    const ahriRecord: CompressorRecord = {
      ...synRecord,
      id: "ahri_test",
      source: "VAPCYC_COPELAND_V4",
      standard: "AHRI540",
      capacity_coefficients: [17065, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 17065 BTU/h = 5.0 kW
      power_coefficients: [5118, 0, 0, 0, 0, 0, 0, 0, 0, 0],     // 5118 BTU/h = 1.5 kW
    };
    const result = evaluateCompressorAtPoint(ahriRecord, -10, 40);
    expect(result.cooling_capacity_kw).toBeCloseTo(5.0, 1);
    expect(result.power_input_kw).toBeCloseTo(1.5, 1);
    expect(result.data_type).toBe("polynomial_ari540");
  });
});
