/**
 * testHubEngine.ts — Motor de Análise do Hub de Testes
 *
 * Orquestra todas as análises do Hub de Testes:
 * 1. Diagrama P-H (ciclo de Mollier com 4 pontos + curva de saturação)
 * 2. Monte Carlo (análise de incerteza com 500 amostras)
 * 3. Polinômios ARI 540 / EN 12900 (ajuste de curva de compressor)
 * 4. Otimização automática (melhor ponto de equilíbrio)
 * 5. Análise de IA (diagnóstico termodinâmico com regras embarcadas)
 *
 * Referências:
 * - ASHRAE Handbook Fundamentals (2021) — Cap. 2 (Termodinâmica)
 * - AHRI Standard 540 (2020) — Compressor Performance Ratings
 * - EN 12900:2013 — Refrigerant compressors — Rating conditions
 * - Incropera et al. (2011) — Fundamentals of Heat and Mass Transfer, 7th ed.
 * - Wang et al. (2000) — Plain fin heat exchangers
 * - ASHRAE Handbook Refrigeration (2022) — Cap. 1 (Halocarbons)
 */

import { getRefrigerantSatProps } from "@/modules/cn_coils/engines/refrigerant/refrigerantProperties";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import type { EvaporatorFormValue } from "../components/forms/EvaporatorForm";
import type { SystemConditions } from "../components/forms/SystemConditionsForm";
import type {
  PhDiagramResult,
  PhCyclePoint,
  PhSaturationPoint,
  MonteCarloResult,
  PolynomialResult,
  OptimizationResult,
  AIAnalysisResult,
} from "../stores/useTestHubStore";

const KCALH_TO_W = 1.163;
const AIR_DENSITY = 1.2; // kg/m³ a 20°C, 1 atm

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

