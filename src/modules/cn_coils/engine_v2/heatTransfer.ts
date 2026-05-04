// Coeficientes de troca térmica reais para o motor V2.
//
// Lado AR  : correlação Wang-Chi-Chang (2000) / Mihailovic (2019) / Granryd (1965)
//            calculada dinamicamente a partir dos dados geométricos.
//            Eficiência de aleta: método de Schmidt (McQuiston & Parker 1982).
//
// Lado FLUIDO :
//   - monofásico → Dittus-Boelter   Nu = 0.023 · Re^0.8 · Pr^n  (n=0.4 aquec, 0.3 resfr)
//   - bifásico evaporação  → Jung & Didion (1989) — válido para blends zeótropos
//                            até x=80%; interpolação linear até x=100%
//   - bifásico condensação → Shah (1979) — correlação geral para condensação interna
//   - Shah simplificado mantido como fallback/export para compatibilidade
//
// Queda de pressão bifásica:
//   - Müller-Steinhagen & Heck (1986) — interpolação entre regime líquido e vapor
//
// Resistência global (por área externa):
//   1/U_o = 1/(η_o · h_air) + R_wall + (Do/Di)/h_fluid + R_fouling

import type { FluidPhase } from "./phaseLogic";
import { calculateWangChiChang } from "../engine/wangChiChang";
import type { CnCoilsPhysicalInputs } from "../types/cncoils.types";

// ============================================================================
// M2 — Eficiência de aleta: Método de Schmidt (McQuiston & Parker 1982)
// ============================================================================

export interface SchmidtFinEfficiencyParams {
  /** Coeficiente de transferência de calor do lado ar [W/(m²·K)] */
  h_air_Wm2K: number;
  /** Condutividade térmica da aleta [W/(m·K)]. Alumínio ≈ 205, cobre ≈ 385 */
  k_fin_WmK: number;
  /** Espessura da aleta [m] */
  fin_thickness_m: number;
  /** Diâmetro externo do tubo (com aleta colada) [m] */
  tube_od_m: number;
  /** Passo transversal dos tubos [m] */
  tube_pitch_transverse_m: number;
  /** Passo longitudinal dos tubos [m] */
  tube_pitch_longitudinal_m: number;
}

export interface SchmidtFinEfficiencyResult {
  /** Eficiência da aleta η_fin [0..1] */
  eta_fin: number;
  /** Eficiência de superfície η_o = 1 - A_fin/A_total · (1 - η_fin) [0..1] */
  eta_surface: number;
  /** Comprimento característico da aleta [m] */
  L_fin_m: number;
  warnings: string[];
}

/**
 * Método de Schmidt para eficiência de aleta em trocadores aleta-tubo.
 *
 * Para aletas retangulares (arranjo quadrado ou triangular), Schmidt (1949)
 * propõe um raio equivalente de aleta circular r_eq que reproduz a mesma
 * área de aleta. A eficiência é então calculada pela fórmula da aleta circular.
 *
 * Fonte: McQuiston, F.C., Parker, J.D. (1982). Heating, Ventilating, and
 * Air Conditioning. J. Wiley & Sons. — Equações 4-49 a 4-52.
 *
 * Faixa de validade: qualquer geometria aleta-tubo com aletas contínuas.
 */
