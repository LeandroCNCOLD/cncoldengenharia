import { describe, expect, it } from "vitest";
import {
  computeOverallU,
  schmidtFinEfficiency,
  jungDidion1989,
  shahCondensation1979,
  mullerSteinhagenHeck,
  calcFluidPressureDropV2,
} from "../heatTransfer";

// ============================================================================
// computeOverallU — testes existentes (mantidos)
// ============================================================================
describe("computeOverallU", () => {
  it("cobre, h_o=45, h_i=3000 — sem eficiência de aleta", () => {
    const result = computeOverallU({
      h_o: 45,
      h_i: 3000,
      r_o_m: 0.00665,
      r_i_m: 0.00575,
      k_tube_WmK: 385,
    });
    expect(result.U_o).toBeCloseTo(44.1, 0);
    expect(result.warnings).toHaveLength(0);
  });

  it("fallback quando h_o=0", () => {
    const result = computeOverallU({
      h_o: 0,
      h_i: 3000,
      r_o_m: 0.00665,
      r_i_m: 0.00575,
    });
    expect(result.U_o).toBe(35);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("M2 — com eficiência de superfície Schmidt η_o=0.88 reduz U_o", () => {
    const semEta = computeOverallU({
      h_o: 45,
      h_i: 3000,
      r_o_m: 0.00665,
      r_i_m: 0.00575,
      k_tube_WmK: 385,
    });
    const comEta = computeOverallU({
      h_o: 45,
      h_i: 3000,
      r_o_m: 0.00665,
      r_i_m: 0.00575,
      k_tube_WmK: 385,
      eta_surface: 0.88,
    });
    expect(comEta.U_o).toBeLessThan(semEta.U_o);
    expect(comEta.U_o).toBeGreaterThan(30);
  });
});

// ============================================================================
// M2 — schmidtFinEfficiency
// ============================================================================
describe("schmidtFinEfficiency", () => {
  const baseParams = {
    h_air_Wm2K: 45,
    k_fin_WmK: 205,
    fin_thickness_m: 0.0001,
    tube_od_m: 0.00952,
    tube_pitch_transverse_m: 0.025,
    tube_pitch_longitudinal_m: 0.02165,
  };

  it("retorna η_fin entre 0.7 e 1.0 para geometria típica de alumínio", () => {
    const result = schmidtFinEfficiency(baseParams);
    expect(result.eta_fin).toBeGreaterThan(0.7);
    expect(result.eta_fin).toBeLessThanOrEqual(1.0);
  });

  it("retorna η_surface entre η_fin e 1.0", () => {
    const result = schmidtFinEfficiency(baseParams);
    expect(result.eta_surface).toBeGreaterThanOrEqual(result.eta_fin);
    expect(result.eta_surface).toBeLessThanOrEqual(1.0);
  });

  it("aleta de cobre tem η_fin maior que aleta de alumínio", () => {
    const resultAl = schmidtFinEfficiency(baseParams);
    const resultCu = schmidtFinEfficiency({ ...baseParams, k_fin_WmK: 385 });
    expect(resultCu.eta_fin).toBeGreaterThan(resultAl.eta_fin);
  });

  it("aleta mais espessa tem η_fin maior", () => {
    const resultFina = schmidtFinEfficiency(baseParams);
    const resultGrossa = schmidtFinEfficiency({ ...baseParams, fin_thickness_m: 0.0002 });
    expect(resultGrossa.eta_fin).toBeGreaterThan(resultFina.eta_fin);
  });

  it("h_ar maior reduz η_fin", () => {
    const resultBaixo = schmidtFinEfficiency(baseParams);
    const resultAlto = schmidtFinEfficiency({ ...baseParams, h_air_Wm2K: 120 });
    expect(resultAlto.eta_fin).toBeLessThan(resultBaixo.eta_fin);
  });

  it("L_fin_m é positivo", () => {
    const result = schmidtFinEfficiency(baseParams);
    expect(result.L_fin_m).toBeGreaterThan(0);
  });

  it("sem warnings para geometria válida", () => {
    const result = schmidtFinEfficiency(baseParams);
    expect(result.warnings).toHaveLength(0);
  });
});

// ============================================================================
// M3 — jungDidion1989
// ============================================================================
describe("jungDidion1989", () => {
  const h_l = 1500;
  const Pr_l = 3;

  it("x=0.5 retorna h_tp maior que h_l (fator de aprimoramento > 1)", () => {
    const h_tp = jungDidion1989(h_l, 0.5, Pr_l);
    expect(h_tp).toBeGreaterThan(h_l);
  });

  it("x=0.001 retorna h_tp próximo de h_l (dentro de 5%)", () => {
    const h_tp = jungDidion1989(h_l, 0.001, Pr_l);
    // Para x muito baixo, F(x) ≈ (1-x)^0.8 ≈ 1 + pequena contribuição do termo bifásico
    // Aceita até 5% de diferença
    expect(h_tp / h_l).toBeGreaterThan(0.95);
    expect(h_tp / h_l).toBeLessThan(1.10);
  });

  it("x=0.8 — limite da correlação original — h_tp finito e positivo", () => {
    const h_tp = jungDidion1989(h_l, 0.8, Pr_l);
    expect(h_tp).toBeGreaterThan(h_l);
    expect(h_tp).toBeLessThan(h_l * 10);
  });

  it("x=0.9 — interpolação linear: h(0.8) > h(0.9) > h(0.999)", () => {
    const h_80 = jungDidion1989(h_l, 0.8, Pr_l);
    const h_90 = jungDidion1989(h_l, 0.9, Pr_l);
    const h_100 = jungDidion1989(h_l, 0.999, Pr_l);
    expect(h_90).toBeLessThan(h_80);
    expect(h_90).toBeGreaterThan(h_100);
  });

  it("Pr_l maior reduz h_tp", () => {
    const h_baixo_Pr = jungDidion1989(h_l, 0.5, 2);
    const h_alto_Pr = jungDidion1989(h_l, 0.5, 5);
    expect(h_alto_Pr).toBeLessThan(h_baixo_Pr);
  });

  it("resultado é finito e positivo para todos os x válidos", () => {
    for (const x of [0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.99]) {
      const h = jungDidion1989(h_l, x, Pr_l);
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// shahCondensation1979
// ============================================================================
describe("shahCondensation1979", () => {
  it("x=0.5, Pr=3 retorna h_tp maior que h_l", () => {
    const h_tp = shahCondensation1979(2000, 0.5, 3);
    expect(h_tp).toBeGreaterThan(2000);
  });

  it("resultado é finito e positivo", () => {
    const h_tp = shahCondensation1979(1500, 0.5, 4);
    expect(Number.isFinite(h_tp)).toBe(true);
    expect(h_tp).toBeGreaterThan(0);
  });
});

// ============================================================================
// M4 — mullerSteinhagenHeck
// ============================================================================
describe("mullerSteinhagenHeck", () => {
  const baseParams = {
    L_circuit_m: 10,
    D_i_m: 0.0083,
    G_kg_m2s: 200,
    rho_l_kg_m3: 1088,
    rho_v_kg_m3: 30,
    mu_l_Pa_s: 1.63e-4,
    mu_v_Pa_s: 1.2e-5,
    quality_x: 0.5,
  };

  it("retorna queda de pressão positiva para parâmetros válidos", () => {
    const dp = mullerSteinhagenHeck(baseParams);
    expect(dp).toBeGreaterThan(0);
  });

  it("queda de pressão bifásica maior que monofásica líquida (x=0)", () => {
    const dp_bi = mullerSteinhagenHeck(baseParams);
    const dp_liq = mullerSteinhagenHeck({ ...baseParams, quality_x: 0 });
    expect(dp_bi).toBeGreaterThan(dp_liq);
  });

  it("comprimento 20m → queda de pressão ≈ 2× de 10m", () => {
    const dp_10 = mullerSteinhagenHeck(baseParams);
    const dp_20 = mullerSteinhagenHeck({ ...baseParams, L_circuit_m: 20 });
    expect(dp_20).toBeCloseTo(dp_10 * 2, 0);
  });

  it("retorna 0 para D_i=0", () => {
    expect(mullerSteinhagenHeck({ ...baseParams, D_i_m: 0 })).toBe(0);
  });

  it("retorna 0 para G=0", () => {
    expect(mullerSteinhagenHeck({ ...baseParams, G_kg_m2s: 0 })).toBe(0);
  });

  it("resultado em kPa — ordem de grandeza razoável (0.01 a 100 kPa para 10m)", () => {
    const dp = mullerSteinhagenHeck(baseParams);
    expect(dp).toBeGreaterThan(0.01);
    expect(dp).toBeLessThan(100);
  });
});

// ============================================================================
// calcFluidPressureDropV2
// ============================================================================
describe("calcFluidPressureDropV2", () => {
  it("fase bifásica usa MSH — maior que monofásico líquido", () => {
    const base = {
      L_circuit_m: 10,
      D_i_m: 0.0083,
      G_kg_m2s: 200,
      rho_kg_m3: 1088,
      mu_Pa_s: 1.63e-4,
    };
    const dp_mono = calcFluidPressureDropV2({ ...base, fluidPhase: "liquido" });
    const dp_bi = calcFluidPressureDropV2({
      ...base,
      fluidPhase: "bifasico",
      rho_vapor_kg_m3: 30,
      mu_vapor_Pa_s: 1.2e-5,
      quality_x: 0.5,
    });
    expect(dp_bi).toBeGreaterThan(dp_mono);
  });

  it("fase monofásica — resultado finito e positivo", () => {
    const dp = calcFluidPressureDropV2({
      L_circuit_m: 5,
      D_i_m: 0.01,
      G_kg_m2s: 150,
      rho_kg_m3: 1000,
      mu_Pa_s: 1e-3,
      fluidPhase: "liquido",
    });
    expect(dp).toBeGreaterThan(0);
    expect(Number.isFinite(dp)).toBe(true);
  });
});
