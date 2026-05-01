import type { AgroCycleInput, AgroCycleResult, AgroCycleMode } from "../../domain/types";
import {
  humidityRatio,
  enthalpyMoistAir,
  saturationPressure,
} from "../psychrometrics/psychrometricCore";
import { fromWatts } from "../../utils/unitConverter";

function buildErrorResult(input: AgroCycleInput, warnings: string[]): AgroCycleResult {
  return {
    mode: "invalid",
    T_room_c: input.T_room_c,
    RH_room: input.RH_room,
    W_in: 0,
    h_in_kj_kg: 0,
    T_setpoint_c: input.T_setpoint_c,
    RH_setpoint: input.RH_setpoint,
    W_setpoint: 0,
    h_reheat_out_kj_kg: 0,
    T_evap_out_required_c: 0,
    RH_evap_out: 0,
    h_evap_out_kj_kg: 0,
    Q_evap_w: 0,
    Q_evap_kcalh: 0,
    Q_reheat_w: 0,
    Q_reheat_kcalh: 0,
    Q_total_cycle_w: 0,
    Q_total_cycle_kcalh: 0,
    water_removed_kg_s: 0,
    water_removed_kg_h: 0,
    final_RH_check: 0,
    final_RH_error: 0,
    converged: false,
    iterations: 0,
    warnings,
    status: "error",
  };
}

function dewPointFromHumidityRatio(
  W_target: number,
  P_atm = 101325,
  options?: {
    min_temp_c?: number;
    max_temp_c?: number;
    tolerance_w?: number;
    max_iterations?: number;
  },
): { temperature_c: number; converged: boolean; iterations: number; warnings: string[] } {
  const warnings: string[] = [];
  const minT = options?.min_temp_c ?? -50;
  const maxT = options?.max_temp_c ?? 60;
  const tol = options?.tolerance_w ?? 1e-7;
  const maxIter = options?.max_iterations ?? 100;

  if (W_target <= 0) {
    warnings.push("W_target <= 0. Retornando temperatura mínima.");
    return { temperature_c: minT, converged: false, iterations: 0, warnings };
  }

  const { W: W_min } = humidityRatio(minT, 1.0, P_atm);
  const { W: W_max } = humidityRatio(maxT, 1.0, P_atm);

  if (W_target < W_min) {
    warnings.push("W_target abaixo da faixa de cálculo. Usando temperatura mínima.");
    return { temperature_c: minT, converged: false, iterations: 0, warnings };
  }

  if (W_target > W_max) {
    warnings.push("W_target acima da faixa de cálculo. Usando temperatura máxima.");
    return { temperature_c: maxT, converged: false, iterations: 0, warnings };
  }

  let low = minT;
  let high = maxT;

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2;
    const { W: W_mid } = humidityRatio(mid, 1.0, P_atm);

    if (Math.abs(W_mid - W_target) < tol) {
      return { temperature_c: mid, converged: true, iterations: i + 1, warnings };
    }

    if (W_mid < W_target) {
      low = mid;
    } else {
      high = mid;
    }
  }

  warnings.push("dewPointFromHumidityRatio não convergiu dentro do limite.");
  return { temperature_c: (low + high) / 2, converged: false, iterations: maxIter, warnings };
}

function calculateRHFromHumidityRatio(T_c: number, W: number, P_atm = 101325): number {
  const P_vapor = (W * P_atm) / (0.62198 + W);
  const P_ws = saturationPressure(T_c);
  return Math.max(0, Math.min(1, P_ws > 0 ? P_vapor / P_ws : 0));
}