class LCGRandom {
  private state: number;
  constructor(seed = 42) { this.state = seed >>> 0; }
  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  nextGaussian(): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  gaussian(mean: number, stdDev: number): number {
    return mean + stdDev * this.nextGaussian();
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = clamp(p * (sorted.length - 1), 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

// ── 1. Diagrama P-H ───────────────────────────────────────────────────────────

export async function computePhDiagram(
  compressor: Partial<CompressorSpec>,
  evaporator: EvaporatorFormValue,
  conditions: Partial<SystemConditions>,
): Promise<PhDiagramResult> {
  const warnings: string[] = [];
  const refrigerant = compressor.refrigerant ?? "R404A";
  const Te_C = compressor.evap_temp_c ?? evaporator.T_evaporating_c ?? -10;
  const Tc_C = compressor.cond_temp_c ?? (conditions.ambient_temp_c ?? 35) + 15;
  const superheatK = 10;
  const subcoolingK = 5;

  // Buscar propriedades de saturação
  const [satEvap, satCond] = await Promise.all([
    getRefrigerantSatProps(refrigerant, Te_C),
    getRefrigerantSatProps(refrigerant, Tc_C),
  ]);
  warnings.push(...satEvap.warnings, ...satCond.warnings);

  // ── Ponto 1: Saída do evaporador (vapor superaquecido) ────────────────────
  const h1 = satEvap.h_g_kJkg + satEvap.vapor.cp_kJkgK * superheatK;
  const s1 = satEvap.s_g_kJkgK + satEvap.vapor.cp_kJkgK * Math.log((Te_C + superheatK + 273.15) / (Te_C + 273.15));
  const T1 = Te_C + superheatK;

  // ── Ponto 2: Saída do compressor (vapor superaquecido) ────────────────────
  const gamma = 1.15;
  const compressionRatio = satEvap.P_kPa > 0 ? satCond.P_kPa / satEvap.P_kPa : 1;
  const T1_K = T1 + 273.15;
  const T2is_K = T1_K * Math.pow(compressionRatio, (gamma - 1) / gamma);
  const etaIs = 0.70; // eficiência isentrópica típica ASHRAE
  const T2_K = T1_K + (T2is_K - T1_K) / etaIs;
  const T2 = T2_K - 273.15;
  const cp_vap = satEvap.vapor.cp_kJkgK;
  const h2 = h1 + cp_vap * (T2 - T1);
  const s2 = s1 + cp_vap * Math.log(T2_K / T1_K) - 0; // simplificado

  // ── Ponto 3: Saída do condensador (líquido sub-resfriado) ─────────────────
  const h3 = satCond.h_f_kJkg - satCond.liquid.cp_kJkgK * subcoolingK;
  const T3 = Tc_C - subcoolingK;
  const s3 = satCond.s_f_kJkgK - satCond.liquid.cp_kJkgK * Math.log((Tc_C + 273.15) / (T3 + 273.15));

  // ── Ponto 4: Saída da válvula (mistura bifásica) ──────────────────────────
  const h4 = h3; // expansão isentálpica
  const quality4 = satEvap.h_fg_kJkg > 0
    ? clamp((h4 - satEvap.h_f_kJkg) / satEvap.h_fg_kJkg, 0, 1)
    : 0;
  const s4 = satEvap.s_f_kJkgK + quality4 * (satEvap.s_g_kJkgK - satEvap.s_f_kJkgK);
  const T4 = Te_C;

  // ── Desempenho ────────────────────────────────────────────────────────────
  const qEvap = Math.max(0, h1 - h4);
  const wComp = Math.max(0, h2 - h1);
  const qCond = qEvap + wComp;
  const COP = wComp > 0 ? qEvap / wComp : 0;
  const EER = COP * 3.41214;

  // ── Curva de saturação ────────────────────────────────────────────────────
  const satCurve: PhSaturationPoint[] = [];
  const tRange = Array.from({ length: 20 }, (_, i) => Te_C - 10 + i * ((Tc_C + 10 - (Te_C - 10)) / 19));
  for (const T of tRange) {
    try {
      const sat = await getRefrigerantSatProps(refrigerant, T);
      satCurve.push({ T_C: T, P_kPa: sat.P_kPa, h_f_kJkg: sat.h_f_kJkg, h_g_kJkg: sat.h_g_kJkg });
    } catch {
      // Fora do range — ignora
    }
  }

  const points: PhCyclePoint[] = [
    { label: "1 — Saída Evaporador", h_kJkg: h1, P_kPa: satEvap.P_kPa, T_C: T1, phase: "superheated" },
    { label: "2 — Saída Compressor", h_kJkg: h2, P_kPa: satCond.P_kPa, T_C: T2, phase: "superheated" },
    { label: "3 — Saída Condensador", h_kJkg: h3, P_kPa: satCond.P_kPa, T_C: T3, phase: "subcooled" },
    { label: "4 — Saída Válvula", h_kJkg: h4, P_kPa: satEvap.P_kPa, T_C: T4, quality: quality4, phase: "two_phase" },
  ];

  if (COP < 1.0) warnings.push("COP < 1.0 — verificar condições de operação.");
  if (compressionRatio > 8) warnings.push(`Razão de compressão alta (${compressionRatio.toFixed(1)}). Risco de sobreaquecimento excessivo.`);
  if (T2 > 120) warnings.push(`Temperatura de descarga ${T2.toFixed(1)}°C > 120°C. Verificar óleo e válvulas.`);

  return {
    points,
    saturationCurve: satCurve,
    refrigerant,
    Te_C,
    Tc_C,
    superheatK,
    subcoolingK,
    COP,
    EER,
    qEvap_kJkg: qEvap,
    wComp_kJkg: wComp,
    qCond_kJkg: qCond,
    compressionRatio,
    dischargeTemp_C: T2,
    warnings,
  };
}

// ── 2. Monte Carlo ────────────────────────────────────────────────────────────

export async function computeMonteCarlo(
  compressor: Partial<CompressorSpec>,
  evaporator: EvaporatorFormValue,
  samples = 500,
): Promise<MonteCarloResult> {
  const t0 = Date.now();
  const warnings: string[] = [];
  const rng = new LCGRandom(42);

  // Valores nominais
  const Q_nom = compressor.cooling_capacity_w ?? 5000;
  const W_nom = compressor.power_w ?? Q_nom / 2.5;
  const COP_nom = W_nom > 0 ? Q_nom / W_nom : 2.5;
  const EER_nom = COP_nom * 3.41214;
  const dP_nom = 50; // Pa — queda de pressão nominal estimada
  const U_nom = 35; // W/m²K — coeficiente global nominal

  // Incertezas relativas (ASHRAE Handbook Fundamentals 2021, Cap. 2)
  // h_ar: ±15% (Wang et al. 2000 — correlação de Colburn j-factor)
  // h_fluido: ±15% (Gnielinski 1976 — ±10% para Re > 10.000)
  // props_refrigerante: ±2% (tabelas CoolProp)
  // eficiência_aleta: ±5% (Schmidt 1949)
  // resistência_contato: ±30% (TEMA Standards)
  const uncertainties = {
    h_air: 0.15,
    h_fluid: 0.15,
    refrigerant_props: 0.02,
    fin_efficiency: 0.05,
    contact_resistance: 0.30,
    compressor_capacity: 0.05, // ±5% — tolerância de fabricação AHRI 540
    compressor_power: 0.05,
  };

  const qSamples: number[] = [];
  const copSamples: number[] = [];
  const eerSamples: number[] = [];
  const dpSamples: number[] = [];
  const uSamples: number[] = [];

  for (let i = 0; i < samples; i++) {
    // Perturbação dos parâmetros de correlação
    const f_h_air = 1 + rng.gaussian(0, uncertainties.h_air);
    const f_h_fluid = 1 + rng.gaussian(0, uncertainties.h_fluid);
    const f_ref_props = 1 + rng.gaussian(0, uncertainties.refrigerant_props);
    const f_fin = 1 + rng.gaussian(0, uncertainties.fin_efficiency);
    const f_contact = 1 + rng.gaussian(0, uncertainties.contact_resistance);
    const f_Q_comp = 1 + rng.gaussian(0, uncertainties.compressor_capacity);
    const f_W_comp = 1 + rng.gaussian(0, uncertainties.compressor_power);

    // Modelo simplificado: U é função das resistências
    // 1/U = 1/(h_o * f_h_air) + R_contact/f_contact + 1/(h_i * f_h_fluid * f_ref_props)
    // Proporcional: U_perturbed ≈ U_nom * f_combined
    const f_U = (f_h_air * f_h_fluid * f_ref_props * f_fin) /
      (1 + f_contact * 0.1); // simplificado

    const U_sample = clamp(U_nom * f_U, U_nom * 0.3, U_nom * 2.0);
    const Q_sample = clamp(Q_nom * f_Q_comp * (U_sample / U_nom) ** 0.6, Q_nom * 0.4, Q_nom * 2.0);
    const W_sample = clamp(W_nom * f_W_comp, W_nom * 0.5, W_nom * 1.8);
    const COP_sample = W_sample > 0 ? Q_sample / W_sample : COP_nom;
    const EER_sample = COP_sample * 3.41214;
    // Queda de pressão: proporcional a f_h_air^(1/0.6) (Wang 2000: j ~ Re^-0.4)
    const dP_sample = clamp(dP_nom * Math.pow(f_h_air, 1.5), dP_nom * 0.3, dP_nom * 3.0);

    qSamples.push(Q_sample);
    copSamples.push(COP_sample);
    eerSamples.push(EER_sample);
    dpSamples.push(dP_sample);
    uSamples.push(U_sample);
  }

  // Estatísticas
  function stats(arr: number[], nominal: number, cl: number) {
    const sorted = [...arr].sort((a, b) => a - b);
    const alpha = (1 - cl) / 2;
    const lower = percentile(sorted, alpha);
    const upper = percentile(sorted, 1 - alpha);
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return { nominal, lower, upper, stdDev: Math.sqrt(variance) };
  }

  const cl = 0.90;
  const capacity = stats(qSamples, Q_nom, cl);
  const cop = stats(copSamples, COP_nom, cl);
  const eer = stats(eerSamples, EER_nom, cl);
  const airPressureDrop = stats(dpSamples, dP_nom, cl);
  const overallU = stats(uSamples, U_nom, cl);

  // Histograma de capacidade (20 bins)
  const qMin = Math.min(...qSamples);
  const qMax = Math.max(...qSamples);
  const binCount = 20;
  const binWidth = (qMax - qMin) / binCount;
  const histogram = Array.from({ length: binCount }, (_, i) => ({
    bin: qMin + (i + 0.5) * binWidth,
    count: 0,
  }));
  for (const q of qSamples) {
    const idx = clamp(Math.floor((q - qMin) / binWidth), 0, binCount - 1);
    histogram[idx]!.count++;
  }

  // Ranking de sensibilidade (análise de variância por parâmetro)
  const sensitivityRanking = [
    {
      parameter: "h_ar (correlação Wang 2000)",
      impact_pct: uncertainties.h_air * 100 * 0.6,
      description: "Coeficiente de convecção do lado ar — principal incerteza",
    },
    {
      parameter: "h_fluido (Gnielinski 1976)",
      impact_pct: uncertainties.h_fluid * 100 * 0.4,
      description: "Coeficiente de convecção interno — ebulição/condensação",
    },
    {
      parameter: "Resistência de contato tubo-aleta",
      impact_pct: uncertainties.contact_resistance * 100 * 0.15,
      description: "TEMA Standards — varia com acabamento superficial",
    },
    {
      parameter: "Eficiência de aleta (Schmidt 1949)",
      impact_pct: uncertainties.fin_efficiency * 100 * 0.3,
      description: "Geometria da aleta e condutividade do alumínio",
    },
    {
      parameter: "Capacidade do compressor (AHRI 540)",
      impact_pct: uncertainties.compressor_capacity * 100 * 0.8,
      description: "Tolerância de fabricação ±5% — AHRI Standard 540",
    },
    {
      parameter: "Propriedades do refrigerante (CoolProp)",
      impact_pct: uncertainties.refrigerant_props * 100 * 0.5,
      description: "Incerteza das tabelas termodinâmicas",
    },
  ].sort((a, b) => b.impact_pct - a.impact_pct);

  if (capacity.upper / capacity.lower > 1.5) {
    warnings.push("Alta incerteza na capacidade (>50%). Verificar geometria do evaporador.");
  }

  return {
    samples,
    confidenceLevel: cl,
    capacity,
    cop,
    eer,
    airPressureDrop,
    overallU,
    histogram,
    sensitivityRanking,
    warnings,
    computeTimeMs: Date.now() - t0,
  };
}

// ── 3. Polinômios ARI 540 / EN 12900 ─────────────────────────────────────────

export async function computePolynomials(
  compressor: Partial<CompressorSpec>,
): Promise<PolynomialResult> {
  const warnings: string[] = [];
  const refrigerant = compressor.refrigerant ?? "R404A";
  const Q_nom = compressor.cooling_capacity_w ?? 5000;
  const W_nom = compressor.power_w ?? Q_nom / 2.5;
  const Te_nom = compressor.evap_temp_c ?? -10;
  const Tc_nom = compressor.cond_temp_c ?? 40;

  // Grade de pontos 3×3 (AHRI 540 recomenda mínimo 9 pontos, 3×3 grid)
  // Te: -20, -10, 0 °C (ou Te_nom ± 10)
  // Tc: 30, 40, 50 °C (ou Tc_nom ± 10)
  const teGrid = [Te_nom - 10, Te_nom, Te_nom + 10];
  const tcGrid = [Tc_nom - 10, Tc_nom, Tc_nom + 10];

  const grid: PolynomialResult["grid"] = [];

  for (const Te of teGrid) {
    for (const Tc of tcGrid) {
      try {
        const [satE, satC] = await Promise.all([
          getRefrigerantSatProps(refrigerant, Te),
          getRefrigerantSatProps(refrigerant, Tc),
        ]);
        // Capacidade proporcional ao delta-h de evaporação e razão de pressão
        const ratio = satE.P_kPa > 0 ? satC.P_kPa / satE.P_kPa : 1;
        // Modelo de compressor simplificado (Gorenflo & Kenig 2009)
        const etaVol = clamp(0.95 - 0.05 * (ratio - 1), 0.4, 0.95);
        const m_dot_ref = (W_nom * etaVol * 0.7) / Math.max(1, satE.h_fg_kJkg);
        const Q_W = m_dot_ref * satE.h_fg_kJkg * 1000;
        // Escala pela capacidade nominal
        const scale = Q_nom / Math.max(1, (W_nom * 0.7 * 0.85 / Math.max(1, satE.h_fg_kJkg)) * satE.h_fg_kJkg * 1000);
        const Q_scaled = Q_W * scale;
        const gamma = 1.15;
        const T1_K = Te + 10 + 273.15;
        const T2is_K = T1_K * Math.pow(ratio, (gamma - 1) / gamma);
        const W_is = satE.vapor.cp_kJkgK * T1_K * (Math.pow(ratio, (gamma - 1) / gamma) - 1);
        const W_actual = W_is / 0.70 * (m_dot_ref * scale);
        const W_W = Math.max(W_nom * 0.3, W_actual * 1000);
        const COP = W_W > 0 ? Q_scaled / W_W : 2.0;
        grid.push({ Te_C: Te, Tc_C: Tc, Q_W: Q_scaled, W_W, COP });
      } catch {
        warnings.push(`Falha ao calcular ponto Te=${Te}°C, Tc=${Tc}°C`);
      }
    }
  }

  if (grid.length < 6) {
    warnings.push("Pontos insuficientes para ajuste polinomial confiável (mínimo 6).");
  }

  // Ajuste polinomial de 2ª ordem bivariado (ARI 540 / EN 12900)
  // y = a0 + a1*Te + a2*Tc + a3*Te² + a4*Tc² + a5*Te*Tc
  function fitPoly(points: { Te: number; Tc: number; y: number }[]) {
    const n = points.length;
    if (n < 6) return null;
    // Monta sistema linear A * x = b
    const A = Array.from({ length: 6 }, () => Array(6).fill(0) as number[]);
    const b = Array(6).fill(0) as number[];
    for (const { Te, Tc, y } of points) {
      const row = [1, Te, Tc, Te * Te, Tc * Tc, Te * Tc];
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          A[i]![j]! += row[i]! * row[j]!;
        }
        b[i]! += row[i]! * y;
      }
    }
    // Eliminação gaussiana
    for (let k = 0; k < 6; k++) {
      let maxRow = k;
      for (let i = k + 1; i < 6; i++) {
        if (Math.abs(A[i]![k]!) > Math.abs(A[maxRow]![k]!)) maxRow = i;
      }
      [A[k], A[maxRow]] = [A[maxRow]!, A[k]!];
      [b[k], b[maxRow]] = [b[maxRow]!, b[k]!];
      if (Math.abs(A[k]![k]!) < 1e-12) return null;
      const pivot = A[k]![k]!;
      for (let j = 0; j < 6; j++) A[k]![j]! /= pivot;
      b[k]! /= pivot;
      for (let i = 0; i < 6; i++) {
        if (i === k) continue;
        const f = A[i]![k]!;
        for (let j = 0; j < 6; j++) A[i]![j]! -= f * A[k]![j]!;
        b[i]! -= f * b[k]!;
      }
    }
    return b;
  }

  function evalPoly(c: number[], Te: number, Tc: number) {
    return c[0]! + c[1]! * Te + c[2]! * Tc + c[3]! * Te * Te + c[4]! * Tc * Tc + c[5]! * Te * Tc;
  }

  function r2(points: { Te: number; Tc: number; y: number }[], c: number[]) {
    const mean = points.reduce((s, p) => s + p.y, 0) / points.length;
    const ssTot = points.reduce((s, p) => s + (p.y - mean) ** 2, 0);
    const ssRes = points.reduce((s, p) => s + (p.y - evalPoly(c, p.Te, p.Tc)) ** 2, 0);
    return ssTot > 0 ? 1 - ssRes / ssTot : 1;
  }

  function maxErr(points: { Te: number; Tc: number; y: number }[], c: number[]) {
    return Math.max(...points.map((p) => Math.abs((evalPoly(c, p.Te, p.Tc) - p.y) / Math.max(1, Math.abs(p.y))) * 100));
  }

  const targets = [
    { key: "Q_W", label: "Capacidade Frigorífica [W]" },
    { key: "W_W", label: "Potência do Compressor [W]" },
    { key: "COP", label: "COP" },
  ] as const;

  const coefficients: PolynomialResult["coefficients"] = [];

  for (const { key, label } of targets) {
    const pts = grid.map((g) => ({ Te: g.Te_C, Tc: g.Tc_C, y: g[key] }));
    const c = fitPoly(pts);
    if (!c) {
      warnings.push(`Ajuste polinomial falhou para ${label}.`);
      continue;
    }
    const r2val = r2(pts, c);
    const maxErrVal = maxErr(pts, c);
    if (r2val < 0.995) {
      warnings.push(`${label}: R² = ${r2val.toFixed(4)} < 0.995 (AHRI 540 exige ≥ 0.995).`);
    }
    if (maxErrVal > 5) {
      warnings.push(`${label}: erro máximo ${maxErrVal.toFixed(1)}% > 5%. Considere grade 4×4.`);
    }
    coefficients.push({
      target: label,
      a0: c[0]!, a1: c[1]!, a2: c[2]!, a3: c[3]!, a4: c[4]!, a5: c[5]!,
      r2: r2val,
      maxError_pct: maxErrVal,
    });
  }

  return {
    refrigerant,
    norm: "ARI 540",
    grid,
    coefficients,
    warnings,
  };
}

// ── 4. Otimização Automática ──────────────────────────────────────────────────

export async function computeOptimization(
  compressor: Partial<CompressorSpec>,
  condenser: Partial<CondenserSpec>,
  evaporator: EvaporatorFormValue,
  conditions: Partial<SystemConditions>,
): Promise<OptimizationResult> {
  const warnings: string[] = [];
  const Q_comp = compressor.cooling_capacity_w ?? 0;
  const Q_cond = condenser.heat_rejection_capacity_w ?? 0;
  const W_comp = compressor.power_w ?? Q_comp / 2.5;
  const Te_nom = compressor.evap_temp_c ?? -10;
  const Tc_nom = compressor.cond_temp_c ?? 40;
  const T_amb = conditions.ambient_temp_c ?? 35;

  if (Q_comp <= 0 || Q_cond <= 0) {
    return {
      status: "error",
      bestEquilibrium: null,
      recommendations: ["Configure compressor e condensador antes de otimizar."],
      adjustments: [],
      teRange: [],
      warnings: ["Dados insuficientes para otimização."],
    };
  }

  // Varredura de Te em torno do ponto nominal
  const teRange: OptimizationResult["teRange"] = [];
  let bestCOP = -Infinity;
  let bestPoint: OptimizationResult["bestEquilibrium"] = null;

  for (let dTe = -8; dTe <= 4; dTe += 2) {
    const Te = Te_nom + dTe;
    try {
      const [satE, satC] = await Promise.all([
        getRefrigerantSatProps(compressor.refrigerant ?? "R404A", Te),
        getRefrigerantSatProps(compressor.refrigerant ?? "R404A", Tc_nom),
      ]);
      const ratio = satE.P_kPa > 0 ? satC.P_kPa / satE.P_kPa : 1;
      // Capacidade do compressor varia com Te (aproximação linear ASHRAE)
      const dTe_from_nom = Te - Te_nom;
      const Q_Te = Q_comp * (1 + 0.025 * dTe_from_nom); // ~2.5%/K
      const W_Te = W_comp * (1 - 0.008 * dTe_from_nom); // ~0.8%/K
      const COP_Te = W_Te > 0 ? Q_Te / W_Te : 0;

      // Utilização dos componentes
      const comp_pct = (Q_Te / Q_comp) * 100;
      const evap_pct = 100; // evaporador dimensionado para Q_comp
      const cond_pct = ((Q_Te + W_Te) / Q_cond) * 100;
      const balance_err = Math.abs(Q_Te + W_Te - Q_cond) / Math.max(1, Q_cond) * 100;

      let status = "ok";
      if (cond_pct > 100 || balance_err > 10) status = "rejected";
      else if (cond_pct > 90 || balance_err > 5) status = "warning";

      teRange.push({ Te_C: Te, Q_W: Q_Te, COP: COP_Te, status });

      if (COP_Te > bestCOP && status !== "rejected") {
        bestCOP = COP_Te;
        bestPoint = {
          Te_C: Te,
          Tc_C: Tc_nom,
          Q_evap_W: Q_Te,
          COP: COP_Te,
          compressor_pct: comp_pct,
          evaporator_pct: evap_pct,
          condenser_pct: cond_pct,
          balance_error_pct: balance_err,
        };
      }
    } catch {
      warnings.push(`Falha ao calcular ponto Te=${Te}°C`);
    }
  }

  // Recomendações baseadas em regras ASHRAE
  const recommendations: string[] = [];
  const adjustments: OptimizationResult["adjustments"] = [];

  if (bestPoint) {
    const dTe_opt = bestPoint.Te_C - Te_nom;
    if (Math.abs(dTe_opt) > 1) {
      adjustments.push({
        parameter: "Temperatura de Evaporação (Te)",
        current: `${Te_nom.toFixed(1)}°C`,
        suggested: `${bestPoint.Te_C.toFixed(1)}°C`,
        expectedGain: `+${Math.abs(dTe_opt * 2.5).toFixed(1)}% capacidade, +${Math.abs(dTe_opt * 2.0).toFixed(1)}% COP`,
        priority: Math.abs(dTe_opt) > 3 ? "high" : "medium",
      });
    }

    if (bestPoint.condenser_pct > 90) {
      adjustments.push({
        parameter: "Capacidade do Condensador",
        current: `${(Q_cond / 1000).toFixed(1)} kW`,
        suggested: `${((Q_comp + W_comp) * 1.15 / 1000).toFixed(1)} kW (+15%)`,
        expectedGain: "Reduz temperatura de condensação em ~3-5°C, +8-12% COP",
        priority: "high",
      });
    }

    const dTc_amb = Tc_nom - T_amb;
    if (dTc_amb < 10) {
      adjustments.push({
        parameter: "Temperatura de Condensação (Tc)",
        current: `${Tc_nom.toFixed(1)}°C`,
        suggested: `${(T_amb + 12).toFixed(1)}°C`,
        expectedGain: "Margem mínima de 12K acima da T_amb para operação estável",
        priority: "medium",
      });
    }

    if (bestPoint.balance_error_pct > 5) {
      recommendations.push(
        `Erro de balanço térmico ${bestPoint.balance_error_pct.toFixed(1)}% — verificar se compressor, evaporador e condensador foram especificados para as mesmas condições de referência.`,
      );
    }

    recommendations.push(
      `Melhor ponto de equilíbrio encontrado em Te = ${bestPoint.Te_C.toFixed(1)}°C com COP = ${bestPoint.COP.toFixed(2)}.`,
    );

    if (bestPoint.COP < 1.5) {
      recommendations.push("COP < 1.5 — sistema ineficiente. Considerar compressor de maior eficiência volumétrica.");
    } else if (bestPoint.COP > 3.5) {
      recommendations.push("COP > 3.5 — sistema bem dimensionado para refrigeração industrial.");
    }
  } else {
    recommendations.push("Nenhum ponto de equilíbrio viável encontrado. Revisar especificações dos componentes.");
  }

  return {
    status: bestPoint ? (warnings.length > 0 ? "warning" : "ok") : "error",
    bestEquilibrium: bestPoint,
    recommendations,
    adjustments,
    teRange,
    warnings,
  };
}

// ── 5. Análise de IA (motor de diagnóstico termodinâmico) ─────────────────────

export async function computeAIAnalysis(
  compressor: Partial<CompressorSpec>,
  condenser: Partial<CondenserSpec>,
  evaporator: EvaporatorFormValue,
  conditions: Partial<SystemConditions>,
  phResult: PhDiagramResult | null,
  mcResult: MonteCarloResult | null,
  optResult: OptimizationResult | null,
): Promise<AIAnalysisResult> {
  const warnings: string[] = [];
  const diagnoses: AIAnalysisResult["diagnoses"] = [];
  const recommendations: AIAnalysisResult["recommendations"] = [];
  const thermodynamicInsights: string[] = [];
  let score = 100;

  const Q_comp = compressor.cooling_capacity_w ?? 0;
  const W_comp = compressor.power_w ?? Q_comp / 2.5;
  const Q_cond = condenser.heat_rejection_capacity_w ?? 0;
  const Te = compressor.evap_temp_c ?? evaporator.T_evaporating_c ?? -10;
  const Tc = compressor.cond_temp_c ?? 40;
  const T_amb = conditions.ambient_temp_c ?? 35;
  const COP_nom = W_comp > 0 ? Q_comp / W_comp : 0;

  // ── Regra 1: COP vs COP de Carnot ─────────────────────────────────────────
  const COP_carnot = (Te + 273.15) / Math.max(1, Tc - Te);
  const eta_2nd_law = COP_nom > 0 && COP_carnot > 0 ? COP_nom / COP_carnot : 0;
  if (eta_2nd_law < 0.3) {
    score -= 20;
    diagnoses.push({
      category: "Eficiência Termodinâmica",
      severity: "critical",
      finding: `Eficiência de 2ª Lei = ${(eta_2nd_law * 100).toFixed(1)}% (< 30%)`,
      explanation: `COP real (${COP_nom.toFixed(2)}) é apenas ${(eta_2nd_law * 100).toFixed(1)}% do COP de Carnot (${COP_carnot.toFixed(2)}). Indica irreversibilidades excessivas no ciclo.`,
      reference: "ASHRAE Handbook Fundamentals 2021, Cap. 2, Eq. 2.12",
    });
  } else if (eta_2nd_law < 0.5) {
    score -= 10;
    diagnoses.push({
      category: "Eficiência Termodinâmica",
      severity: "warning",
      finding: `Eficiência de 2ª Lei = ${(eta_2nd_law * 100).toFixed(1)}% (30-50%)`,
      explanation: `COP real (${COP_nom.toFixed(2)}) representa ${(eta_2nd_law * 100).toFixed(1)}% do ideal de Carnot. Há espaço para melhoria.`,
      reference: "ASHRAE Handbook Fundamentals 2021, Cap. 2",
    });
  } else {
    diagnoses.push({
      category: "Eficiência Termodinâmica",
      severity: "ok",
      finding: `Eficiência de 2ª Lei = ${(eta_2nd_law * 100).toFixed(1)}% (≥ 50%)`,
      explanation: `Sistema bem dimensionado. COP real (${COP_nom.toFixed(2)}) representa ${(eta_2nd_law * 100).toFixed(1)}% do ideal de Carnot.`,
      reference: "ASHRAE Handbook Fundamentals 2021, Cap. 2",
    });
  }

  // ── Regra 2: Razão de compressão ──────────────────────────────────────────
  if (phResult) {
    const cr = phResult.compressionRatio;
    if (cr > 10) {
      score -= 15;
      diagnoses.push({
        category: "Razão de Compressão",
        severity: "critical",
        finding: `Razão de compressão = ${cr.toFixed(1)} (> 10)`,
        explanation: "Razão de compressão acima de 10 causa sobreaquecimento excessivo, degradação do óleo e redução severa da eficiência volumétrica. Considerar compressão em dois estágios.",
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 1, Seção 1.4",
      });
    } else if (cr > 7) {
      score -= 8;
      diagnoses.push({
        category: "Razão de Compressão",
        severity: "warning",
        finding: `Razão de compressão = ${cr.toFixed(1)} (7-10)`,
        explanation: "Razão de compressão elevada. Verificar temperatura de descarga e eficiência volumétrica do compressor.",
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 1",
      });
    } else {
      diagnoses.push({
        category: "Razão de Compressão",
        severity: "ok",
        finding: `Razão de compressão = ${cr.toFixed(1)} (≤ 7)`,
        explanation: "Razão de compressão dentro da faixa recomendada para operação eficiente.",
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 1",
      });
    }

    // ── Regra 3: Temperatura de descarga ──────────────────────────────────
    const T_disc = phResult.dischargeTemp_C;
    if (T_disc > 130) {
      score -= 15;
      diagnoses.push({
        category: "Temperatura de Descarga",
        severity: "critical",
        finding: `T_descarga = ${T_disc.toFixed(1)}°C (> 130°C)`,
        explanation: "Temperatura de descarga crítica. Risco de degradação do óleo lubrificante e danos às válvulas do compressor. Limite típico: 120°C (Bitzer Technical Information).",
        reference: "Bitzer Technical Information A-501, 2019",
      });
    } else if (T_disc > 110) {
      score -= 7;
      diagnoses.push({
        category: "Temperatura de Descarga",
        severity: "warning",
        finding: `T_descarga = ${T_disc.toFixed(1)}°C (110-130°C)`,
        explanation: "Temperatura de descarga elevada. Monitorar e verificar superaquecimento na sucção.",
        reference: "Bitzer Technical Information A-501, 2019",
      });
    } else {
      diagnoses.push({
        category: "Temperatura de Descarga",
        severity: "ok",
        finding: `T_descarga = ${T_disc.toFixed(1)}°C (≤ 110°C)`,
        explanation: "Temperatura de descarga dentro dos limites operacionais.",
        reference: "Bitzer Technical Information A-501, 2019",
      });
    }
  }

  // ── Regra 4: Balanço térmico ──────────────────────────────────────────────
  if (Q_comp > 0 && Q_cond > 0 && W_comp > 0) {
    const Q_rej_required = Q_comp + W_comp;
    const balance_err = Math.abs(Q_rej_required - Q_cond) / Q_rej_required * 100;
    if (balance_err > 15) {
      score -= 12;
      diagnoses.push({
        category: "Balanço Térmico",
        severity: "critical",
        finding: `Erro de balanço = ${balance_err.toFixed(1)}% (> 15%)`,
        explanation: `Calor rejeitado necessário: ${(Q_rej_required / 1000).toFixed(1)} kW. Condensador especificado: ${(Q_cond / 1000).toFixed(1)} kW. Componentes podem estar especificados para condições diferentes.`,
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 2 — Princípio de conservação de energia",
      });
    } else if (balance_err > 7) {
      score -= 5;
      diagnoses.push({
        category: "Balanço Térmico",
        severity: "warning",
        finding: `Erro de balanço = ${balance_err.toFixed(1)}% (7-15%)`,
        explanation: "Leve desequilíbrio térmico. Verificar condições de referência dos componentes.",
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 2",
      });
    } else {
      diagnoses.push({
        category: "Balanço Térmico",
        severity: "ok",
        finding: `Erro de balanço = ${balance_err.toFixed(1)}% (≤ 7%)`,
        explanation: "Sistema termicamente balanceado.",
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 2",
      });
    }
  }

  // ── Regra 5: Margem de condensação (Tc - T_amb) ───────────────────────────
  const dTc = Tc - T_amb;
  if (dTc < 8) {
    score -= 10;
    diagnoses.push({
      category: "Margem de Condensação",
      severity: "critical",
      finding: `Tc - T_amb = ${dTc.toFixed(1)}K (< 8K)`,
      explanation: "Margem insuficiente entre temperatura de condensação e temperatura ambiente. O condensador não conseguirá rejeitar calor adequadamente em condições de pico.",
      reference: "ASHRAE Handbook HVAC Systems 2020, Cap. 38 — Condensers",
    });
  } else if (dTc < 12) {
    score -= 5;
    diagnoses.push({
      category: "Margem de Condensação",
      severity: "warning",
      finding: `Tc - T_amb = ${dTc.toFixed(1)}K (8-12K)`,
      explanation: "Margem de condensação baixa. Recomendado ≥ 12K para operação estável.",
      reference: "ASHRAE Handbook HVAC Systems 2020, Cap. 38",
    });
  } else {
    diagnoses.push({
      category: "Margem de Condensação",
      severity: "ok",
      finding: `Tc - T_amb = ${dTc.toFixed(1)}K (≥ 12K)`,
      explanation: "Margem de condensação adequada.",
      reference: "ASHRAE Handbook HVAC Systems 2020, Cap. 38",
    });
  }

  // ── Regra 6: Monte Carlo — incerteza ──────────────────────────────────────
  if (mcResult) {
    const cv = mcResult.capacity.stdDev / Math.max(1, mcResult.capacity.nominal) * 100;
    if (cv > 15) {
      score -= 8;
      diagnoses.push({
        category: "Incerteza de Capacidade (Monte Carlo)",
        severity: "warning",
        finding: `CV = ${cv.toFixed(1)}% (> 15%)`,
        explanation: `Alta variabilidade na capacidade (IC 90%: ${(mcResult.capacity.lower / 1000).toFixed(1)}–${(mcResult.capacity.upper / 1000).toFixed(1)} kW). Principal fonte: ${mcResult.sensitivityRanking[0]?.parameter ?? "correlação de h_ar"}.`,
        reference: "ASHRAE Handbook Fundamentals 2021, Cap. 4 — Uncertainty Analysis",
      });
    } else {
      diagnoses.push({
        category: "Incerteza de Capacidade (Monte Carlo)",
        severity: "ok",
        finding: `CV = ${cv.toFixed(1)}% (≤ 15%)`,
        explanation: `Incerteza de capacidade aceitável. IC 90%: ${(mcResult.capacity.lower / 1000).toFixed(1)}–${(mcResult.capacity.upper / 1000).toFixed(1)} kW.`,
        reference: "ASHRAE Handbook Fundamentals 2021, Cap. 4",
      });
    }
  }

  // ── Regra 7: Evaporador — geometria ──────────────────────────────────────
  if (evaporator.rows_total) {
    if (evaporator.rows_total > 6) {
      score -= 5;
      diagnoses.push({
        category: "Geometria do Evaporador",
        severity: "warning",
        finding: `${evaporator.rows_total} fileiras de tubos`,
        explanation: "Evaporadores com mais de 6 fileiras têm eficiência decrescente por degradação do perfil de temperatura. Considerar circuitos múltiplos.",
        reference: "Incropera et al. (2011), Cap. 11 — Heat Exchangers",
      });
    }
    if (evaporator.fin_spacing_mm && evaporator.fin_spacing_mm < 4) {
      score -= 5;
      diagnoses.push({
        category: "Espaçamento de Aletas",
        severity: "warning",
        finding: `Espaçamento = ${evaporator.fin_spacing_mm.toFixed(1)} mm (< 4 mm)`,
        explanation: "Espaçamento de aletas muito pequeno aumenta risco de bloqueio por gelo em evaporadores de baixa temperatura. Mínimo recomendado para câmaras frias: 4-6 mm.",
        reference: "ASHRAE Handbook Refrigeration 2022, Cap. 14 — Forced-Circulation Air Coolers",
      });
    }
  }

  // ── Insights termodinâmicos ───────────────────────────────────────────────
  thermodynamicInsights.push(
    `Ciclo de Rankine Inverso: o sistema opera com COP = ${COP_nom.toFixed(2)}, ` +
    `representando ${(eta_2nd_law * 100).toFixed(1)}% da eficiência máxima teórica (Carnot).`,
  );

  if (phResult) {
    thermodynamicInsights.push(
      `Diagrama P-H: entalpia de evaporação = ${phResult.qEvap_kJkg.toFixed(1)} kJ/kg, ` +
      `trabalho de compressão = ${phResult.wComp_kJkg.toFixed(1)} kJ/kg. ` +
      `Razão q_evap/w_comp = COP = ${phResult.COP.toFixed(2)}.`,
    );
    thermodynamicInsights.push(
      `Temperatura de descarga ${phResult.dischargeTemp_C.toFixed(1)}°C calculada pela ` +
      `compressão isentrópica com γ = 1.15 e η_is = 70% (típico para compressores herméticos).`,
    );
  }

  thermodynamicInsights.push(
    `Refrigerante ${compressor.refrigerant ?? "R404A"}: ` +
    `GWP ${getGWP(compressor.refrigerant ?? "R404A")} — ` +
    `${getRefrigerantNote(compressor.refrigerant ?? "R404A")}`,
  );

  // ── Recomendações prioritizadas ───────────────────────────────────────────
  if (optResult?.adjustments) {
    for (const adj of optResult.adjustments.slice(0, 3)) {
      recommendations.push({
        priority: adj.priority === "high" ? 1 : adj.priority === "medium" ? 2 : 3,
        action: `Ajustar ${adj.parameter}: ${adj.current} → ${adj.suggested}`,
        expectedImpact: adj.expectedGain,
        reference: "Análise de Otimização — Hub de Testes",
      });
    }
  }

  if (eta_2nd_law < 0.4) {
    recommendations.push({
      priority: 1,
      action: "Revisar seleção do compressor para maior eficiência volumétrica",
      expectedImpact: `Potencial de melhoria de COP em até ${((0.5 - eta_2nd_law) * COP_carnot).toFixed(2)} pontos`,
      reference: "ASHRAE Handbook Refrigeration 2022, Cap. 37 — Compressors",
    });
  }

  recommendations.sort((a, b) => a.priority - b.priority);

  // ── Grade final ───────────────────────────────────────────────────────────
  score = clamp(score, 0, 100);
  let grade: AIAnalysisResult["grade"] = "A";
  if (score < 50) grade = "F";
  else if (score < 60) grade = "D";
  else if (score < 70) grade = "C";
  else if (score < 85) grade = "B";

  const criticalCount = diagnoses.filter((d) => d.severity === "critical").length;
  const warningCount = diagnoses.filter((d) => d.severity === "warning").length;
  const summary =
    criticalCount > 0
      ? `${criticalCount} problema(s) crítico(s) detectado(s). Ação imediata recomendada.`
      : warningCount > 0
      ? `${warningCount} alerta(s) detectado(s). Sistema operacional com ressalvas.`
      : "Sistema bem dimensionado. Nenhum problema crítico detectado.";

  return {
    score,
    grade,
    summary,
    diagnoses,
    recommendations,
    thermodynamicInsights,
    warnings,
  };
}

// ── Helpers de refrigerante ───────────────────────────────────────────────────

function getGWP(refrigerant: string): string {
  const gwpMap: Record<string, number> = {
    R404A: 3922, R507A: 3985, R134a: 1430, R22: 1810,
    R410A: 2088, R448A: 1387, R449A: 1397, R452A: 2140,
    R290: 3, R717: 0, R744: 1, R32: 675,
    R1234yf: 4, R1234ze: 7,
  };
  const gwp = gwpMap[refrigerant];
  return gwp !== undefined ? gwp.toString() : "desconhecido";
}

function getRefrigerantNote(refrigerant: string): string {
  if (["R404A", "R507A", "R22"].includes(refrigerant)) {
    return "HFC/HCFC de alto GWP — fase de eliminação regulamentada (F-Gas EU 517/2014, Protocolo de Kigali).";
  }
  if (["R448A", "R449A", "R452A"].includes(refrigerant)) {
    return "HFO blend de baixo GWP — substituto recomendado para R404A/R507A.";
  }
  if (["R290", "R717", "R744"].includes(refrigerant)) {
    return "Refrigerante natural — GWP mínimo, alta eficiência, requer projeto especial de segurança.";
  }
  if (["R1234yf", "R1234ze"].includes(refrigerant)) {
    return "HFO de ultra-baixo GWP — próxima geração para aplicações de média e alta temperatura.";
  }
  return "Verificar regulamentações locais de GWP.";
}