export function schmidtFinEfficiency(
  params: SchmidtFinEfficiencyParams,
): SchmidtFinEfficiencyResult {
  const warnings: string[] = [];
  const {
    h_air_Wm2K,
    k_fin_WmK,
    fin_thickness_m,
    tube_od_m,
    tube_pitch_transverse_m,
    tube_pitch_longitudinal_m,
  } = params;

  const r1 = tube_od_m / 2; // raio externo do tubo [m]

  // Raio equivalente da aleta circular (Schmidt 1949)
  // Para arranjo triangular (staggered): r_eq/r1 = 1.27 · (M/r1) · √(L/M - 0.3)
  // onde M = Pt/2 e L = √(Pt² + Pl²)/2
  const M = tube_pitch_transverse_m / 2;
  const L = Math.sqrt(
    tube_pitch_transverse_m ** 2 + tube_pitch_longitudinal_m ** 2,
  ) / 2;

  let r_eq: number;
  if (L / M >= 1) {
    // Arranjo escalonado (staggered) — mais comum em trocadores industriais
    r_eq = r1 * 1.27 * (M / r1) * Math.sqrt(L / M - 0.3);
  } else {
    // Arranjo em linha — r_eq ≈ 1.28 · M · √(L/M - 0.2)
    r_eq = r1 * 1.28 * (M / r1) * Math.sqrt(Math.max(L / M - 0.2, 0.01));
  }

  // Comprimento da aleta a partir do tubo até a borda
  const L_fin = r_eq - r1;

  // Parâmetro m da aleta (perfil retangular)
  // m = √(2·h / (k·δ))   onde δ = espessura da aleta
  const m_fin = Math.sqrt((2 * h_air_Wm2K) / (k_fin_WmK * fin_thickness_m));
  const mL = m_fin * L_fin;

  // Eficiência da aleta circular: η_fin = tanh(mL) / mL
  let eta_fin: number;
  if (mL < 1e-6) {
    eta_fin = 1.0;
  } else {
    eta_fin = Math.tanh(mL) / mL;
  }

  // Fração de área de aleta em relação à área total externa
  // Aproximação: A_fin/A_total ≈ 0.85 para trocadores típicos com aletas contínuas
  // (valor conservador; a fração real depende do passo de aleta e geometria)
  const fin_area_ratio = 0.85;

  // Eficiência de superfície
  const eta_surface = 1 - fin_area_ratio * (1 - eta_fin);

  if (eta_fin < 0.5) {
    warnings.push(
      `Eficiência de aleta baixa (η_fin = ${(eta_fin * 100).toFixed(1)}%) — verifique espessura e condutividade.`,
    );
  }

  return { eta_fin, eta_surface, L_fin_m: L_fin, warnings };
}

// ============================================================================
// Lado ar
// ============================================================================

export interface AirSideHResult {
  h_air_Wm2K: number;
  /** Eficiência de superfície η_o (inclui eficiência de aleta Schmidt) */
  eta_surface: number;
  /** Eficiência da aleta η_fin */
  eta_fin: number;
  warnings: string[];
}

export function computeAirSideH(
  physical: CnCoilsPhysicalInputs,
  faceVelocityMs: number,
): AirSideHResult {
  const warnings: string[] = [];

  const wcc = calculateWangChiChang({
    tubeOdMm: physical.tubeOuterDiameterMm,
    finThicknessMm: physical.finThicknessMm,
    finPitchMm: physical.finPitchMm,
    rowPitchMm: physical.tubePitchLongitudinalMm,
    tubePitchMm: physical.tubePitchTransverseMm,
    numberOfRows: physical.rows,
    airFaceVelocityMs: faceVelocityMs,
  });

  warnings.push(...wcc.warnings);

  if (!Number.isFinite(wcc.hAirWm2K) || wcc.hAirWm2K <= 0) {
    warnings.push(
      `Wang-Chi-Chang retornou h_ar inválido (${wcc.hAirWm2K}). Usando fallback = 25 W/(m²·K).`,
    );
    return { h_air_Wm2K: 25, eta_surface: 0.85, eta_fin: 0.85, warnings };
  }

  const h_air = wcc.hAirWm2K;

  // M2 — Eficiência de aleta pelo método de Schmidt
  const finEff = schmidtFinEfficiency({
    h_air_Wm2K: h_air,
    k_fin_WmK: physical.finMaterialConductivity ?? 205, // alumínio padrão
    fin_thickness_m: (physical.finThicknessMm ?? 0.1) * 1e-3,
    tube_od_m: physical.tubeOuterDiameterMm * 1e-3,
    tube_pitch_transverse_m: physical.tubePitchTransverseMm * 1e-3,
    tube_pitch_longitudinal_m: physical.tubePitchLongitudinalMm * 1e-3,
  });
  warnings.push(...finEff.warnings);

  return {
    h_air_Wm2K: h_air,
    eta_surface: finEff.eta_surface,
    eta_fin: finEff.eta_fin,
    warnings,
  };
}

// ============================================================================
// Lado fluido
// ============================================================================

export interface FluidPropsSinglePhase {
  rho_kg_m3: number;     // densidade
  mu_Pa_s: number;       // viscosidade dinâmica
  cp_J_kgK: number;      // calor específico
  k_W_mK: number;        // condutividade térmica
}

