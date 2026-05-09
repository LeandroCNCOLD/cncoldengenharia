import type {
  CoilAdvancedInput,
  CoupledCoilResult,
  CoupledIterationRecord,
} from "../../domain/types";
import { calculateAirProperties } from "../airSide/airProperties";
import { calculateMassFlowAirKgS } from "../core/heatBalance";
import { calculateLMTD, calculateHeatTransferByLMTD } from "../core/lmtd";
import { calculateOverallU } from "../core/overallHeatTransfer";
import {
  calculateReynolds,
  calculateNusseltGnielinski,
  calculateConvectiveCoefficient,
} from "../core/dimensionless";
import { calculateDarcyFrictionFactor } from "../core/friction";
import { calculateFinEfficiencySimplified } from "../core/finEfficiency";
import {
  saturationPressure,
  humidityRatio,
  enthalpyMoistAir,
  dewPoint,
  cpMoistAir,
} from "../psychrometrics/psychrometricCore";
import { calculateAirGeometry } from "../airSide/airGeometry";
import { calculateAirSideHTC } from "../airSide/airHeatTransfer";
import { computeFinnedExternalArea } from "../core/finnedExternalArea";

const KCALH_PER_KW = 859.845;
const DEFAULT_FLUID_H = 1000;

export function solveCoupledCoil(input: CoilAdvancedInput): CoupledCoilResult {
  const warnings: string[] = [];

  const T_air_in = input.air_inlet_temp_c ?? 25;
  const RH_in = input.air_relative_humidity ?? 0.5;
  const T_f_in = input.fluid_inlet_temp_c ?? 5;
  const T_f_out = input.fluid_outlet_temp_c ?? T_f_in;
  const airflow = input.airflow_m3h ?? 0;
  const rows = input.rows ?? 0;
  const tubesPerRow = input.tubes_per_row ?? 0;
  const lengthMm = input.length_mm ?? 0;
  const tubeDiamMm = input.tube_diameter_mm ?? 9.52;
  const tubeThickMm = input.tube_thickness_mm ?? 0.35;
  const roughness = input.tube_roughness_m ?? 0.0000015;
  const P_atm = 101325;

  const maxIter = input.coupled_max_iterations ?? 100;
  const tolerance = input.coupled_tolerance_w ?? 5;
  const relativeTol = input.relative_tolerance ?? 0.005;
  const deadband = input.coupled_deadband_c ?? 0.2;

  const lengthM = lengthMm / 1000;
  const tubeDiamM = tubeDiamMm / 1000;
  const tubeThickM = tubeThickMm / 1000;

  // C_AREA: Área externa total (tubo nu + aletas) — convenção LMTD.
  // η_o é aplicado em h_ar via calculateOverallU (finEfficiency), NÃO na área.
  const pitchTmm_c = input.tube_pitch_transverse_m ? input.tube_pitch_transverse_m * 1000 : 0;
  const pitchLmm_c = input.tube_pitch_longitudinal_m ? input.tube_pitch_longitudinal_m * 1000 : 0;
  const finSpacingMm_c = input.fin_spacing_mm ?? 0;
  const finThickMm_c = input.fin_thickness_mm ?? 0.12;
  const hasFinnedGeometry_c = pitchTmm_c > 0 && pitchLmm_c > 0 && finSpacingMm_c > 0;

  let exchange_area_m2: number;
  if (hasFinnedGeometry_c) {
    const finnedArea = computeFinnedExternalArea({
      rows,
      tubes_per_row: tubesPerRow,
      length_mm: lengthMm,
      tube_diameter_mm: tubeDiamMm,
      tube_pitch_transverse_mm: pitchTmm_c,
      tube_pitch_longitudinal_mm: pitchLmm_c,
      fin_spacing_mm: finSpacingMm_c,
      fin_thickness_mm: finThickMm_c,
    });
    warnings.push(...finnedArea.warnings);
    exchange_area_m2 = finnedArea.A_total_m2;
  } else {
    exchange_area_m2 = rows * tubesPerRow * lengthM * Math.PI * tubeDiamM;
    if (finSpacingMm_c <= 0) {
      warnings.push(
        "fin_spacing_mm ausente — área calculada como tubo nu apenas. " +
        "Fornecer tube_pitch_transverse_m, tube_pitch_longitudinal_m e fin_spacing_mm para área com aletas.",
      );
    }
  }

  if (exchange_area_m2 <= 0) warnings.push("área de troca zero ou ausente");
  if (airflow <= 0) warnings.push("airflow_m3h ausente ou zero");

  const faceArea = Math.max(tubesPerRow * lengthM * 0.025, 0.01);
  const finCond = input.fin_conductivity_w_mk ?? 200;
  const finThick = input.fin_thickness_m ?? 0.0001;
  const foulingAir = input.fouling_air_m2k_w ?? 0;
  const foulingFluid = input.fouling_fluid_m2k_w ?? 0;
  const h_fluid = input.fluid_h_w_m2k ?? DEFAULT_FLUID_H;

  const wallConductivity = 385;
  const wallResistance =
    input.wall_resistance_m2k_w ?? (tubeThickM > 0 ? tubeThickM / wallConductivity : 0);

  let T_surface: number;
  if (T_f_out !== T_f_in) {
    T_surface = T_f_in + 0.3 * (T_f_out - T_f_in);
  } else {
    T_surface = T_f_in;
    warnings.push("T_surface aproximado como T_f_in (simplificação).");
  }

  const { W: W_in, warnings: wWarn } = humidityRatio(T_air_in, RH_in, P_atm);
  warnings.push(...wWarn);
  const h_in_kj = enthalpyMoistAir(T_air_in, W_in);
  const { T_dp, warnings: dpWarn } = dewPoint(T_air_in, RH_in);
  warnings.push(...dpWarn);

  let airProps = calculateAirProperties(T_air_in);
  const m_air_provided = input.air_mass_flow_kg_s;
  let m_air = m_air_provided ?? calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

  let T_air_out = input.coupled_air_outlet_guess_c ?? T_air_in - 5;
  let previousMode: "dry" | "wet" | "transition" = "dry";

  const iteration_history: CoupledIterationRecord[] = [];
  let converged = false;
  let lastError = 0;
  let lastRelError = 0;
  let lastU = 0;
  let lastLMTD = 0;
  let lastHAirDry = 0;
  let lastHAirCorrected = 0;
  let lastWetFactor = 1.0;
  let lastMode: "dry" | "wet" | "transition" = "dry";
  let lastW_out = W_in;
  let lastWaterRemoved = 0;
  let lastLatent = 0;
  let lastSensible = 0;
  let lastTotal = 0;

  if (airflow <= 0 || exchange_area_m2 <= 0) {
    warnings.push("Dados insuficientes para solver acoplado.");
    return buildErrorResult(warnings, iteration_history, T_air_in, T_surface, T_dp, W_in);
  }

  for (let i = 0; i < maxIter; i++) {
    const T_air_mean = (T_air_in + T_air_out) / 2;
    airProps = calculateAirProperties(T_air_mean);
    m_air = m_air_provided ?? calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

    let mode: "dry" | "wet" | "transition";
    if (previousMode === "wet" && T_surface > T_dp + deadband) {
      mode = "transition";
    } else if (previousMode === "dry" && T_surface < T_dp - deadband) {
      mode = "transition";
    } else if (T_surface < T_dp) {
      mode = "wet";
    } else {
      mode = "dry";
    }

    let W_out: number;
    let h_out_kj: number;
    let waterRemoved = 0;
    let latent = 0;
    let sensible = 0;
    let total = 0;

    if (mode === "wet" || mode === "transition") {
      const { W: W_sat } = humidityRatio(T_air_out, 1.0, P_atm);
      W_out = Math.min(W_in, W_sat);
      h_out_kj = enthalpyMoistAir(T_air_out, W_out);

      waterRemoved = Math.max(0, m_air * (W_in - W_out));
      const L = Math.max(2400000, Math.min(2501000, 2501000 - 2361 * T_surface));
      latent = waterRemoved * L;

      const cp_moist = cpMoistAir(W_in) * 1000;
      sensible = m_air * cp_moist * (T_air_in - T_air_out);
      total = m_air * (h_in_kj - h_out_kj) * 1000;
    } else {
      W_out = W_in;
      h_out_kj = enthalpyMoistAir(T_air_out, W_out);
      const cp_moist = cpMoistAir(W_in) * 1000;
      sensible = m_air * cp_moist * (T_air_in - T_air_out);
      total = sensible;
    }

    const Q_psy = total;

    const faceVelocity = airflow > 0 ? airflow / 3600 / faceArea : 0;

    let h_air_dry: number;
    const pitchT = input.tube_pitch_transverse_m;
    if (pitchT !== undefined && input.fin_spacing_mm > 0) {
      const geom = calculateAirGeometry({
        face_area_m2: input.air_face_area_m2 ?? faceArea,
        tube_outer_diameter_m: tubeDiamM,
        tube_pitch_transverse_m: pitchT,
        tube_pitch_longitudinal_m: input.tube_pitch_longitudinal_m ?? 0.022,
        fin_spacing_mm: input.fin_spacing_mm,
        fin_thickness_mm: input.fin_thickness_mm,
        rows,
      });
      if (i === 0) warnings.push(...geom.warnings);

      const airVel = input.air_velocity_ms ?? faceVelocity;
      const airHtc = calculateAirSideHTC({
        air_velocity_ms: airVel,
        air_properties: airProps,
        geometry: geom,
      });
      if (i === 0) warnings.push(...airHtc.warnings);
      h_air_dry = airHtc.h_air_w_m2k;
    } else {
      const Re_air = calculateReynolds({
        density_kg_m3: airProps.density_kg_m3,
        velocity_m_s: faceVelocity,
        hydraulicDiameter_m: tubeDiamM,
        viscosity_pa_s: airProps.viscosity_pa_s,
      });

      const f_air = calculateDarcyFrictionFactor({
        reynolds: Re_air,
        roughness_m: roughness,
        hydraulicDiameter_m: tubeDiamM,
      });

      const nuResult = calculateNusseltGnielinski({
        reynolds: Re_air,
        prandtl: airProps.prandtl,
        frictionFactor: f_air,
      });
      if (i === 0) warnings.push(...nuResult.warnings);

      h_air_dry = calculateConvectiveCoefficient({
        nusselt: nuResult.nusselt,
        conductivity_w_m_k: airProps.conductivity_w_m_k,
        hydraulicDiameter_m: tubeDiamM,
      });
    }

    let wetFactor = 1.0;
    if (mode === "wet" || mode === "transition") {
      const rawFactor = 1 + 3 * Math.max(0, W_in - W_out);
      wetFactor = Math.max(1.0, Math.min(1.5, rawFactor));
    }
    const h_air_corrected = h_air_dry * wetFactor;

    const finResult = calculateFinEfficiencySimplified({
      h_air_w_m2k: h_air_corrected,
      finConductivity_w_mk: finCond,
      finThickness_m: finThick,
    });
    if (i === 0) warnings.push(...finResult.warnings);

    const U = calculateOverallU({
      airSideH_w_m2k: h_air_corrected,
      fluidSideH_w_m2k: h_fluid,
      wallResistance_m2k_w: wallResistance,
      foulingAir_m2k_w: foulingAir,
      foulingFluid_m2k_w: foulingFluid,
      finEfficiency: finResult.finEfficiency,
    });

    const lmtdResult = calculateLMTD({
      hotIn_c: T_air_in,
      hotOut_c: T_air_out,
      coldIn_c: T_f_in,
      coldOut_c: T_f_out,
    });
    if (i === 0) warnings.push(...lmtdResult.warnings);

    const lmtd = lmtdResult.lmtd_k ?? 0;

    let Q_th = 0;
    if (lmtd > 0) {
      Q_th = calculateHeatTransferByLMTD({
        u_w_m2k: U,
        area_m2: exchange_area_m2,
        lmtd_k: lmtd,
      });
    }

    const error = Q_th - Q_psy;
    const relError = Q_th > 1 ? error / Q_th : error;

    lastError = error;
    lastRelError = relError;
    lastU = U;
    lastLMTD = lmtd;
    lastHAirDry = h_air_dry;
    lastHAirCorrected = h_air_corrected;
    lastWetFactor = wetFactor;
    lastMode = mode;
    lastW_out = W_out;
    lastWaterRemoved = waterRemoved;
    lastLatent = latent;
    lastSensible = sensible;
    lastTotal = total;

    iteration_history.push({
      iteration: i + 1,
      T_air_out,
      coil_surface_mode: mode,
      dew_point_c: T_dp,
      W_in,
      W_out,
      Q_psychrometric_w: Q_psy,
      Q_thermal_w: Q_th,
      error_w: error,
      relative_error: relError,
      u_w_m2k: U,
      air_h_corrected_w_m2k: h_air_corrected,
      wet_air_correction_factor: wetFactor,
      lmtd_k: lmtd,
    });

    if (Math.abs(error) < tolerance || Math.abs(relError) < relativeTol) {
      converged = true;
      break;
    }

    const cp_air = cpMoistAir(W_in) * 1000;
    const C_air = Math.max(m_air * cp_air, 1);
    const iterFraction = Math.min(i / 10, 1);
    const relaxation = 0.3 + 0.5 * (1 - iterFraction);

    T_air_out = T_air_out - (relaxation * error) / C_air;

    if (T_air_out < T_surface) {
      T_air_out = T_surface + 0.1;
    }

    if (!Number.isFinite(T_air_out)) {
      warnings.push("T_air_out resultou em NaN/Infinity. Interrompendo.");
      converged = false;
      break;
    }

    previousMode = mode;
  }

  if (!converged && iteration_history.length >= maxIter) {
    warnings.push("Solver não convergiu dentro do limite de iterações.");
  }

  const capacity_w = lastTotal;
  const capacity_kw = capacity_w / 1000;
  const capacity_kcalh = capacity_kw * KCALH_PER_KW;

  let status = "ok";
  if (!converged) status = "max_iterations_reached";
  else if (warnings.length > 0) status = "warning";

  return {
    solver_type: "coupled",
    converged,
    iterations: iteration_history.length,
    capacity_w,
    capacity_kcalh,
    capacity_kw,
    air_inlet_temperature_c: T_air_in,
    air_outlet_temperature_c: T_air_out,
    surface_temperature_c: T_surface,
    coil_surface_mode: lastMode,
    dew_point_c: T_dp,
    W_in,
    W_out: lastW_out,
    water_removed_kg_h: lastWaterRemoved * 3600,
    latent_load_w: lastLatent,
    sensible_load_w: lastSensible,
    total_load_w: lastTotal,
    u_w_m2k: lastU,
    air_h_dry_w_m2k: lastHAirDry,
    air_h_corrected_w_m2k: lastHAirCorrected,
    wet_air_correction_factor: lastWetFactor,
    fluid_h_w_m2k: h_fluid,
    lmtd_k: lastLMTD,
    error_w: lastError,
    relative_error: lastRelError,
    iteration_history,
    warnings,
    status,
  };
}

export const calculateCoupledCoil = solveCoupledCoil;

function buildErrorResult(
  warnings: string[],
  history: CoupledIterationRecord[],
  T_air_in: number,
  T_surface: number,
  T_dp: number,
  W_in: number,
): CoupledCoilResult {
  return {
    solver_type: "coupled",
    converged: false,
    iterations: 0,
    capacity_w: 0,
    capacity_kcalh: 0,
    capacity_kw: 0,
    air_inlet_temperature_c: T_air_in,
    air_outlet_temperature_c: T_air_in,
    surface_temperature_c: T_surface,
    coil_surface_mode: "dry",
    dew_point_c: T_dp,
    W_in,
    W_out: W_in,
    water_removed_kg_h: 0,
    latent_load_w: 0,
    sensible_load_w: 0,
    total_load_w: 0,
    u_w_m2k: 0,
    air_h_dry_w_m2k: 0,
    air_h_corrected_w_m2k: 0,
    wet_air_correction_factor: 1,
    fluid_h_w_m2k: 0,
    lmtd_k: 0,
    error_w: 0,
    relative_error: 0,
    iteration_history: history,
    warnings,
    status: "error",
  };
}
