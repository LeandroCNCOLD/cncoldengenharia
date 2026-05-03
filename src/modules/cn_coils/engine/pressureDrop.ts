// Perda de carga lado ar (catálogo UNILAB) e lado fluido (Darcy-Weisbach
// simplificado, monofásico). Sem fallback silencioso para zero.

import type { PressureDropFanItem } from "../types/unilab.types";
import { mmToM, safeDivide, KPA_TO_PA } from "./units";

export interface AirPressureDropResult {
  pressureDropPa: number;
  warnings: string[];
}

export interface ComputeAirPressureDropParams {
  v_face_ms: number;
  T_ar_C: number;
  N_rows: number;
  D_c_m: number;
  fin_pitch_m: number;
  fin_thickness_m: number;
  tube_pitch_transv_m: number;
  tube_pitch_longit_m: number;
}

export function computeAirPressureDrop(
  params: ComputeAirPressureDropParams,
): { dP_Pa: number; warnings: string[] } {
  const {
    v_face_ms,
    T_ar_C,
    N_rows,
    D_c_m,
    fin_pitch_m,
    fin_thickness_m,
    tube_pitch_transv_m,
    tube_pitch_longit_m,
  } = params;
  const warnings: string[] = [];

  if (
    !Number.isFinite(v_face_ms) ||
    !Number.isFinite(T_ar_C) ||
    !Number.isFinite(N_rows) ||
    !Number.isFinite(D_c_m) ||
    !Number.isFinite(fin_pitch_m) ||
    !Number.isFinite(fin_thickness_m) ||
    !Number.isFinite(tube_pitch_transv_m) ||
    !Number.isFinite(tube_pitch_longit_m) ||
    v_face_ms <= 0 ||
    N_rows <= 0 ||
    D_c_m <= 0 ||
    fin_pitch_m <= fin_thickness_m ||
    tube_pitch_transv_m <= 0 ||
    tube_pitch_longit_m <= 0
  ) {
    return {
      dP_Pa: NaN,
      warnings: ["Parâmetros inválidos para estimar ΔP ar por correlação."],
    };
  }

  const T_K = T_ar_C + 273.15;
  if (T_K <= 0) {
    return {
      dP_Pa: NaN,
      warnings: ["Temperatura do ar inválida para estimar ΔP ar."],
    };
  }

  // Densidade por gás ideal à pressão atmosférica e viscosidade por Sutherland.
  const rho_ar = 1.2929 * (273.15 / T_K);
  const mu_ar = (1.458e-6 * Math.pow(T_K, 1.5)) / (T_K + 110.4);

  const freeFinGapM = fin_pitch_m - fin_thickness_m;
  const A_c = freeFinGapM * tube_pitch_transv_m;
  const P_wet = 2 * (freeFinGapM + tube_pitch_transv_m);
  const D_h = (4 * A_c) / P_wet;

  // A correlação usa a velocidade no canal entre aletas. A velocidade frontal
  // precisa ser corrigida pela contração da área livre do feixe aletado.
  const sigmaFin = freeFinGapM / fin_pitch_m;
  const sigmaTube = Math.max(0.05, (tube_pitch_transv_m - D_c_m) / tube_pitch_transv_m);
  const sigma = Math.max(0.05, sigmaFin * sigmaTube);
  const vMaxMs = v_face_ms / sigma;
  const Re_Dh = (rho_ar * vMaxMs * D_h) / mu_ar;
  const s = fin_pitch_m;
  const f_ar =
    0.508 * Math.pow(Re_Dh, -0.521) * Math.pow(s / D_c_m, 1.318);
  const bundleDensity =
    (tube_pitch_transv_m / freeFinGapM) *
    (tube_pitch_longit_m / freeFinGapM) *
    (1 / sigmaTube);
  const dP_Pa =
    f_ar *
    N_rows *
    (D_c_m / D_h) *
    bundleDensity *
    ((rho_ar * vMaxMs * vMaxMs) / 2);

  if (!Number.isFinite(dP_Pa) || dP_Pa < 0) {
    return {
      dP_Pa: NaN,
      warnings: ["ΔP ar estimado por correlação resultou inválido."],
    };
  }

  if (Re_Dh < 100 || Re_Dh > 10000) {
    warnings.push(
      `Re_Dh=${Re_Dh.toFixed(0)} fora da faixa da correlação de ΔP ar`,
    );
  }

  return { dP_Pa, warnings };
}

