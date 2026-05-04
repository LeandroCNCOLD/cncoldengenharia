import { describe, expect, it } from "vitest";
import { calcRefrigerantCharge } from "../utils/coilDerivedMetrics";
import {
  ziviVoidFraction,
  meanTwoPhaseRefrigerantDensity,
} from "../engine_v2/refrigerantProps";

describe("calcRefrigerantCharge", () => {
  it("R404A, Te=-35°C, 12 circuitos, ID=11.5mm → volume correto e carga bifásica realista", () => {
    const charge = calcRefrigerantCharge({
      refrigerant: "R404A",
      T_evap_C: -35,
      tubeID_m: 0.0115,
      nTubesPerRow: 24,
      nRows: 4,
      nCircuits: 12,
      L_fin_m: 1.25,
    });
    // Volume interno não muda — apenas a densidade efetiva muda
    expect(charge.L).toBeCloseTo(12.46, 0);
    // Carga bifásica (Zivi): muito menor que rho_l puro (14.65 kg com rho_l=1195 kg/m³)
    // R404A a -35°C: rho_v=14.5 kg/m³ → α_med≈0.94 → rho_efetivo≈84 kg/m³ → carga≈1.0 kg
    expect(charge.kg).toBeGreaterThan(0.3);
    expect(charge.kg).toBeLessThan(4.0);
    // rho_efetivo deve ser muito menor que rho_l (1195 kg/m³ a -35°C)
    expect(charge.rho_effective_kg_m3).toBeLessThan(400);
    expect(charge.rho_effective_kg_m3).toBeGreaterThan(20);
  });

  it("evaporador pequeno (8T×2F×0.6m, 4 circ, ID=8.3mm, R410A) → carga realista < 0.5 kg", () => {
    const charge = calcRefrigerantCharge({
      refrigerant: "R410A",
      T_evap_C: 0,
      tubeID_m: 0.0083,
      nTubesPerRow: 8,
      nRows: 2,
      nCircuits: 4,
      L_fin_m: 0.6,
    });
    // Volume ≈ 0.52 L
    expect(charge.L).toBeCloseTo(0.52, 1);
    // Carga bifásica deve ser < 0.5 kg (não 0.57 kg com rho_l puro)
    expect(charge.kg).toBeLessThan(0.5);
    expect(charge.kg).toBeGreaterThan(0.05);
  });

  it("sem warnings para refrigerante conhecido (R410A)", () => {
    const charge = calcRefrigerantCharge({
      refrigerant: "R410A",
      T_evap_C: -10,
      tubeID_m: 0.010,
      nTubesPerRow: 12,
      nRows: 3,
      nCircuits: 6,
      L_fin_m: 1.0,
    });
    expect(charge.warnings).toHaveLength(0);
  });

  it("x_in e x_out customizados — carga maior com x_in menor", () => {
    const base = calcRefrigerantCharge({
      refrigerant: "R22",
      T_evap_C: -20,
      tubeID_m: 0.010,
      nTubesPerRow: 10,
      nRows: 3,
      nCircuits: 5,
      L_fin_m: 1.0,
      x_in: 0.20,
      x_out: 0.90,
    });
    const higherLiquid = calcRefrigerantCharge({
      refrigerant: "R22",
      T_evap_C: -20,
      tubeID_m: 0.010,
      nTubesPerRow: 10,
      nRows: 3,
      nCircuits: 5,
      L_fin_m: 1.0,
      x_in: 0.05,  // mais líquido na entrada
      x_out: 0.90,
    });
    // Mais líquido na entrada → rho_efetivo maior → carga maior
    expect(higherLiquid.kg).toBeGreaterThan(base.kg);
  });
});

describe("ziviVoidFraction", () => {
  it("x=0 → α=0", () => expect(ziviVoidFraction(0, 1000, 20)).toBe(0));
  it("x=1 → α=1", () => expect(ziviVoidFraction(1, 1000, 20)).toBe(1));

  it("x=0.5, R410A a 0°C → α entre 0.70 e 0.95", () => {
    const alpha = ziviVoidFraction(0.5, 1088, 66.5);
    expect(alpha).toBeGreaterThan(0.70);
    expect(alpha).toBeLessThan(0.95);
  });

  it("α aumenta monotonicamente com x", () => {
    const a1 = ziviVoidFraction(0.2, 1088, 66.5);
    const a2 = ziviVoidFraction(0.5, 1088, 66.5);
    const a3 = ziviVoidFraction(0.8, 1088, 66.5);
    expect(a1).toBeLessThan(a2);
    expect(a2).toBeLessThan(a3);
  });

  it("fluido com rho_v/rho_l menor → α MAIOR (mais vapor por volume)", () => {
    // R717 (amônia) tem rho_v/rho_l MENOR que R410A
    // → (rho_v/rho_l)^(2/3) menor → denominador menor → α MAIOR
    // Fisicamente: vapor de amônia é muito menos denso que líquido → ocupa mais volume
    const alphaR717 = ziviVoidFraction(0.5, 639, 2.97);  // amônia a 0°C
    const alphaR410A = ziviVoidFraction(0.5, 1088, 66.5); // R410A a 0°C
    expect(alphaR717).toBeGreaterThan(alphaR410A);
  });
});

describe("meanTwoPhaseRefrigerantDensity", () => {
  it("rho_efetivo muito menor que rho_l (pelo menos 2× menor)", () => {
    const rho_m = meanTwoPhaseRefrigerantDensity(1088, 66.5);
    expect(rho_m).toBeLessThan(1088 / 2);
    expect(rho_m).toBeGreaterThan(50);
  });

  it("rho_efetivo finito e positivo para todos os fluidos", () => {
    const pairs: [number, number][] = [
      [1195, 52.0],  // R404A a 0°C
      [1088, 66.5],  // R410A a 0°C
      [1127, 20.2],  // R22 a 0°C
      [639, 2.97],   // R717 a 0°C
      [486, 15.0],   // R290 a 0°C
    ];
    for (const [rho_l, rho_v] of pairs) {
      const rho_m = meanTwoPhaseRefrigerantDensity(rho_l, rho_v);
      expect(Number.isFinite(rho_m)).toBe(true);
      expect(rho_m).toBeGreaterThan(0);
      expect(rho_m).toBeLessThan(rho_l);
    }
  });

  it("rho_efetivo aumenta com x_out menor (mais líquido)", () => {
    const rho_low_x = meanTwoPhaseRefrigerantDensity(1088, 66.5, 0.20, 0.60);
    const rho_high_x = meanTwoPhaseRefrigerantDensity(1088, 66.5, 0.20, 0.90);
    expect(rho_low_x).toBeGreaterThan(rho_high_x);
  });
});