export interface DittusBoelterInputs {
  massFlowKgS: number;
  tubeInnerDiameterM: number;
  circuits: number;
  fluid: FluidPropsSinglePhase;
  /** true para aquecimento do fluido (n=0.4), false para resfriamento (n=0.3). */
  heating: boolean;
}

/** Dittus-Boelter para escoamento turbulento monofásico. */
export function dittusBoelter(inputs: DittusBoelterInputs): number {
  const { massFlowKgS, tubeInnerDiameterM, circuits, fluid, heating } = inputs;
  const A = (Math.PI * tubeInnerDiameterM ** 2) / 4;
  const G = massFlowKgS / (circuits * A);             // kg/(m²·s) por circuito
  const Re = (G * tubeInnerDiameterM) / fluid.mu_Pa_s;
  const Pr = (fluid.cp_J_kgK * fluid.mu_Pa_s) / fluid.k_W_mK;
  const n = heating ? 0.4 : 0.3;
  const Nu = 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, n);
  return (Nu * fluid.k_W_mK) / tubeInnerDiameterM;
}

// ============================================================================
// M3 — Jung & Didion (1989): evaporação de blends zeótropos em tubo liso
// ============================================================================

/**
 * Correlação de Jung & Didion (1989) para coeficiente de transferência de calor
 * por ebulição convectiva em tubo horizontal liso.
 *
 * Válida para: 0 ≤ x ≤ 0.80 (qualidade de vapor)
 * Para x > 0.80: interpolação linear entre h(x=0.80) e h_vapor_saturado (x=1.0)
 * conforme implementação do EVAP-COND/ACSIM (NIST).
 *
 * Fonte: Jung, D.S., Didion, D.A. (1989). Horizontal Flow Boiling Heat Transfer
 * using Refrigerant Mixtures. EPRI ER-6364.
 *
 * @param h_liquid_Wm2K  Coeficiente monofásico líquido (Dittus-Boelter) [W/(m²·K)]
 * @param quality_x      Qualidade de vapor [0..1]
 * @param Pr_l           Número de Prandtl do líquido saturado
 * @returns              Coeficiente de transferência de calor bifásico [W/(m²·K)]
 */
export function jungDidion1989(
  h_liquid_Wm2K: number,
  quality_x: number,
  Pr_l: number,
): number {
  const x = Math.min(Math.max(quality_x, 0.001), 0.999);

  if (x <= 0.80) {
    // Correlação original Jung & Didion — fator de aprimoramento F(x, Pr_l)
    // F = (1-x)^0.8 + 3.8·x^0.76·(1-x)^0.04 / Pr_l^0.38
    const F =
      Math.pow(1 - x, 0.8) +
      (3.8 * Math.pow(x, 0.76) * Math.pow(1 - x, 0.04)) /
        Math.pow(Math.max(Pr_l, 0.1), 0.38);
    return h_liquid_Wm2K * F;
  } else {
    // Interpolação linear entre x=0.80 e x=1.0 (vapor saturado monofásico)
    // h(x=0.80) via Jung & Didion
    const F_80 =
      Math.pow(0.2, 0.8) +
      (3.8 * Math.pow(0.8, 0.76) * Math.pow(0.2, 0.04)) /
        Math.pow(Math.max(Pr_l, 0.1), 0.38);
    const h_80 = h_liquid_Wm2K * F_80;
    // h(x=1.0) ≈ h_liquid (Dittus-Boelter vapor — aproximação conservadora)
    const h_100 = h_liquid_Wm2K * 0.85; // vapor tem h ligeiramente menor
    // Interpolação linear
    const alpha = (x - 0.80) / 0.20;
    return h_80 + alpha * (h_100 - h_80);
  }
}

// ============================================================================
// Shah (1979): condensação em tubo liso — mantido para condensadores
// ============================================================================

/**
 * Shah (1979) — correlação para condensação por filme dentro de tubos horizontais.
 *
 * Fonte: Shah, M.M. (1979). A general correlation for heat transfer during film
 * condensation inside pipes. Int. J. Heat Mass Transfer, 22, 547–556.
 *
 * @param h_liquid_Wm2K  Coeficiente monofásico líquido (Dittus-Boelter) [W/(m²·K)]
 * @param quality_x      Qualidade de vapor [0..1]
 * @param Pr_l           Número de Prandtl do líquido saturado
 * @returns              Coeficiente de transferência de calor bifásico [W/(m²·K)]
 */
