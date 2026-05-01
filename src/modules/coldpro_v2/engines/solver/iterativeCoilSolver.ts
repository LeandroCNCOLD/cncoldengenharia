import type {
  CoilIterativeInput,
  CoilIterativeResult,
  IterationRecord,
  CircuitPerformanceResult,
  CircuitAggregationResult,
} from "../../domain/types";
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
import { calculateTubeWallResistance } from "../core/wallResistance";
import { calculateFluidProperties } from "../fluidSide/fluidProperties";
import { calculateInternalFluidHTC } from "../fluidSide/fluidHeatTransfer";
import { calculateInternalFluidPressureDrop } from "../fluidSide/fluidPressureDrop";
import { calculateCircuitFlowDistribution } from "../circuit/flowDistribution";
import { calculateCircuitPerformance } from "../circuit/circuitPerformance";
import { aggregateCircuitResults } from "../circuit/circuitAggregator";
import { calculateTwoPhaseProperties } from "../fluidSide/twoPhaseProperties";
import { calculateTwoPhaseHTC } from "../fluidSide/twoPhaseHeatTransfer";

const KCALH_PER_KW = 859.845;
const KCALH_PER_TR = 3024;
const KCALH_PER_BTUH = 0.252;
const DEFAULT_FLUID_H = 1000;
const SMALL = 1e-6;

