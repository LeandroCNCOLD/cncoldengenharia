import type { ProgressiveCoilInput, ProgressiveCoilResult, RollResult } from "../../domain/types";
import { saturationPressure, humidityRatio, dewPoint } from "../psychrometrics/psychrometricCore";
import { calculateIceAccumulation } from "../defrost/iceModel";

const MU_AIR = 1.846e-5;
const CP_AIR = 1006;
const PR_AIR = 0.713;
const K_AIR  = 0.0243;
const H_I_DEFAULT = 1500;
const TUBE_K: Record<string, number> = { copper: 385, aluminum: 205, steel: 50 };

// Wang et al. (2000) — Plain Fins
function jWangPlain(Re: number, Fp: number, Dc: number, Pl: number, Pt: number, N: number): number {
  if (Re <= 0) return 0;
  return Math.max(0,
    0.394 * Math.pow(Re, -0.392) * Math.pow(Fp/Dc, 0.798) *
    Math.pow(Fp/Pl, -0.198) * Math.pow(Fp/Pt, -0.290) * Math.pow(Math.max(N,1), -0.0978));
}

// Wang et al. (1999a) — Wavy Fins
function jWangWavy(Re: number, Fp: number, Dc: number, Pl: number, Pt: number, N: number): number {
  const jp = jWangPlain(Re, Fp, Dc, Pl, Pt, N);
  return jp * (1 + 0.35 * Math.pow(0.30 * Fp / Dc, 0.257));
}

// Chang & Wang (1997) — Louver/Slit Fins
function jChangWang(Re_Lp: number, Fp: number, Lp: number, theta: number, Hf: number, Df: number, Tp: number): number {
  if (Re_Lp <= 0) return 0;
  const th = Math.max(10, Math.min(40, theta));
  return Math.max(0,
    0.49 * Math.pow(th/90, 0.27) * Math.pow(Fp/Lp, -0.14) * Math.pow(Hf/Lp, -0.29) *
    Math.pow(Df/Lp, -0.23) * Math.pow(Df/Lp, 0.66) * Math.pow(Tp/Lp, -0.58) * Math.pow(Re_Lp, -0.49));
}