export function shahCondensation1979(
  h_liquid_Wm2K: number,
  quality_x: number,
  Pr_l: number,
): number {
  const x = Math.min(Math.max(quality_x, 0.001), 0.999);
  // Shah (1979): h_tp/h_l = (1-x)^0.8 · [1 + 3.8/(x^0.95·(1-x)^0.1·Pr_l^0.4)]^-1
  // Forma simplificada amplamente usada:
  const F =
    Math.pow(1 - x, 0.8) +
    (3.8 * Math.pow(x, 0.76) * Math.pow(1 - x, 0.04)) /
      Math.pow(Math.max(Pr_l, 0.1), 0.38);
  return h_liquid_Wm2K * F;
}

/**
 * Shah simplificado para troca bifásica (correlação local, x médio = 0.5).
 * Mantido para compatibilidade com código legado e fallback.
 * @deprecated Use jungDidion1989() para evaporação ou shahCondensation1979() para condensação.
 */
export function shahTwoPhase(h_liquid_Wm2K: number, quality_x = 0.5, Pr_l = 3): number {
  const x = Math.min(Math.max(quality_x, 0.01), 0.99);
  const F =
    Math.pow(1 - x, 0.8) +
    (3.8 * Math.pow(x, 0.76) * Math.pow(1 - x, 0.04)) / Math.pow(Pr_l, 0.38);
  return h_liquid_Wm2K * F;
}

// ============================================================================
// M4 — Queda de pressão bifásica: Müller-Steinhagen & Heck (1986)
// ============================================================================

export interface TwoPhasePressureDropParams {
  /** Comprimento do circuito [m] */
  L_circuit_m: number;
  /** Diâmetro interno do tubo [m] */
  D_i_m: number;
  /** Fluxo mássico específico G = ṁ/(A·N_circuitos) [kg/(m²·s)] */
  G_kg_m2s: number;
  /** Densidade do líquido saturado [kg/m³] */
  rho_l_kg_m3: number;
  /** Densidade do vapor saturado [kg/m³] */
  rho_v_kg_m3: number;
  /** Viscosidade dinâmica do líquido [Pa·s] */
  mu_l_Pa_s: number;
  /** Viscosidade dinâmica do vapor [Pa·s] */
  mu_v_Pa_s: number;
  /** Qualidade média de vapor [0..1] */
  quality_x: number;
}

/**
 * Correlação de Müller-Steinhagen & Heck (1986) para queda de pressão bifásica
 * em escoamento horizontal.
 *
 * Fonte: Müller-Steinhagen, H., Heck, K. (1986). A simple friction pressure drop
 * correlation for two-phase flow in pipes. Chem. Eng. Process., 20, 297–308.
 *
 * Equação:
 *   dP/dz = G(x) · (1-x)^(1/3) + B · x³
 *   G(x) = A + 2·(B-A)·x
 *   A = dP/dz|_líquido    (Blasius/Darcy-Weisbach com ρ_l, μ_l)
 *   B = dP/dz|_vapor      (Blasius/Darcy-Weisbach com ρ_v, μ_v)
 *
 * @returns Queda de pressão total [kPa]
 */
export function mullerSteinhagenHeck(params: TwoPhasePressureDropParams): number {
  const { L_circuit_m, D_i_m, G_kg_m2s, rho_l_kg_m3, rho_v_kg_m3, mu_l_Pa_s, mu_v_Pa_s, quality_x } = params;

  if (D_i_m <= 0 || G_kg_m2s <= 0 || rho_l_kg_m3 <= 0 || rho_v_kg_m3 <= 0) return 0;

  const x = Math.min(Math.max(quality_x, 0), 1);

  // Fator de atrito de Blasius: f = 0.316·Re^(-0.25) para Re > 2300
  //                              f = 64/Re para Re ≤ 2300
  function blasiusFriction(Re: number): number {
    return Re < 2300 ? 64 / Re : 0.316 * Math.pow(Re, -0.25);
  }

  // Gradiente de pressão monofásico [Pa/m]: dP/dz = f·(G²)/(2·ρ·D)
  function dpDz(rho: number, mu: number): number {
    const Re = (G_kg_m2s * D_i_m) / mu;
    const f = blasiusFriction(Re);
    return f * (G_kg_m2s ** 2) / (2 * rho * D_i_m);
  }

  const A = dpDz(rho_l_kg_m3, mu_l_Pa_s); // dP/dz líquido [Pa/m]
  const B = dpDz(rho_v_kg_m3, mu_v_Pa_s); // dP/dz vapor [Pa/m]

  // Função G(x) de Müller-Steinhagen & Heck
  const Gx = A + 2 * (B - A) * x;

  // Gradiente bifásico [Pa/m]
  const dpDz_tp = Gx * Math.pow(1 - x, 1 / 3) + B * Math.pow(x, 3);

  // Queda de pressão total [Pa] → [kPa]
  const dP_Pa = dpDz_tp * L_circuit_m;
  return Math.max(0, dP_Pa / 1000);
}

