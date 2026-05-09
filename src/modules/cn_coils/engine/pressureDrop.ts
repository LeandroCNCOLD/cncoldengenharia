// Perda de carga lado ar (catálogo CN Coils) e lado fluido (Darcy-Weisbach
// simplificado, monofásico). Sem fallback silencioso para zero.

import type { PressureDropFanItem } from "../types/cncoils.types";
import { getRefrigerantLiquidProps } from "../engine_v2/refrigerantProps";
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

export interface ComputeFluidPressureDropParams {
  refrigerant: string;
  T_evap_C: number;
  mass_flow_kg_s: number;
  n_circuits: number;
  L_tube_per_circuit_m: number;
  D_i_m: number;
  roughness_m?: number;
}

export function computeFluidPressureDrop(params: ComputeFluidPressureDropParams): {
  dP_kPa: number;
  warnings: string[];
} {
  const {
    refrigerant,
    T_evap_C,
    mass_flow_kg_s,
    n_circuits,
    L_tube_per_circuit_m,
    D_i_m,
    roughness_m = 1.5e-6,
  } = params;
  const warnings: string[] = [];

  if (
    !Number.isFinite(mass_flow_kg_s) ||
    !Number.isFinite(n_circuits) ||
    !Number.isFinite(L_tube_per_circuit_m) ||
    !Number.isFinite(D_i_m) ||
    mass_flow_kg_s <= 0 ||
    n_circuits <= 0 ||
    L_tube_per_circuit_m <= 0 ||
    D_i_m <= 0
  ) {
    return {
      dP_kPa: NaN,
      warnings: ["Parâmetros inválidos — não é possível calcular ΔP fluido."],
    };
  }

  const props = getRefrigerantLiquidProps(refrigerant, T_evap_C);
  warnings.push(...props.warnings);

  const rho_l = props.rho_kg_m3;
  const mu_l = props.mu_Pa_s;
  const massFlowPerCircuit = mass_flow_kg_s / n_circuits;
  const areaM2 = (Math.PI * D_i_m * D_i_m) / 4;
  const G = massFlowPerCircuit / areaM2; // fluxo mássico específico [kg/(m²·s)]

  // --- Helper: fator de atrito de Churchill (1977) ---
  function churchillFriction(Re: number): number {
    if (Re < 1) return 64;
    if (Re < 2300) return 64 / Re;
    const A = Math.pow(
      2.457 * Math.log(1 / (Math.pow(7 / Re, 0.9) + 0.27 * (roughness_m / D_i_m))),
      16,
    );
    const B = Math.pow(37530 / Re, 16);
    return 8 * Math.pow(Math.pow(8 / Re, 12) + Math.pow(A + B, -1.5), 1 / 12);
  }

  // C3: Müller-Steinhagen & Heck (1986) para escoamento bifásico.
  // Substitui Darcy-Weisbach monofásico que subestima ΔP bifásico em 3–10×.
  // Usa rho_v estimada como rho_l / 20 se não disponível (conservador).
  const rho_v = rho_l / 20; // estimativa conservadora; idealmente via tabela
  const mu_v = mu_l * 0.05; // estimativa; vapor é ~20× menos viscoso

  const Re_l = G * D_i_m / mu_l;
  const Re_v = G * D_i_m / mu_v;
  const f_l = churchillFriction(Re_l);
  const f_v = churchillFriction(Re_v);

  const dp_l_Pa_m = f_l * G * G / (2 * rho_l * D_i_m); // [Pa/m] todo líquido
  const dp_v_Pa_m = f_v * G * G / (2 * rho_v * D_i_m); // [Pa/m] todo vapor

  // Título médio: evaporador DX x_in=0.20, x_out=0.90 → x_med=0.55
  const x_med = 0.55;
  // M-S&H: dP/dz = [A_msh × (1-x)^(1/3) + dP_v × x^3]
  const A_msh = dp_l_Pa_m + 2 * (dp_v_Pa_m - dp_l_Pa_m) * x_med;
  const dpPa = (A_msh * Math.pow(1 - x_med, 1 / 3) + dp_v_Pa_m * Math.pow(x_med, 3))
    * L_tube_per_circuit_m;

  if (!Number.isFinite(dpPa) || dpPa < 0) {
    return { dP_kPa: NaN, warnings: ["ΔP fluido bifásico calculado inválido."] };
  }

  const velocity_l = G / rho_l;
  if (Re_l < 2300) {
    warnings.push(`Re_l=${Re_l.toFixed(0)} — regime laminar no tubo (bifásico)`);
  }
  if (velocity_l < 0.1 || velocity_l > 8) {
    warnings.push(
      `Velocidade líquido ${velocity_l.toFixed(2)} m/s fora da faixa típica (0.1–8 m/s)`,
    );
  }
  warnings.push("Müller-Steinhagen & Heck (1986) — ΔP bifásico com x_med=0.55");

  return { dP_kPa: dpPa / KPA_TO_PA, warnings };
}

export function calculateFluidPressureDrop(
  params: FluidPressureDropParams,
): FluidPressureDropResult {
  const result = computeFluidPressureDrop({
    refrigerant: "R404A",
    T_evap_C: -10,
    mass_flow_kg_s: params.estimatedMassFlowKgS,
    n_circuits: params.circuits,
    L_tube_per_circuit_m: params.tubeLengthM,
    D_i_m: mmToM(params.tubeInnerDiameterMm),
  });
  return { pressureDropKpa: result.dP_kPa, warnings: result.warnings };
}
