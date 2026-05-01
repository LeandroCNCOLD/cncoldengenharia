import type { CoilIterativeInput, CoilIterativeResult, IterationRecord } from "../../domain/types";
import { calculateAirProperties } from "../airSide/airProperties";
import { calculateMassFlowAirKgS } from "../core/heatBalance";
import { calculateLMTD, calculateHeatTransferByLMTD } from "../core/lmtd";
import {
  calculateReynolds,
  calculateNusseltGnielinski,
  calculateConvectiveCoefficient,
} from "../core/dimensionless";
import { calculateDarcyFrictionFactor } from "../core/friction";
import { calculateDarcyWeisbachPressureDrop } from "../core/pressureDrop";
import { calculateOverallU } from "../core/overallHeatTransfer";
import { calculateFinEfficiencySimplified } from "../core/finEfficiency";

const KCALH_PER_KW = 859.845;
const KCALH_PER_TR = 3024;
const KCALH_PER_BTUH = 0.252;
const DEFAULT_FLUID_H = 1000;
const SMALL = 1e-6;

export function solveCoilIterative(input: CoilIterativeInput): CoilIterativeResult {
  const warnings: string[] = [];

  // ── Validate required inputs ─────────────────────────────────
  if (!input.rows) warnings.push("rows ausente");
  if (!input.tubes_per_row) warnings.push("tubes_per_row ausente");
  if (!input.circuits) warnings.push("circuits ausente");
  if (!input.length_mm) warnings.push("length_mm ausente");
  if (!input.airflow_m3h) warnings.push("airflow_m3h ausente");

  const airflow = input.airflow_m3h ?? 0;
  const rows = input.rows ?? 0;
  const tubesPerRow = input.tubes_per_row ?? 0;
  const lengthMm = input.length_mm ?? 0;
  const tubeDiamMm = input.tube_diameter_mm ?? 9.52;
  const tubeThickMm = input.tube_thickness_mm ?? 0.35;
  const roughness = input.tube_roughness_m ?? 0.0000015;

  const T_air_in = input.air_inlet_temperature_c;
  const T_f_in = input.fluid_inlet_temperature_c;
  const m_f = input.fluid_mass_flow_kgs;
  const cp_f = input.fluid_cp_j_kg_k;
  const isEvaporator = input.mode === "evaporator";

  if (m_f <= 0) warnings.push("m_f ausente ou zero");
  if (cp_f <= 0) warnings.push("cp_f ausente ou zero");
  if (airflow <= 0) warnings.push("airflow_m3h ausente ou zero");

  const maxIter = input.max_iterations ?? 100;
  const tolerance = input.tolerance_w ?? 1;
  const correctionFactor = input.correction_factor ?? 1;
  const relaxation = input.relaxation_factor ?? 0.1;

  // ── Geometry ─────────────────────────────────────────────────
  const lengthM = lengthMm / 1000;
  const tubeDiamM = tubeDiamMm / 1000;
  const tubeThickM = tubeThickMm / 1000;
  const exchange_area_m2 = rows * tubesPerRow * lengthM * Math.PI * tubeDiamM;

  if (exchange_area_m2 <= 0) {
    warnings.push("área de troca zero ou ausente");
  }

  const faceArea = Math.max(tubesPerRow * lengthM * 0.025, 0.01);
  const h_fluid = input.fluid_h_w_m2k ?? DEFAULT_FLUID_H;
  const finCond = input.fin_conductivity_w_mk ?? 200;
  const finThick = input.fin_thickness_m ?? 0.0001;
  const wallConductivity = 385;
  const wallResistance =
    input.wall_resistance_m2k_w ?? (tubeThickM > 0 ? tubeThickM / wallConductivity : 0);
  const foulingAir = input.fouling_air_m2k_w ?? 0;
  const foulingFluid = input.fouling_fluid_m2k_w ?? 0;

  // ── 1. Initial air properties ────────────────────────────────
  let airProps = calculateAirProperties(T_air_in);
  let m_air = calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

  // ── 2. Initial guess for T_f_out ─────────────────────────────
  let T_f_out: number;
  if (input.fluid_outlet_temperature_guess_c !== null) {
    T_f_out = input.fluid_outlet_temperature_guess_c;
  } else {
    T_f_out = isEvaporator ? T_f_in + 5 : T_f_in - 5;
  }

  // ── Iteration state ──────────────────────────────────────────
  const iteration_history: IterationRecord[] = [];
  let converged = false;
  let lastError = 0;
  let lastQ = 0;
  let T_air_out = T_air_in;
  let lastU = 0;
  let lastLMTD: number | null = null;
  let lastReAir = 0;
  let lastPrAir = 0;
  let lastNuAir = 0;
  let lastHAir = 0;
  let lastAirPressureDrop = 0;
  let lastFinEff = 0.85;

  // ── Pre-check: can we even iterate? ──────────────────────────
  if (m_f <= 0 || cp_f <= 0 || airflow <= 0 || exchange_area_m2 <= 0) {
    return buildErrorResult(warnings, iteration_history);
  }

  // ── 3. Iteration loop ────────────────────────────────────────
  for (let i = 0; i < maxIter; i++) {
    // a) Q by fluid energy balance
    const Q_f = m_f * cp_f * Math.abs(T_f_out - T_f_in);

    // b) T_air_out by air energy balance
    const C_air = m_air * airProps.cp_j_kg_k;
    if (C_air <= SMALL) {
      warnings.push("Capacidade térmica do ar zero");
      break;
    }

    if (isEvaporator) {
      T_air_out = T_air_in - Q_f / C_air;
    } else {
      T_air_out = T_air_in + Q_f / C_air;
    }

    // c) Recalculate air properties at mean temperature
    const T_air_mean = (T_air_in + T_air_out) / 2;
    airProps = calculateAirProperties(T_air_mean);
    m_air = calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

    // d) LMTD
    let hotIn: number, hotOut: number, coldIn: number, coldOut: number;
    if (isEvaporator) {
      hotIn = T_air_in;
      hotOut = T_air_out;
      coldIn = T_f_in;
      coldOut = T_f_out;
    } else {
      hotIn = T_f_in;
      hotOut = T_f_out;
      coldIn = T_air_in;
      coldOut = T_air_out;
    }

    const lmtdResult = calculateLMTD({
      hotIn_c: hotIn,
      hotOut_c: hotOut,
      coldIn_c: coldIn,
      coldOut_c: coldOut,
    });
    if (i === 0) {
      warnings.push(...lmtdResult.warnings);
    }
    lastLMTD = lmtdResult.lmtd_k;

    // e) Recalculate Re, Pr, Nu, h_air
    const faceVelocity = airflow > 0 ? airflow / 3600 / faceArea : 0;

    lastReAir = calculateReynolds({
      density_kg_m3: airProps.density_kg_m3,
      velocity_m_s: faceVelocity,
      hydraulicDiameter_m: tubeDiamM,
      viscosity_pa_s: airProps.viscosity_pa_s,
    });

    lastPrAir = airProps.prandtl;

    const f_air = calculateDarcyFrictionFactor({
      reynolds: lastReAir,
      roughness_m: roughness,
      hydraulicDiameter_m: tubeDiamM,
    });

    const nuResult = calculateNusseltGnielinski({
      reynolds: lastReAir,
      prandtl: lastPrAir,
      frictionFactor: f_air,
    });
    if (i === 0) {
      warnings.push(...nuResult.warnings);
    }
    lastNuAir = nuResult.nusselt;

    lastHAir = calculateConvectiveCoefficient({
      nusselt: lastNuAir,
      conductivity_w_m_k: airProps.conductivity_w_m_k,
      hydraulicDiameter_m: tubeDiamM,
    });

    // g) Fin efficiency
    const finResult = calculateFinEfficiencySimplified({
      h_air_w_m2k: lastHAir,
      finConductivity_w_mk: finCond,
      finThickness_m: finThick,
    });
    if (i === 0) {
      warnings.push(...finResult.warnings);
    }
    lastFinEff = finResult.finEfficiency;

    // h) U
    lastU = calculateOverallU({
      airSideH_w_m2k: lastHAir,
      fluidSideH_w_m2k: h_fluid,
      wallResistance_m2k_w: wallResistance,
      foulingAir_m2k_w: foulingAir,
      foulingFluid_m2k_w: foulingFluid,
      finEfficiency: lastFinEff,
    });

    // i) Q_calc = U * A * LMTD * F
    let Q_calc = 0;
    if (lastLMTD !== null && lastLMTD > 0) {
      Q_calc = calculateHeatTransferByLMTD({
        u_w_m2k: lastU,
        area_m2: exchange_area_m2,
        lmtd_k: lastLMTD,
        correctionFactor,
      });
    }

    // j) Error
    const error = Q_calc - Q_f;
    lastError = error;
    lastQ = Q_calc;

    // Air pressure drop (update each iteration since air props change)
    const airRowDepth = rows * tubeDiamM * 2;
    lastAirPressureDrop = calculateDarcyWeisbachPressureDrop({
      frictionFactor: f_air,
      length_m: airRowDepth,
      hydraulicDiameter_m: tubeDiamM,
      density_kg_m3: airProps.density_kg_m3,
      velocity_m_s: faceVelocity,
    });

    // Record iteration
    iteration_history.push({
      iteration: i + 1,
      fluid_outlet_temperature_c: T_f_out,
      air_outlet_temperature_c: T_air_out,
      air_mean_temperature_c: T_air_mean,
      q_fluid_w: Q_f,
      q_calc_w: Q_calc,
      error_w: error,
      u_w_m2k: lastU,
      lmtd_k: lastLMTD,
      reynolds_air: lastReAir,
      nusselt_air: lastNuAir,
    });

    // k) Convergence check
    if (Math.abs(error) < tolerance) {
      converged = true;
      break;
    }

    // l) Adjust T_f_out
    const C_f = Math.max(m_f * cp_f, SMALL);
    T_f_out = T_f_out + (relaxation * error) / C_f;

    // ── 5. Physical clamp ──────────────────────────────────────
    if (isEvaporator && T_f_out < T_f_in) {
      T_f_out = T_f_in;
      warnings.push(
        "Clamp físico ativado: T_f_out forçado para T_f_in. LMTD pode ser zero ou inválido.",
      );

      const clampLmtd = calculateLMTD({
        hotIn_c: T_air_in,
        hotOut_c: T_air_out,
        coldIn_c: T_f_in,
        coldOut_c: T_f_out,
      });

      if (clampLmtd.lmtd_k === null || clampLmtd.lmtd_k < 0.01) {
        warnings.push("LMTD < 0.01 K após clamp. Interrompendo iteração.");
        converged = false;
        break;
      }
    }

    if (!isEvaporator && T_f_out > T_f_in) {
      T_f_out = T_f_in;
      warnings.push(
        "Clamp físico ativado: T_f_out forçado para T_f_in. LMTD pode ser zero ou inválido.",
      );

      const clampLmtd = calculateLMTD({
        hotIn_c: T_f_in,
        hotOut_c: T_f_out,
        coldIn_c: T_air_in,
        coldOut_c: T_air_out,
      });

      if (clampLmtd.lmtd_k === null || clampLmtd.lmtd_k < 0.01) {
        warnings.push("LMTD < 0.01 K após clamp. Interrompendo iteração.");
        converged = false;
        break;
      }
    }
  }

  // ── Degenerate solution check ────────────────────────────────
  if (converged && lastQ < 1) {
    converged = false;
    warnings.push("Capacidade calculada abaixo de 1 W. Resultado fisicamente inválido.");
  }

  // ── Build result ─────────────────────────────────────────────
  const capacity_w = lastQ;
  const capacity_kw = capacity_w / 1000;
  const capacity_kcalh = capacity_kw * KCALH_PER_KW;
  const capacity_btuh = capacity_kcalh / KCALH_PER_BTUH;
  const capacity_tr = capacity_kcalh / KCALH_PER_TR;

  let status: CoilIterativeResult["status"] = "ok";
  if (!converged) status = "error";
  else if (warnings.length > 0) status = "warning";

  return {
    converged,
    iterations: iteration_history.length,
    capacity_w,
    capacity_kw,
    capacity_kcalh,
    capacity_btuh,
    capacity_tr,
    air_outlet_temperature_c: T_air_out,
    fluid_outlet_temperature_c: T_f_out,
    lmtd_k: lastLMTD,
    u_w_m2k: lastU,
    air_h_w_m2k: lastHAir,
    fluid_h_w_m2k: h_fluid,
    reynolds_air: lastReAir,
    prandtl_air: lastPrAir,
    nusselt_air: lastNuAir,
    air_pressure_drop_pa: lastAirPressureDrop,
    error_w: lastError,
    iteration_history,
    warnings,
    status,
  };
}

function buildErrorResult(
  warnings: string[],
  iteration_history: IterationRecord[],
): CoilIterativeResult {
  warnings.push("Dados insuficientes para iteração");
  return {
    converged: false,
    iterations: 0,
    capacity_w: 0,
    capacity_kw: 0,
    capacity_kcalh: 0,
    capacity_btuh: 0,
    capacity_tr: 0,
    air_outlet_temperature_c: 0,
    fluid_outlet_temperature_c: 0,
    lmtd_k: null,
    u_w_m2k: 0,
    air_h_w_m2k: 0,
    fluid_h_w_m2k: 0,
    reynolds_air: 0,
    prandtl_air: 0,
    nusselt_air: 0,
    air_pressure_drop_pa: 0,
    error_w: 0,
    iteration_history,
    warnings,
    status: "error",
  };
}
