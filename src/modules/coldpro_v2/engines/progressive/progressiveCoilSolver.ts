import type { ProgressiveCoilInput, ProgressiveCoilResult, RollResult } from "../../domain/types";
import { saturationPressure, humidityRatio, dewPoint } from "../psychrometrics/psychrometricCore";

const MU_AIR = 1.846e-5;
const CP_AIR = 1006;
const PR_AIR = 0.713;
const K_AIR = 0.0243;
const H_I_DEFAULT = 1500;

const TUBE_K: Record<string, number> = { copper: 385, aluminum: 205, steel: 50 };

export function calculateProgressiveCoil(input: ProgressiveCoilInput): ProgressiveCoilResult {
  const warnings: string[] = [];
  const P_atm = input.P_atm ?? 101325;
  const frostDensity = input.frost_density_kg_m3 ?? 300;
  const frostK = input.frost_thermal_conductivity_w_mk ?? 0.4;

  if (!input.rolls || input.rolls.length === 0) {
    warnings.push("rolls vazio.");
    return emptyResult(warnings, "error");
  }
  if (input.air_mass_flow_kg_s <= 0) {
    warnings.push("air_mass_flow_kg_s <= 0.");
    return emptyResult(warnings, "error");
  }
  if (input.air_temperature_in_c < -60 || input.air_temperature_in_c > 60) {
    warnings.push("air_temperature_in_c fora da faixa [-60, 60].");
    return emptyResult(warnings, "error");
  }
  if (input.T_evaporating_c >= input.air_temperature_in_c) {
    warnings.push("T_evaporating_c >= air_temperature_in_c. Sem troca térmica.");
    return emptyResult(warnings, "error");
  }
  if (input.tube_outer_diameter_mm <= input.tube_inner_diameter_mm) {
    warnings.push("tube_outer_diameter_mm <= tube_inner_diameter_mm.");
    return emptyResult(warnings, "error");
  }
  for (let r = 0; r < input.rolls.length; r++) {
    if (input.rolls[r]!.fin_spacing_mm <= 0) {
      warnings.push(`rolls[${r}].fin_spacing_mm <= 0.`);
      return emptyResult(warnings, "error");
    }
  }
  if (
    input.frost_thickness_mm_per_roll &&
    input.frost_thickness_mm_per_roll.length !== input.rolls.length
  ) {
    warnings.push("frost_thickness_mm_per_roll length != rolls length.");
    return emptyResult(warnings, "error");
  }

  const RH_in = Math.max(0, Math.min(1, input.air_relative_humidity_in));
  const D_o = input.tube_outer_diameter_mm / 1000;
  const D_i = input.tube_inner_diameter_mm / 1000;
  const P_t = input.tube_pitch_transverse_mm / 1000;
  const P_l = input.tube_pitch_longitudinal_mm / 1000;
  const t_f = input.fin_thickness_mm / 1000;
  const A_face = input.coil_width_m * input.coil_height_m;
  const N_tubes_per_row = Math.max(1, Math.floor(input.coil_height_m / P_t));
  const k_tube = TUBE_K[input.tube_material] ?? 385;

  const { W: W_inlet } = humidityRatio(input.air_temperature_in_c, RH_in, P_atm);
  const h_air_inlet =
    CP_AIR * input.air_temperature_in_c + W_inlet * (2501000 + 1860 * input.air_temperature_in_c);

  let T_air = input.air_temperature_in_c;
  let RH_air = RH_in;
  let W_air = W_inlet;
  let h_air = h_air_inlet;

  const rollResults: RollResult[] = [];

  for (let i = 0; i < input.rolls.length; i++) {
    const roll = input.rolls[i]!;
    const s_i = roll.fin_spacing_mm / 1000;
    const N_rows_i = roll.rows_in_roll;
    const frostMm = input.frost_thickness_mm_per_roll?.[i] ?? 0;
    const deltaFrost = frostMm / 1000;

    const L_tube_roll = input.coil_width_m * N_tubes_per_row * N_rows_i;
    const A_internal = Math.PI * D_i * L_tube_roll;
    const A_tube = Math.PI * D_o * L_tube_roll;
    const A_fin = 2 * (A_face - ((Math.PI * D_o * D_o) / 4) * N_tubes_per_row) * N_rows_i;
    const A_external = A_tube + Math.max(0, A_fin);

    let sigma = 1 - D_o / P_t - (2 * t_f) / s_i;
    sigma = Math.max(0.05, sigma);
    const A_free = sigma * A_face;

    let A_free_frosted = A_free;
    let frostBlockageClamped = false;
    if (deltaFrost > 0) {
      const reduction = Math.max(0.05, 1 - (2 * deltaFrost) / s_i);
      A_free_frosted = A_free * reduction;
      if (reduction <= 0.05) {
        frostBlockageClamped = true;
        warnings.push(
          `Roll ${i + 1}: área livre reduzida ao mínimo por acúmulo de gelo. Degelo urgente.`,
        );
      }
    }

    const rho_air = 1.2929 * (273.15 / (273.15 + T_air));
    const V_max = A_free_frosted > 0 ? input.air_mass_flow_kg_s / (rho_air * A_free_frosted) : 0;

    const Re_Dc = (rho_air * V_max * D_o) / MU_AIR;
    const j =
      Re_Dc > 0
        ? 0.653 *
          Math.pow(Re_Dc, -0.449) *
          Math.pow(s_i / D_o, -0.535) *
          Math.pow(t_f / D_o, -0.0512)
        : 0;
    let h_o = (j * rho_air * V_max * CP_AIR) / Math.pow(PR_AIR, 2 / 3);
    h_o = Math.max(5, h_o);

    const h_i = H_I_DEFAULT;

    let frostResistance = 0;
    let R_frost = 0;
    if (deltaFrost > 0 && frostK > 0) {
      frostResistance = deltaFrost / frostK;
      R_frost = A_external > 0 ? deltaFrost / (frostK * A_external) : 0;
    }

    const R_wall =
      D_o > D_i && L_tube_roll > 0 ? Math.log(D_o / D_i) / (2 * Math.PI * k_tube * L_tube_roll) : 0;

    const R_ext = A_external > 0 ? 1 / (h_o * A_external) : 1e10;
    const R_int = A_internal > 0 ? 1 / (h_i * A_internal) : 1e10;
    const R_total = R_ext + R_frost + R_wall + R_int;

    const UA = R_total > 0 ? 1 / R_total : 0;
    const U = A_external > 0 ? UA / A_external : 0;

    const cp_moist = CP_AIR + 1860 * W_air;
    const C_air = input.air_mass_flow_kg_s * cp_moist;
    const NTU = C_air > 0 ? UA / C_air : 0;
    const eff = 1 - Math.exp(-NTU);

    let Q = eff * C_air * (T_air - input.T_evaporating_c);
    Q = Math.max(0, Q);

    let T_out = C_air > 0 ? T_air - Q / C_air : T_air;
    T_out = Math.max(input.T_evaporating_c + 0.1, T_out);

    const { T_dp } = dewPoint(T_air, RH_air);
    let W_out: number;
    let condensRate = 0;
    let RH_out: number;

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
      const h_in_roll = CP_AIR * T_air + W_air * (2501000 + 1860 * T_air);
      Q = input.air_mass_flow_kg_s * (h_in_roll - h_out);
      Q = Math.max(0, Q);
    }

    const G_max = rho_air * V_max;
    const Re_f = (G_max * D_o) / MU_AIR;
    const f = Re_f > 0 ? 0.508 * Math.pow(Re_f, -0.521) * Math.pow(s_i / D_o, -0.0935) : 0;
    let dP = (f * N_rows_i * G_max * G_max) / (2 * rho_air);
    if (deltaFrost > 0 && A_free_frosted < A_free) {
      const blockage = (A_free / A_free_frosted) ** 2;
      dP *= blockage;
    }
    dP = Math.max(0, dP);

    rollResults.push({
      roll_index: i,
      fin_spacing_mm: roll.fin_spacing_mm,
      rows_in_roll: N_rows_i,
      free_flow_area_m2: A_free_frosted,
      total_external_area_m2: A_external,
      frost_thickness_mm: frostMm,
      frost_resistance_m2k_w: frostResistance,
      V_max_m_s: V_max,
      Re: Re_Dc,
      air_pressure_drop_pa: dP,
      h_o_w_m2k: h_o,
      h_i_w_m2k: h_i,
      U_w_m2k: U,
      NTU,
      effectiveness: eff,
      capacity_w: Q,
      condensation_rate_kg_s: condensRate,
      air_temperature_out_c: T_out,
      air_relative_humidity_out: RH_out,
      W_out_kg_kg: W_out,
      enthalpy_out_j_kg: h_out,
    });

    T_air = T_out;
    RH_air = RH_out;
    W_air = W_out;
    h_air = h_out;
  }

  const totalCap = rollResults.reduce((s, r) => s + r.capacity_w, 0);
  const totalDP = rollResults.reduce((s, r) => s + r.air_pressure_drop_pa, 0);
  const totalCond = rollResults.reduce((s, r) => s + r.condensation_rate_kg_s, 0);
  const last = rollResults[rollResults.length - 1]!;

  const Q_enthalpy = input.air_mass_flow_kg_s * (h_air_inlet - last.enthalpy_out_j_kg);
  const energyError = totalCap > 0 ? (Math.abs(Q_enthalpy - totalCap) / totalCap) * 100 : 0;

  if (energyError > 5) {
    warnings.push(
      `Balanço de energia com erro de ${energyError.toFixed(1)}%. Verificar condições de entrada.`,
    );
  }
  if (totalDP > 80) {
    warnings.push("Perda de carga total acima de 80 Pa. Verificar capacidade do ventilador.");
  }

  let estimatedDefrost: number | null = null;
  const hasFrost = input.frost_thickness_mm_per_roll?.some((f) => f > 0);
  if (hasFrost) {
    estimatedDefrost = null;
  } else if (totalCond > 0) {
    estimatedDefrost = 0.5 / (totalCond * 3600);
  }

  let status: ProgressiveCoilResult["status"] = "ok";
  if (totalCap <= 0) status = "error";
  else if (warnings.length > 0) status = "warning";

  return {
    status,
    warnings,
    rolls: rollResults,
    total_capacity_w: totalCap,
    total_air_pressure_drop_pa: totalDP,
    total_condensation_rate_kg_s: totalCond,
    air_temperature_out_c: last.air_temperature_out_c,
    air_relative_humidity_out: last.air_relative_humidity_out,
    W_out_kg_kg: last.W_out_kg_kg,
    enthalpy_out_j_kg: last.enthalpy_out_j_kg,
    estimated_time_to_defrost_h: estimatedDefrost,
    energy_balance_error_pct: energyError,
  };
}

function emptyResult(
  warnings: string[],
  status: "ok" | "warning" | "error",
): ProgressiveCoilResult {
  return {
    status,
    warnings,
    rolls: [],
    total_capacity_w: 0,
    total_air_pressure_drop_pa: 0,
    total_condensation_rate_kg_s: 0,
    air_temperature_out_c: 0,
    air_relative_humidity_out: 0,
    W_out_kg_kg: 0,
    enthalpy_out_j_kg: 0,
    estimated_time_to_defrost_h: null,
    energy_balance_error_pct: 0,
  };
}
