// Coeficientes de troca térmica reais para o motor V2.
//
// Lado AR  : correlação polinomial UNILAB (lida do JSON unilabHeatTransferCoefficients.json).
//            Sem fallback "inventado": se o JSON não tem coeficientes para a
//            geometria selecionada, lançamos UnilabCoefficientsMissingError.
//
// Lado FLUIDO :
//   - monofásico → Dittus-Boelter   Nu = 0.023 · Re^0.8 · Pr^n  (n=0.4 aquec, 0.3 resfr)
//   - bifásico   → Shah simplificado: h_tp = h_l · F(x)
//                  onde h_l é Dittus-Boelter aplicado à fase líquida e
//                  F(x) ≈ (1-x)^0.8 + 3.8·x^0.76·(1-x)^0.04 / Pr^0.38
//                  (Shah 1979, forma compacta).
//
// Resistência global (por área externa):
//   1/U_o = 1/h_air + R_wall + (Do/Di)/h_fluid + R_fouling

import type { FluidPhase } from "./phaseLogic";

export class UnilabCoefficientsMissingError extends Error {
  constructor(public readonly geometryId: string) {
    super(
      `Coeficientes UNILAB ausentes para a geometria "${geometryId}". ` +
        `Preencha public/data/catalogs/unilabHeatTransferCoefficients.json antes de rodar o motor V2.`,
    );
    this.name = "UnilabCoefficientsMissingError";
  }
}

/** Schema do JSON de coeficientes UNILAB (preenchido pelo usuário). */
export interface UnilabHeatTransferCoeffEntry {
  geometryId: string;
  /**
   * Polinômio para h_ar [W/(m²·K)] em função da velocidade frontal v [m/s]:
   *   h_air(v) = c0 + c1·v + c2·v² + c3·v³ + ...
   */
  h_air_polynomial: number[];
  /** Faixa de validade [m/s]. Fora da faixa → warning, mas não bloqueia. */
  vMin?: number;
  vMax?: number;
  /** Fator de eficiência da aleta (η_aleta · A_aleta/A_total), adimensional. */
  finEfficiency?: number;
  /** Fator multiplicativo opcional sobre a área externa total. */
  areaCorrection?: number;
}

export interface UnilabHeatTransferCatalog {
  entries: UnilabHeatTransferCoeffEntry[];
}

/** Avalia o polinômio (ordem por índice). */
function polyEval(coeffs: number[], x: number): number {
  let acc = 0;
  let xp = 1;
  for (const c of coeffs) {
    acc += c * xp;
    xp *= x;
  }
  return acc;
}

export interface AirSideHCoeffResult {
  h_air_Wm2K: number;
  warnings: string[];
}

export function computeAirSideH(
  geometryId: string,
  faceVelocityMs: number,
  catalog: UnilabHeatTransferCatalog,
): AirSideHCoeffResult {
  const entry = catalog.entries.find((e) => e.geometryId === geometryId);
  if (!entry || !entry.h_air_polynomial || entry.h_air_polynomial.length === 0) {
    throw new UnilabCoefficientsMissingError(geometryId);
  }
  const warnings: string[] = [];
  if (entry.vMin !== undefined && faceVelocityMs < entry.vMin) {
    warnings.push(
      `Velocidade frontal ${faceVelocityMs.toFixed(2)} m/s abaixo da faixa válida (${entry.vMin}).`,
    );
  }
  if (entry.vMax !== undefined && faceVelocityMs > entry.vMax) {
    warnings.push(
      `Velocidade frontal ${faceVelocityMs.toFixed(2)} m/s acima da faixa válida (${entry.vMax}).`,
    );
  }
  const h = polyEval(entry.h_air_polynomial, faceVelocityMs);
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error(
      `h_air calculado inválido para ${geometryId} a v=${faceVelocityMs} m/s.`,
    );
  }
  return { h_air_Wm2K: h, warnings };
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

/**
 * Shah simplificado para troca bifásica (correlação local, x médio = 0.5).
 * Retorna h_two_phase a partir de h_liquid (Dittus-Boelter na fase líquida).
 */
export function shahTwoPhase(h_liquid_Wm2K: number, quality_x = 0.5, Pr_l = 3): number {
  const x = Math.min(Math.max(quality_x, 0.01), 0.99);
  const F =
    Math.pow(1 - x, 0.8) +
    (3.8 * Math.pow(x, 0.76) * Math.pow(1 - x, 0.04)) / Math.pow(Pr_l, 0.38);
  return h_liquid_Wm2K * F;
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

export function overallU(inputs: OverallUInputs): number {
  const Do = inputs.tubeOuterDiameterM;
  const Di = inputs.tubeInnerDiameterM;
  const k = inputs.tubeWallConductivity_Wm_K;
  if (Do <= 0 || Di <= 0 || k <= 0) return Number.NaN;

  const R_air = 1 / inputs.h_air_Wm2K;
  const R_wall = (Do * Math.log(Do / Di)) / (2 * k);
  const R_fluid = (Do / Di) / inputs.h_fluid_Wm2K;
  const R_fouling_e = inputs.foulingExternal_m2K_W ?? 0;
  const R_fouling_i = (inputs.foulingInternal_m2K_W ?? 0) * (Do / Di);

  const R_total = R_air + R_wall + R_fluid + R_fouling_e + R_fouling_i;
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