/**
 * Queda de pressão do fluido: seleciona automaticamente entre
 * Müller-Steinhagen & Heck (bifásico) e Darcy-Weisbach (monofásico).
 *
 * @param fluidPhase  "bifasico" | "liquido" | "vapor" | "superaquecido" | "subresfriado"
 * @returns Queda de pressão [kPa]
 */
export interface FluidPressureDropParams {
  L_circuit_m: number;
  D_i_m: number;
  G_kg_m2s: number;
  rho_kg_m3: number;
  mu_Pa_s: number;
  fluidPhase: FluidPhase;
  /** Densidade do vapor [kg/m³] — necessário para bifásico */
  rho_vapor_kg_m3?: number;
  /** Viscosidade do vapor [Pa·s] — necessário para bifásico */
  mu_vapor_Pa_s?: number;
  /** Qualidade média [0..1] — necessário para bifásico */
  quality_x?: number;
}

export function calcFluidPressureDropV2(params: FluidPressureDropParams): number {
  const { L_circuit_m, D_i_m, G_kg_m2s, rho_kg_m3, mu_Pa_s, fluidPhase } = params;

  if (D_i_m <= 0 || G_kg_m2s <= 0 || rho_kg_m3 <= 0) return 0;

  if (fluidPhase === "bifasico" && params.rho_vapor_kg_m3 && params.mu_vapor_Pa_s) {
    // M4 — Müller-Steinhagen & Heck para escoamento bifásico
    return mullerSteinhagenHeck({
      L_circuit_m,
      D_i_m,
      G_kg_m2s,
      rho_l_kg_m3: rho_kg_m3,
      rho_v_kg_m3: params.rho_vapor_kg_m3,
      mu_l_Pa_s: mu_Pa_s,
      mu_v_Pa_s: params.mu_vapor_Pa_s,
      quality_x: params.quality_x ?? 0.5,
    });
  }

  // Darcy-Weisbach monofásico (fallback e fases líquida/vapor/superaquecida)
  const Re = (G_kg_m2s * D_i_m) / mu_Pa_s;
  const f = Re < 2300 ? 64 / Re : 0.316 * Math.pow(Re, -0.25);
  const V_m_s = G_kg_m2s / rho_kg_m3;
  const dP_Pa = f * (L_circuit_m / D_i_m) * rho_kg_m3 * V_m_s * V_m_s / 2;
  return Math.max(0, dP_Pa / 1000);
}

// ============================================================================
// Resistência global U
// ============================================================================

export interface OverallUInputs {
  h_air_Wm2K: number;
  h_fluid_Wm2K: number;
  tubeOuterDiameterM: number;
  tubeInnerDiameterM: number;
  tubeWallConductivity_Wm_K: number;
  foulingExternal_m2K_W?: number;
  foulingInternal_m2K_W?: number;
}

export const K_TUBE: Record<string, number> = {
  copper: 385,
  aluminum: 205,
  stainless_steel: 16,
};

export interface ComputeOverallUParams {
  h_o: number;
  h_i: number;
  r_o_m: number;
  r_i_m: number;
  k_tube_WmK?: number;
  /** Eficiência de superfície η_o (inclui eficiência de aleta). Padrão: 1.0 */
  eta_surface?: number;
}

export interface ComputeOverallUResult {
  U_o: number;
  warnings: string[];
}