export function solveCoilIterative(input: CoilIterativeInput): CoilIterativeResult {
  const warnings: string[] = [];

  if (!input.rows) warnings.push("rows ausente");
  if (!input.tubes_per_row) warnings.push("tubes_per_row ausente");
  if (!input.circuits) warnings.push("circuits ausente");
  if (!input.length_mm) warnings.push("length_mm ausente");
  if (!input.airflow_m3h) warnings.push("airflow_m3h ausente");

  const airflow = input.airflow_m3h ?? 0;
  const rows = input.rows ?? 0;
  const tubesPerRow = input.tubes_per_row ?? 0;
  const circuits = input.circuits ?? 0;
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

  const lengthM = lengthMm / 1000;
  const tubeDiamM = tubeDiamMm / 1000;
  const tubeThickM = tubeThickMm / 1000;
  const tubeInnerDiamM = input.tube_inner_diameter_m ?? Math.max(tubeDiamM - 2 * tubeThickM, 0.001);
  const tubeOuterDiamM = input.tube_outer_diameter_m ?? tubeDiamM;
  const exchange_area_m2 = rows * tubesPerRow * lengthM * Math.PI * tubeDiamM;

  if (exchange_area_m2 <= 0) warnings.push("área de troca zero ou ausente");

  const faceArea = Math.max(tubesPerRow * lengthM * 0.025, 0.01);
  const finCond = input.fin_conductivity_w_mk ?? 200;
  const finThick = input.fin_thickness_m ?? 0.0001;
  const foulingAir = input.fouling_air_m2k_w ?? 0;
  const foulingFluid = input.fouling_fluid_m2k_w ?? 0;

  const fluidName = input.fluid;
  const hasFluidCalcData = !!fluidName && m_f > 0 && tubeInnerDiamM > 0;
  const explicitTubeLength = input.tube_length_m;
  const useCircuitPath = hasFluidCalcData && explicitTubeLength !== undefined && circuits > 0;

  if (!hasFluidCalcData && input.fluid_h_w_m2k === null) {
    warnings.push("Usando h_fluido default = 1000 W/m²K por dados insuficientes.");
  }

  if (hasFluidCalcData && !useCircuitPath) {
    warnings.push(
      "tube_length_m não fornecido. Usando cálculo simplificado sem distribuição por circuito.",
    );
  }

  // ── Wall resistance ──────────────────────────────────────────
  let wallResistanceVal: number;
  if (input.wall_resistance_m2k_w !== null) {
    wallResistanceVal = input.wall_resistance_m2k_w;
  } else if (tubeOuterDiamM > 0 && tubeInnerDiamM > 0 && tubeInnerDiamM < tubeOuterDiamM) {
    const wallResult = calculateTubeWallResistance({
      tube_outer_diameter_m: tubeOuterDiamM,
      tube_inner_diameter_m: tubeInnerDiamM,
      tube_material: input.tube_material,
    });
    warnings.push(...wallResult.warnings);
    wallResistanceVal = wallResult.wall_resistance_m2k_w;
  } else {
    wallResistanceVal = 0;
    warnings.push("Resistência de parede não calculada por dados insuficientes.");
  }

  let airProps = calculateAirProperties(T_air_in);
  let m_air = calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

  let T_f_out: number;
  if (input.fluid_outlet_temperature_guess_c !== null) {
    T_f_out = input.fluid_outlet_temperature_guess_c;
  } else {
    T_f_out = isEvaporator ? T_f_in + 5 : T_f_in - 5;
  }

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

  let lastHFluid = input.fluid_h_w_m2k ?? DEFAULT_FLUID_H;
  let lastFluidRe = 0;
  let lastFluidPr = 0;
  let lastFluidNu = 0;
  let lastFluidVelocity = 0;
  let lastFluidFlowRegime = "unknown";
  let lastFluidPressureDropKpa = 0;

  let lastCircuitResults: CircuitPerformanceResult[] | null = null;
  let lastCircuitAgg: CircuitAggregationResult | null = null;

  let lastFluidPhase: "single" | "two_phase" = "single";
  let lastQualityX: number | null = null;
  let lastHTwoPhase: number | null = null;
  let lastHLiquidBase: number | null = null;

  const twoPhaseMode = input.two_phase_mode ?? "disabled";
  const phaseType = input.phase_type;
  const qualityOverride = input.quality_override;

  const useTwoPhase =
    (twoPhaseMode === "forced" && !!fluidName && !!phaseType) ||
    (twoPhaseMode === "auto" && !!phaseType);

  if (twoPhaseMode === "auto" && !phaseType) {
    warnings.push("two_phase_mode=auto mas phase_type não definido. Usando cálculo monofásico.");
  }

  if (m_f <= 0 || cp_f <= 0 || airflow <= 0 || exchange_area_m2 <= 0) {
    return buildErrorResult(warnings, iteration_history);
  }

  const tubeLengthForFluid =
    explicitTubeLength ?? (rows * tubesPerRow * lengthM) / Math.max(circuits, 1);

  const distMode = input.circuit_distribution_mode ?? "uniform";
  const distImbalance = input.circuit_imbalance_factor ?? 0.1;

  for (let i = 0; i < maxIter; i++) {
    const Q_f = m_f * cp_f * Math.abs(T_f_out - T_f_in);

    const C_air = m_air * airProps.cp_j_kg_k;
    if (C_air <= SMALL) {
      warnings.push("Capacidade térmica do ar zero");
      break;
    }

    T_air_out = isEvaporator ? T_air_in - Q_f / C_air : T_air_in + Q_f / C_air;

    const T_air_mean = (T_air_in + T_air_out) / 2;
    airProps = calculateAirProperties(T_air_mean);
    m_air = calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

    const T_f_mean = (T_f_in + T_f_out) / 2;

    // ── Fluid side ─────────────────────────────────────────────
    if (useTwoPhase) {
      const tpProps = calculateTwoPhaseProperties({
        fluid: fluidName ?? "refrigerant_default",
        temperature_c: T_f_mean,
      });
      if (i === 0) warnings.push(...tpProps.warnings);

      let qx = qualityOverride ?? 0.5;
      if (qualityOverride === undefined && i === 0) {
        warnings.push(
          "Qualidade (x) estimada como 0.5 (valor padrão). Forneça quality_override para maior precisão.",
        );
      }
      qx = Math.max(0, Math.min(0.95, qx));

      const tpHTC = calculateTwoPhaseHTC({
        mass_flow_kgs: m_f,
        tube_inner_diameter_m: tubeInnerDiamM,
        quality_x: qx,
        two_phase_properties: tpProps,
        flow_regime_hint: phaseType === "condenser" ? "condensation" : "evaporation",
      });
      if (i === 0) warnings.push(...tpHTC.warnings);
      if (i === 0) warnings.push("Usando modelo bifásico simplificado (Shah-like).");

      lastHFluid = tpHTC.h_two_phase_w_m2k;
      lastFluidRe = tpHTC.reynolds_liquid;
      lastFluidPr = tpHTC.prandtl_liquid;
      lastFluidNu = 0;
      lastFluidVelocity = 0;
      lastFluidFlowRegime = "two_phase";
      lastFluidPhase = "two_phase";
      lastQualityX = tpHTC.quality_x;
      lastHTwoPhase = tpHTC.h_two_phase_w_m2k;
      lastHLiquidBase = tpHTC.h_liquid_base;
    } else if (useCircuitPath) {
      const fluidProps = calculateFluidProperties({
        fluid: fluidName!,
        temperature_c: T_f_mean,
        pressure_kpa: input.fluid_pressure_kpa,
      });
      if (i === 0) warnings.push(...fluidProps.warnings);

      const flowDist = calculateCircuitFlowDistribution({
        total_mass_flow_kgs: m_f,
        circuits,
        distribution_mode: distMode,
        imbalance_factor: distImbalance,
      });
      if (i === 0) warnings.push(...flowDist.warnings);

      const circResults: CircuitPerformanceResult[] = [];
      for (const cf of flowDist.circuit_flows) {
        const cr = calculateCircuitPerformance({
          circuit_index: cf.circuit_index,
          mass_flow_kgs: cf.mass_flow_kgs,
          tube_inner_diameter_m: tubeInnerDiamM,
          tube_length_m: explicitTubeLength!,
          fluid_properties: fluidProps,
          roughness_m: roughness,
        });
        if (i === 0) warnings.push(...cr.warnings);
        circResults.push(cr);
      }

      const agg = aggregateCircuitResults(circResults);
      if (i === 0) warnings.push(...agg.warnings);

      lastCircuitResults = circResults;
      lastCircuitAgg = agg;

      if (distMode === "estimated_imbalance") {
        lastHFluid = agg.min_h_w_m2k;
        if (i === 0) {
          warnings.push(
            "Modo desbalanceado: usando h_fluido do circuito limitante (min_h) para cálculo conservador de U.",
          );
        }
      } else {
        lastHFluid = agg.average_h_w_m2k;
      }

      lastFluidRe = agg.average_reynolds;
      lastFluidVelocity = agg.average_velocity_m_s;
      lastFluidPressureDropKpa = agg.max_pressure_drop_kpa;
      lastFluidFlowRegime =
        agg.min_reynolds < 2300
          ? "laminar"
          : agg.min_reynolds < 4000
            ? "transitional"
            : "turbulent";

      if (circResults.length > 0) {
        lastFluidPr = circResults[0]!.prandtl;
        lastFluidNu = agg.average_h_w_m2k > 0 ? circResults[0]!.nusselt : 0;
      }
    } else if (hasFluidCalcData) {
      const fluidProps = calculateFluidProperties({
        fluid: fluidName!,
        temperature_c: T_f_mean,
        pressure_kpa: input.fluid_pressure_kpa,
      });
      if (i === 0) warnings.push(...fluidProps.warnings);

      const fluidHTC = calculateInternalFluidHTC({
        mass_flow_kgs: m_f,
        circuits,
        tube_inner_diameter_m: tubeInnerDiamM,
        fluid_properties: fluidProps,
        tube_length_m: tubeLengthForFluid,
        roughness_m: roughness,
      });
      if (i === 0) warnings.push(...fluidHTC.warnings);

      lastHFluid = fluidHTC.h_w_m2k;
      lastFluidRe = fluidHTC.reynolds;
      lastFluidPr = fluidHTC.prandtl;
      lastFluidNu = fluidHTC.nusselt;
      lastFluidVelocity = fluidHTC.velocity_m_s;
      lastFluidFlowRegime = fluidHTC.flow_regime;

      const fluidDP = calculateInternalFluidPressureDrop({
        friction_factor: fluidHTC.friction_factor,
        tube_length_m: tubeLengthForFluid,
        tube_inner_diameter_m: tubeInnerDiamM,
        density_kg_m3: fluidProps.density_kg_m3,
        velocity_m_s: fluidHTC.velocity_m_s,
      });
      lastFluidPressureDropKpa = fluidDP.pressure_drop_kpa;
    }

    // ── LMTD ───────────────────────────────────────────────────
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
    if (i === 0) warnings.push(...lmtdResult.warnings);
    lastLMTD = lmtdResult.lmtd_k;

    // ── Air side ───────────────────────────────────────────────
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
    if (i === 0) warnings.push(...nuResult.warnings);
    lastNuAir = nuResult.nusselt;

    lastHAir = calculateConvectiveCoefficient({
      nusselt: lastNuAir,
      conductivity_w_m_k: airProps.conductivity_w_m_k,
      hydraulicDiameter_m: tubeDiamM,
    });

    const finResult = calculateFinEfficiencySimplified({
      h_air_w_m2k: lastHAir,
      finConductivity_w_mk: finCond,
      finThickness_m: finThick,
    });
    if (i === 0) warnings.push(...finResult.warnings);

    lastU = calculateOverallU({
      airSideH_w_m2k: lastHAir,
      fluidSideH_w_m2k: lastHFluid,
      wallResistance_m2k_w: wallResistanceVal,
      foulingAir_m2k_w: foulingAir,
      foulingFluid_m2k_w: foulingFluid,
      finEfficiency: finResult.finEfficiency,
    });

    let Q_calc = 0;
    if (lastLMTD !== null && lastLMTD > 0) {
      Q_calc = calculateHeatTransferByLMTD({
        u_w_m2k: lastU,
        area_m2: exchange_area_m2,
        lmtd_k: lastLMTD,
        correctionFactor,
      });
    }

    const error = Q_calc - Q_f;
    lastError = error;
    lastQ = Q_calc;

    const airRowDepth = rows * tubeDiamM * 2;
    lastAirPressureDrop = calculateDarcyWeisbachPressureDrop({
      frictionFactor: f_air,
      length_m: airRowDepth,
      hydraulicDiameter_m: tubeDiamM,
      density_kg_m3: airProps.density_kg_m3,
      velocity_m_s: faceVelocity,
    });

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
      fluid_mean_temperature_c: T_f_mean,
      fluid_reynolds: lastFluidRe,
      fluid_nusselt: lastFluidNu,
      fluid_h_w_m2k: lastHFluid,
      fluid_velocity_ms: lastFluidVelocity,
      limiting_circuit_index: lastCircuitAgg?.limiting_circuit_index ?? null,
      average_fluid_h_w_m2k: lastCircuitAgg?.average_h_w_m2k ?? null,
      min_fluid_h_w_m2k: lastCircuitAgg?.min_h_w_m2k ?? null,
      max_fluid_h_w_m2k: lastCircuitAgg?.max_h_w_m2k ?? null,
      max_fluid_pressure_drop_kpa: lastCircuitAgg?.max_pressure_drop_kpa ?? null,
      quality_x: lastQualityX,
      h_two_phase_w_m2k: lastHTwoPhase,
    });

    if (Math.abs(error) < tolerance) {
      converged = true;
      break;
    }

    const C_f = Math.max(m_f * cp_f, SMALL);
    T_f_out = T_f_out + (relaxation * error) / C_f;

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

  if (converged && lastQ < 1) {
    converged = false;
    warnings.push("Capacidade calculada abaixo de 1 W. Resultado fisicamente inválido.");
  }

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
    fluid_h_w_m2k: lastHFluid,
    reynolds_air: lastReAir,
    prandtl_air: lastPrAir,
    nusselt_air: lastNuAir,
    air_pressure_drop_pa: lastAirPressureDrop,
    fluid_pressure_drop_kpa: lastFluidPressureDropKpa,
    fluid_reynolds: lastFluidRe,
    fluid_prandtl: lastFluidPr,
    fluid_nusselt: lastFluidNu,
    fluid_velocity_ms: lastFluidVelocity,
    fluid_flow_regime: lastFluidFlowRegime,
    wall_resistance_m2k_w: wallResistanceVal,
    fluid_phase: lastFluidPhase,
    quality_x: lastQualityX,
    h_two_phase_w_m2k: lastHTwoPhase,
    h_liquid_base: lastHLiquidBase,
    circuit_results: lastCircuitResults,
    circuit_aggregation: lastCircuitAgg,
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
    fluid_pressure_drop_kpa: 0,
    fluid_reynolds: 0,
    fluid_prandtl: 0,
    fluid_nusselt: 0,
    fluid_velocity_ms: 0,
    fluid_flow_regime: "unknown",
    wall_resistance_m2k_w: 0,
    fluid_phase: "single",
    quality_x: null,
    h_two_phase_w_m2k: null,
    h_liquid_base: null,
    circuit_results: null,
    circuit_aggregation: null,
    error_w: 0,
    iteration_history,
    warnings,
    status: "error",
  };
}
