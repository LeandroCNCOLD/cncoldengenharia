// Coeficientes de troca térmica reais para o motor V2.
//
// Lado AR  : correlação Wang-Chi-Chang (2000) / Mihailovic (2019) / Granryd (1965)
//            calculada dinamicamente a partir dos dados geométricos.
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
import { calculateWangChiChang } from "../engine/wangChiChang";
import type { CnCoilsPhysicalInputs } from "../types/cncoils.types";

export interface AirSideHResult {
  h_air_Wm2K: number;
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
    return { h_air_Wm2K: 25, warnings };
  }

  return { h_air_Wm2K: wcc.hAirWm2K, warnings };
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
}

export interface ComputeOverallUResult {
  U_o: number;
  warnings: string[];
}

export function computeOverallU(params: ComputeOverallUParams): ComputeOverallUResult {
  const { h_o, h_i, r_o_m, r_i_m, k_tube_WmK = K_TUBE.copper } = params;
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

  const R_o = 1 / h_o;
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