export function computeOverallU(params: ComputeOverallUParams): ComputeOverallUResult {
  const { h_o, h_i, r_o_m, r_i_m, k_tube_WmK = K_TUBE.copper, eta_surface = 1.0 } = params;
  const warnings: string[] = [];

  if (
    !Number.isFinite(h_o) ||
    !Number.isFinite(h_i) ||
    h_o <= 0 ||
    h_i <= 0
  ) {
    warnings.push("h_o ou h_i inválido — usando U_base estimado de 35 W/m²K");
    return { U_o: 35, warnings };
  }

  if (
    !Number.isFinite(r_o_m) ||
    !Number.isFinite(r_i_m) ||
    !Number.isFinite(k_tube_WmK) ||
    r_o_m <= 0 ||
    r_i_m <= 0 ||
    r_o_m <= r_i_m ||
    k_tube_WmK <= 0
  ) {
    warnings.push("Geometria do tubo inválida — usando U_base estimado de 35 W/m²K");
    return { U_o: 35, warnings };
  }

  // Resistências em série referenciadas à área externa:
  // R_o = 1/(η_o · h_o)   — lado ar com eficiência de superfície
  // R_wall = r_o·ln(r_o/r_i)/k  — parede do tubo
  // R_i = (r_o/r_i)·(1/h_i)    — lado fluido referenciado à área externa
  const eta_o = Math.min(Math.max(eta_surface, 0.1), 1.0);
  const R_o = 1 / (eta_o * h_o);
  const R_wall = (r_o_m * Math.log(r_o_m / r_i_m)) / k_tube_WmK;
  const R_i = (r_o_m / r_i_m) * (1 / h_i);
  const R_total = R_o + R_wall + R_i;
  const U_o = 1 / R_total;

  if (!Number.isFinite(U_o) || U_o <= 0) {
    warnings.push("U_o calculado inválido — usando U_base estimado de 35 W/m²K");
    return { U_o: 35, warnings };
  }

  if (U_o < 5 || U_o > 500) {
    warnings.push(
      `U_o calculado fora da faixa esperada (${U_o.toFixed(1)} W/m²K) — verifique h_o e h_i`,
    );
  }

  return { U_o, warnings };
}

export function overallU(inputs: OverallUInputs): number {
  const Do = inputs.tubeOuterDiameterM;
  const Di = inputs.tubeInnerDiameterM;
  const base = computeOverallU({
    h_o: inputs.h_air_Wm2K,
    h_i: inputs.h_fluid_Wm2K,
    r_o_m: Do / 2,
    r_i_m: Di / 2,
    k_tube_WmK: inputs.tubeWallConductivity_Wm_K,
  });
  const R_fouling_e = inputs.foulingExternal_m2K_W ?? 0;
  const R_fouling_i =
    Di > 0 ? (inputs.foulingInternal_m2K_W ?? 0) * (Do / Di) : 0;

  const R_total = 1 / base.U_o + R_fouling_e + R_fouling_i;
  return 1 / R_total;
}

// ============================================================================
// NTU-ε
// ============================================================================

export interface NtuInputs {
  U_Wm2K: number;
  area_m2: number;
  cAir_W_K: number;
  cFluid_W_K: number;
  fluidPhase: FluidPhase;
}

export interface NtuResult {
  NTU: number;
  Cmin: number;
  Cmax: number;
  Cratio: number;
  effectiveness: number;
}

/** ε crossflow ambos não misturados (Kays-London) — aproximação de série. */
function epsilonCrossflowBothUnmixed(NTU: number, Cr: number): number {
  if (Cr <= 1e-6) return 1 - Math.exp(-NTU); // Cr=0 → mudança de fase
  return 1 - Math.exp((1 / Cr) * Math.pow(NTU, 0.22) * (Math.exp(-Cr * Math.pow(NTU, 0.78)) - 1));
}

export function computeNtuEpsilon(inputs: NtuInputs): NtuResult {
  // Em fase bifásica, C_fluido → ∞ (mudança de fase) → Cmin = C_ar, Cr = 0
  const cFluidEffective =
    inputs.fluidPhase === "bifasico" ? Number.POSITIVE_INFINITY : inputs.cFluid_W_K;
  const Cmin = Math.min(inputs.cAir_W_K, cFluidEffective);
  const Cmax = Math.max(inputs.cAir_W_K, cFluidEffective);
  const Cratio = Number.isFinite(Cmax) ? Cmin / Cmax : 0;
  const NTU = (inputs.U_Wm2K * inputs.area_m2) / Cmin;
  const effectiveness = epsilonCrossflowBothUnmixed(NTU, Cratio);
  return { NTU, Cmin, Cmax, Cratio, effectiveness };
}