export function calculateAirPressureDrop(
  geometryId: string,
  airVelocityMs: number,
  catalog: PressureDropFanItem[],
  fallbackParams?: Omit<ComputeAirPressureDropParams, "v_face_ms">,
): AirPressureDropResult {
  const warnings: string[] = [];
  const item = catalog.find((c) => c.geometryId === geometryId);
  if (!item) {
    if (fallbackParams) {
      const estimated = computeAirPressureDrop({
        ...fallbackParams,
        v_face_ms: airVelocityMs,
      });
      if (Number.isFinite(estimated.dP_Pa) && estimated.dP_Pa >= 0) {
        return {
          pressureDropPa: estimated.dP_Pa,
          warnings: [
            "ΔP ar estimado por correlação Chang & Wang (1997).",
            ...estimated.warnings,
          ],
        };
      }
      return { pressureDropPa: NaN, warnings: estimated.warnings };
    }
    warnings.push(`Sem dados de perda de carga lado ar para ${geometryId}.`);
    return { pressureDropPa: NaN, warnings };
  }
  if (!Array.isArray(item.coefficients) || item.coefficients.length === 0) {
    warnings.push(`Coeficientes de perda de carga ausentes para ${geometryId}.`);
    return { pressureDropPa: NaN, warnings };
  }

  let v = airVelocityMs;
  if (Number.isFinite(item.vMin) && item.vMin !== undefined && v < item.vMin) {
    warnings.push(`Velocidade abaixo da faixa de perda de carga; usando vMin.`);
    v = item.vMin;
  }
  if (Number.isFinite(item.vMax) && item.vMax !== undefined && v > item.vMax) {
    warnings.push(`Velocidade acima da faixa de perda de carga; usando vMax.`);
    v = item.vMax;
  }

  let dp = 0;
  let powerOfV = 1;
  for (let i = 0; i < item.coefficients.length; i++) {
    const a = item.coefficients[i];
    if (a !== 0 && Number.isFinite(a)) dp += a * powerOfV;
    powerOfV *= v;
  }

  if (!Number.isFinite(dp) || dp < 0) {
    warnings.push(`Perda de carga lado ar inválida (${dp}).`);
    return { pressureDropPa: NaN, warnings };
  }
  return { pressureDropPa: dp, warnings };
}

export interface FluidPressureDropParams {
  estimatedMassFlowKgS: number;
  circuits: number;
  tubeInnerDiameterMm: number;
  tubeLengthM: number;
  fluidDensityKgM3?: number;
  fluidViscosityPaS?: number;
  frictionFactor?: number;
}

export interface FluidPressureDropResult {
  pressureDropKpa: number;
  warnings: string[];
}

/**
 * Estimativa de perda de carga monofásica pelo modelo de Darcy-Weisbach:
 *   ΔP = f · (L/D) · (ρ·v²)/2
 * Para escoamento bifásico (evaporação/condensação) o usuário deve fornecer
 * o fator de atrito apropriado; valores padrão são para refrigerante líquido.
 */
export function calculateFluidPressureDrop(
  params: FluidPressureDropParams,
): FluidPressureDropResult {
  const warnings: string[] = [];

  if (!Number.isFinite(params.circuits) || params.circuits <= 0) {
    return {
      pressureDropKpa: NaN,
      warnings: ["Número de circuitos inválido — não é possível estimar ΔP fluido."],
    };
  }
  if (!Number.isFinite(params.tubeInnerDiameterMm) || params.tubeInnerDiameterMm <= 0) {
    return {
      pressureDropKpa: NaN,
      warnings: ["Diâmetro interno do tubo ausente — não é possível estimar ΔP fluido."],
    };
  }
  if (!Number.isFinite(params.tubeLengthM) || params.tubeLengthM <= 0) {
    return {
      pressureDropKpa: NaN,
      warnings: ["Comprimento de tubo inválido — não é possível estimar ΔP fluido."],
    };
  }

  const rho = params.fluidDensityKgM3 ?? 1200; // refrigerante líquido típico
  const f = params.frictionFactor ?? 0.025; // tubo de cobre liso, regime turbulento moderado
  const dM = mmToM(params.tubeInnerDiameterMm);
  const areaM2 = (Math.PI * dM * dM) / 4;
  const massFlowPerCircuit = safeDivide(params.estimatedMassFlowKgS, params.circuits);
  const velocity = safeDivide(massFlowPerCircuit, rho * areaM2);

  const dpPa = f * (params.tubeLengthM / dM) * (rho * velocity * velocity) / 2;
  if (!Number.isFinite(dpPa) || dpPa < 0) {
    return { pressureDropKpa: NaN, warnings: ["ΔP fluido calculado inválido."] };
  }
  if (params.fluidDensityKgM3 === undefined || params.frictionFactor === undefined) {
    warnings.push(
      "ΔP do fluido estimado com densidade/atrito típicos de refrigerante líquido — refine com propriedades reais.",
    );
  }
  return { pressureDropKpa: dpPa / KPA_TO_PA, warnings };
}