export function calculateAgroCycle(input: AgroCycleInput): AgroCycleResult {
  const warnings: string[] = [];
  const P_atm = input.P_atm ?? 101325;

  let RH_room = input.RH_room;
  let RH_setpoint = input.RH_setpoint;

  if (RH_room > 1) {
    RH_room = RH_room / 100;
    warnings.push("RH_room fornecido como porcentagem. Convertido para fração decimal.");
  }
  if (RH_setpoint > 1) {
    RH_setpoint = RH_setpoint / 100;
    warnings.push("RH_setpoint fornecido como porcentagem. Convertido para fração decimal.");
  }

  RH_room = Math.max(0, Math.min(1, RH_room));
  RH_setpoint = Math.max(0, Math.min(1, RH_setpoint));

  if (!Number.isFinite(input.T_room_c)) {
    warnings.push("T_room_c inválido.");
    return buildErrorResult(input, warnings);
  }
  if (!Number.isFinite(input.T_setpoint_c)) {
    warnings.push("T_setpoint_c inválido.");
    return buildErrorResult(input, warnings);
  }
  if (input.air_mass_flow_kg_s <= 0) {
    warnings.push("air_mass_flow_kg_s inválido ou zero.");
    return buildErrorResult(input, warnings);
  }

  const { W: W_in } = humidityRatio(input.T_room_c, RH_room, P_atm);
  const h_in = enthalpyMoistAir(input.T_room_c, W_in);

  const { W: W_setpoint } = humidityRatio(input.T_setpoint_c, RH_setpoint, P_atm);
  const h_reheat_out = enthalpyMoistAir(input.T_setpoint_c, W_setpoint);

  const m = input.air_mass_flow_kg_s;

  if (W_in <= W_setpoint) {
    const Q_evap_w = Math.max(0, m * (h_in - h_reheat_out) * 1000);

    if (Q_evap_w === 0) {
      warnings.push(
        "Condição atual já está igual ou abaixo da carga térmica alvo. Sem resfriamento necessário.",
      );
    }

    return {
      mode: "cooling_only",
      T_room_c: input.T_room_c,
      RH_room,
      W_in,
      h_in_kj_kg: h_in,
      T_setpoint_c: input.T_setpoint_c,
      RH_setpoint,
      W_setpoint,
      h_reheat_out_kj_kg: h_reheat_out,
      T_evap_out_required_c: input.T_setpoint_c,
      RH_evap_out: RH_setpoint,
      h_evap_out_kj_kg: h_reheat_out,
      Q_evap_w,
      Q_evap_kcalh: fromWatts(Q_evap_w, "kcal/h"),
      Q_reheat_w: 0,
      Q_reheat_kcalh: 0,
      Q_total_cycle_w: Q_evap_w,
      Q_total_cycle_kcalh: fromWatts(Q_evap_w, "kcal/h"),
      water_removed_kg_s: 0,
      water_removed_kg_h: 0,
      final_RH_check: RH_setpoint,
      final_RH_error: 0,
      converged: true,
      iterations: 0,
      warnings,
      status: "ok",
    };
  }

  const mode: AgroCycleMode = "dehumidification";

  const dpResult = dewPointFromHumidityRatio(W_setpoint, P_atm, {
    tolerance_w: input.tolerance_w ?? 1e-7,
    max_iterations: input.max_iterations ?? 100,
  });
  warnings.push(...dpResult.warnings);

  const T_evap_out = dpResult.temperature_c;
  const h_evap_out = enthalpyMoistAir(T_evap_out, W_setpoint);

  let Q_evap_w = m * (h_in - h_evap_out) * 1000;
  if (Q_evap_w < 0) {
    Q_evap_w = 0;
    warnings.push("Q_evap_w calculado negativo. Ajustado para zero.");
  }

  let Q_reheat_w = m * (h_reheat_out - h_evap_out) * 1000;
  if (Q_reheat_w < 0) {
    Q_reheat_w = 0;
    warnings.push("Q_reheat_w calculado negativo. Ajustado para zero.");
  }

  const water_removed_kg_s = m * (W_in - W_setpoint);
  const Q_total = Q_evap_w + Q_reheat_w;

  const final_RH_check = calculateRHFromHumidityRatio(input.T_setpoint_c, W_setpoint, P_atm);
  const final_RH_error = Math.abs(final_RH_check - RH_setpoint);

  return {
    mode,
    T_room_c: input.T_room_c,
    RH_room,
    W_in,
    h_in_kj_kg: h_in,
    T_setpoint_c: input.T_setpoint_c,
    RH_setpoint,
    W_setpoint,
    h_reheat_out_kj_kg: h_reheat_out,
    T_evap_out_required_c: T_evap_out,
    RH_evap_out: 1.0,
    h_evap_out_kj_kg: h_evap_out,
    Q_evap_w,
    Q_evap_kcalh: fromWatts(Q_evap_w, "kcal/h"),
    Q_reheat_w,
    Q_reheat_kcalh: fromWatts(Q_reheat_w, "kcal/h"),
    Q_total_cycle_w: Q_total,
    Q_total_cycle_kcalh: fromWatts(Q_total, "kcal/h"),
    water_removed_kg_s,
    water_removed_kg_h: water_removed_kg_s * 3600,
    final_RH_check,
    final_RH_error,
    converged: dpResult.converged,
    iterations: dpResult.iterations,
    warnings,
    status: dpResult.converged ? "ok" : "warning",
  };
}