export function calculateProgressiveCoil(input: ProgressiveCoilInput): ProgressiveCoilResult {
  const warnings: string[] = [];
  const P_atm = input.P_atm ?? 101325;
  const frostK = input.frost_thermal_conductivity_w_mk ?? 0.4;
  const finType = input.fin_type ?? "plain";
  const useIceModel = input.use_ice_model ?? false;
  const opTimeH = input.operation_time_h ?? 0;

  if (!input.rolls || input.rolls.length === 0) { warnings.push("rolls vazio."); return emptyResult(warnings, "error"); }
  if (input.air_mass_flow_kg_s <= 0) { warnings.push("air_mass_flow_kg_s <= 0."); return emptyResult(warnings, "error"); }
  if (input.air_temperature_in_c < -60 || input.air_temperature_in_c > 60) { warnings.push("air_temperature_in_c fora da faixa [-60, 60]."); return emptyResult(warnings, "error"); }
  if (input.T_evaporating_c >= input.air_temperature_in_c) { warnings.push("T_evaporating_c >= air_temperature_in_c. Sem troca termica."); return emptyResult(warnings, "error"); }
  if (input.tube_outer_diameter_mm <= input.tube_inner_diameter_mm) { warnings.push("tube_outer_diameter_mm <= tube_inner_diameter_mm."); return emptyResult(warnings, "error"); }
  for (let r = 0; r < input.rolls.length; r++) {
    if (input.rolls[r]!.fin_spacing_mm <= 0) { warnings.push(`rolls[${r}].fin_spacing_mm <= 0.`); return emptyResult(warnings, "error"); }
  }
  if (input.frost_thickness_mm_per_roll && input.frost_thickness_mm_per_roll.length !== input.rolls.length) {
    warnings.push("frost_thickness_mm_per_roll length != rolls length."); return emptyResult(warnings, "error");
  }

  const RH_in = Math.max(0, Math.min(1, input.air_relative_humidity_in));
  const D_o = input.tube_outer_diameter_mm / 1000;
  const D_i = input.tube_inner_diameter_mm / 1000;
  const P_t = input.tube_pitch_transverse_mm / 1000;
  const P_l = input.tube_pitch_longitudinal_mm / 1000;
  const t_f = input.fin_thickness_mm / 1000;
  const Fp = (input.fin_pitch_mm ?? input.rolls[0]!.fin_spacing_mm) / 1000;
  const A_face = input.coil_width_m * input.coil_height_m;
  const N_tubes_per_row = Math.max(1, Math.floor(input.coil_height_m / P_t));
  const k_tube = TUBE_K[input.tube_material] ?? 385;

  const { W: W_inlet } = humidityRatio(input.air_temperature_in_c, RH_in, P_atm);
  const h_air_inlet = CP_AIR * input.air_temperature_in_c + W_inlet * (2501000 + 1860 * input.air_temperature_in_c);

  let T_air = input.air_temperature_in_c;
  let RH_air = RH_in;
  let W_air = W_inlet;
  let h_air = h_air_inlet;
  const rollResults: RollResult[] = [];

  for (let i = 0; i < input.rolls.length; i++) {
    const roll = input.rolls[i]!;
    const s_i_clean = roll.fin_spacing_mm / 1000;
    const N_rows_i = roll.rows_in_roll;

    let deltaFrost = (input.frost_thickness_mm_per_roll?.[i] ?? 0) / 1000;
    let R_ice_dynamic = 0;
    let ice_thickness_dynamic_mm = 0;
    let time_to_defrost_h: number | null = null;

    if (useIceModel && opTimeH > 0) {
      const L_est = input.coil_width_m * N_tubes_per_row * N_rows_i;
      const A_ext_est = Math.PI * D_o * L_est + 2 * (A_face - (Math.PI * D_o * D_o / 4) * N_tubes_per_row) * N_rows_i;
      const iceResult = calculateIceAccumulation({
        T_sat_c: input.T_evaporating_c, T_air_in_c: T_air, RH_air_in: RH_air,
        W_air_in_kg_kg: W_air, V_max_m_s: Math.max(0.5, input.air_mass_flow_kg_s / (1.2 * A_face * 0.5)),
        fin_spacing_clean_m: s_i_clean, ice_thickness_initial_m: deltaFrost,
        operation_time_h: opTimeH, external_area_m2: Math.max(0.01, A_ext_est),
        air_mass_flow_kg_s: input.air_mass_flow_kg_s, P_atm,
      });
      deltaFrost = iceResult.ice_thickness_m;
      R_ice_dynamic = iceResult.R_ice_m2k_w;
      ice_thickness_dynamic_mm = iceResult.ice_thickness_mm;
      time_to_defrost_h = iceResult.time_to_defrost_h;
      warnings.push(...iceResult.warnings.map((w) => `Fila ${i + 1}: ${w}`));
    }

    let sigma = Math.max(0.05, 1 - D_o / P_t - (2 * t_f) / s_i_clean);
    const A_free = sigma * A_face;
    let A_free_frosted = A_free;
    if (deltaFrost > 0) {
      const reduction = Math.max(0.05, 1 - (2 * deltaFrost) / s_i_clean);
      A_free_frosted = A_free * reduction;
      if (reduction <= 0.05) warnings.push(`Roll ${i + 1}: area livre reduzida ao minimo. Degelo urgente.`);
    }

    const rho_air = 1.2929 * (273.15 / (273.15 + T_air));
    const V_max = A_free_frosted > 0 ? input.air_mass_flow_kg_s / (rho_air * A_free_frosted) : 0;
    const Re_Dc = (rho_air * V_max * D_o) / MU_AIR;

    let j: number;
    let correlation_used: string;
    if (finType === "plain") {
      j = jWangPlain(Re_Dc, Fp, D_o, P_l, P_t, N_rows_i);
      correlation_used = "Wang et al. (2000) - Plain";
    } else if (finType === "wavy") {
      j = jWangWavy(Re_Dc, Fp, D_o, P_l, P_t, N_rows_i);
      correlation_used = "Wang et al. (1999a) - Wavy";
    } else if (finType === "louver" || finType === "slit") {
      const Lp = Fp * 0.8;
      const Re_Lp = (rho_air * V_max * Lp) / MU_AIR;
      j = jChangWang(Re_Lp, Fp, Lp, 27, P_t - D_o, P_l * N_rows_i, P_t);
      correlation_used = finType === "louver" ? "Chang & Wang (1997) - Louver" : "Chang & Wang (1997) - Slit";
    } else {
      j = Re_Dc > 0 ? 0.653 * Math.pow(Re_Dc, -0.449) * Math.pow(s_i_clean/D_o, -0.535) * Math.pow(t_f/D_o, -0.0512) : 0;
      correlation_used = "Generic (fallback)";
    }

    let h_o = Math.max(5, j > 0 ? (j * rho_air * V_max * CP_AIR) / Math.pow(PR_AIR, 2/3) : 5);
    const h_i = H_I_DEFAULT;

    const L_tube_roll = input.coil_width_m * N_tubes_per_row * N_rows_i;
    const A_internal = Math.PI * D_i * L_tube_roll;
    const A_tube = Math.PI * D_o * L_tube_roll;
    const A_fin = 2 * (A_face - ((Math.PI * D_o * D_o) / 4) * N_tubes_per_row) * N_rows_i;
    const A_external = A_tube + Math.max(0, A_fin);

    let frostResistance = useIceModel ? R_ice_dynamic : 0;
    if (!useIceModel && deltaFrost > 0 && frostK > 0) frostResistance = deltaFrost / frostK;

    const R_wall = D_o > D_i && L_tube_roll > 0 ? Math.log(D_o/D_i) / (2 * Math.PI * k_tube * L_tube_roll) : 0;
    const R_ext = A_external > 0 ? 1 / (h_o * A_external) : 1e10;
    const R_int = A_internal > 0 ? 1 / (h_i * A_internal) : 1e10;
    const UA = (R_ext + frostResistance + R_wall + R_int) > 0 ? 1 / (R_ext + frostResistance + R_wall + R_int) : 0;
    const U = A_external > 0 ? UA / A_external : 0;

    const cp_moist = CP_AIR + 1860 * W_air;
    const C_air = input.air_mass_flow_kg_s * cp_moist;
    const NTU = C_air > 0 ? UA / C_air : 0;
    const eff = 1 - Math.exp(-NTU);
    let Q = Math.max(0, eff * C_air * (T_air - input.T_evaporating_c));
    let T_out = Math.max(input.T_evaporating_c + 0.1, C_air > 0 ? T_air - Q / C_air : T_air);

    const { T_dp } = dewPoint(T_air, RH_air);
    let W_out: number; let condensRate = 0; let RH_out: number;
    if (input.T_evaporating_c < T_dp) {
      const { W: W_sat } = humidityRatio(T_out, 1.0, P_atm);
      W_out = Math.min(W_air, W_sat);
      condensRate = input.air_mass_flow_kg_s * Math.max(0, W_air - W_out);
      RH_out = 1.0;
    } else {
      W_out = W_air;
      const P_vap = (W_out * P_atm) / (0.62198 + W_out);
      const P_ws = saturationPressure(T_out);
      RH_out = Math.max(0, Math.min(1, P_ws > 0 ? P_vap / P_ws : 0));
    }
    const h_out = CP_AIR * T_out + W_out * (2501000 + 1860 * T_out);
    if (condensRate > 0) {
      Q = Math.max(0, input.air_mass_flow_kg_s * (CP_AIR * T_air + W_air * (2501000 + 1860 * T_air) - h_out));
    }

    const G_max = rho_air * V_max;
    const Re_f = (G_max * D_o) / MU_AIR;
    const f = Re_f > 0 ? 0.508 * Math.pow(Re_f, -0.521) * Math.pow(s_i_clean/D_o, -0.0935) : 0;
    let dP = Math.max(0, (f * N_rows_i * G_max * G_max) / (2 * rho_air));
    if (deltaFrost > 0 && A_free_frosted < A_free) dP *= (A_free / A_free_frosted) ** 2;

    rollResults.push({
      roll_index: i, fin_spacing_mm: roll.fin_spacing_mm, rows_in_roll: N_rows_i,
      free_flow_area_m2: A_free_frosted, total_external_area_m2: A_external,
      frost_thickness_mm: deltaFrost * 1000, frost_resistance_m2k_w: frostResistance,
      V_max_m_s: V_max, Re: Re_Dc, air_pressure_drop_pa: dP,
      h_o_w_m2k: h_o, h_i_w_m2k: h_i, U_w_m2k: U, NTU, effectiveness: eff,
      capacity_w: Q, condensation_rate_kg_s: condensRate,
      air_temperature_out_c: T_out, air_relative_humidity_out: RH_out,
      W_out_kg_kg: W_out, enthalpy_out_j_kg: h_out,
      correlation_used,
      ice_thickness_dynamic_mm: useIceModel ? ice_thickness_dynamic_mm : undefined,
      R_ice_dynamic_m2k_w: useIceModel ? R_ice_dynamic : undefined,
      time_to_defrost_h: useIceModel ? time_to_defrost_h : undefined,
    });

    T_air = T_out; RH_air = RH_out; W_air = W_out; h_air = h_out;
  }

  const totalCap = rollResults.reduce((s, r) => s + r.capacity_w, 0);
  const totalDP = rollResults.reduce((s, r) => s + r.air_pressure_drop_pa, 0);
  const totalCond = rollResults.reduce((s, r) => s + r.condensation_rate_kg_s, 0);
  const last = rollResults[rollResults.length - 1]!;
  const Q_enthalpy = input.air_mass_flow_kg_s * (h_air_inlet - last.enthalpy_out_j_kg);
  const energyError = totalCap > 0 ? (Math.abs(Q_enthalpy - totalCap) / totalCap) * 100 : 0;

  if (energyError > 5) warnings.push(`Balanco de energia com erro de ${energyError.toFixed(1)}%. Verificar condicoes de entrada.`);
  if (totalDP > 80) warnings.push("Perda de carga total acima de 80 Pa. Verificar capacidade do ventilador.");

  let estimatedDefrost: number | null = null;
  if (useIceModel) {
    const times = rollResults.map((r) => r.time_to_defrost_h).filter((t): t is number => t !== null && t >= 0);
    estimatedDefrost = times.length > 0 ? Math.min(...times) : null;
  } else {
    const hasFrost = input.frost_thickness_mm_per_roll?.some((f) => f > 0);
    if (!hasFrost && totalCond > 0) estimatedDefrost = 0.5 / (totalCond * 3600);
  }

  let status: ProgressiveCoilResult["status"] = "ok";
  if (totalCap <= 0) status = "error";
  else if (warnings.length > 0) status = "warning";

  return {
    status, warnings, rolls: rollResults,
    total_capacity_w: totalCap, total_air_pressure_drop_pa: totalDP,
    total_condensation_rate_kg_s: totalCond,
    air_temperature_out_c: last.air_temperature_out_c,
    air_relative_humidity_out: last.air_relative_humidity_out,
    W_out_kg_kg: last.W_out_kg_kg, enthalpy_out_j_kg: last.enthalpy_out_j_kg,
    estimated_time_to_defrost_h: estimatedDefrost, energy_balance_error_pct: energyError,
  };
}

function emptyResult(warnings: string[], status: "ok" | "warning" | "error"): ProgressiveCoilResult {
  return {
    status, warnings, rolls: [],
    total_capacity_w: 0, total_air_pressure_drop_pa: 0, total_condensation_rate_kg_s: 0,
    air_temperature_out_c: 0, air_relative_humidity_out: 0, W_out_kg_kg: 0,
    enthalpy_out_j_kg: 0, estimated_time_to_defrost_h: null, energy_balance_error_pct: 0,
  };
}
