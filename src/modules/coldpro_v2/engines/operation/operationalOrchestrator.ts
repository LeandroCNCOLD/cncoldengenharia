import type {
  OperationalOrchestratorInput,
  OperationalOrchestratorResult,
  CoupledCoilResult,
  FrostFormationResult,
  DefrostCycleResult,
} from "../../domain/types";
import { solveCoupledCoil } from "../solver/coupledCoilSolver";
import { calculateFrostFormation } from "../defrost/frostFormation";
import { calculateDefrostCycle } from "../defrost/defrostCycle";
import { saturationPressure } from "../psychrometrics/psychrometricCore";

function calculateRHFromW(T_c: number, W: number, P_atm = 101325): number {
  const P_vapor = (W * P_atm) / (0.62198 + W);
  const P_ws = saturationPressure(T_c);
  return Math.max(0, Math.min(1, P_ws > 0 ? P_vapor / P_ws : 0));
}

function buildErrorResult(
  input: OperationalOrchestratorInput,
  warnings: string[],
  coupled: CoupledCoilResult | null,
  frost: FrostFormationResult | null,
): OperationalOrchestratorResult {
  const emptyCoupled: CoupledCoilResult = coupled ?? {
    solver_type: "coupled",
    converged: false,
    iterations: 0,
    capacity_w: 0,
    capacity_kcalh: 0,
    capacity_kw: 0,
    air_inlet_temperature_c: 0,
    air_outlet_temperature_c: 0,
    surface_temperature_c: 0,
    coil_surface_mode: "dry",
    dew_point_c: 0,
    W_in: 0,
    W_out: 0,
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
    iteration_history: [],
    warnings: [],
    status: "error",
  };

  const emptyFrost: FrostFormationResult = frost ?? {
    mode: "dry",
    dew_point_c: 0,
    W_in: 0,
    W_surface: 0,
    water_condensed_kg_h: 0,
    frost_fraction: 0,
    frost_formation_kg_h: 0,
    frost_mass_kg: 0,
    frost_density_kg_m3: 250,
    frost_volume_m3: 0,
    frost_thickness_mm: 0,
    airflow_reduction_factor: 1,
    estimated_capacity_loss_pct: 0,
    recommended_defrost: false,
    estimated_time_to_defrost_h: null,
    warnings: [],
    status: "error",
  };

  return {
    operation_time_h: input.operation_time_h,
    coupled_result: emptyCoupled,
    frost_result: emptyFrost,
    defrost_result: null,
    recommended_defrost: false,
    effective_capacity_w: 0,
    capacity_loss_pct: 0,
    airflow_reduction_factor: 1,
    defrost_time_min: 0,
    useful_operation_time_h: 0,
    operational_availability_pct: 0,
    cycle_status: "error",
    warnings,
    status: "error",
  };
}

export function calculateOperationalCycle(
  input: OperationalOrchestratorInput,
): OperationalOrchestratorResult {
  const warnings: string[] = [];

  if (input.operation_time_h <= 0) {
    warnings.push("operation_time_h <= 0.");
    return buildErrorResult(input, warnings, null, null);
  }
  if (input.frost.evaporator_external_area_m2 <= 0) {
    warnings.push("frost.evaporator_external_area_m2 <= 0.");
    return buildErrorResult(input, warnings, null, null);
  }
  if (input.defrost.compressor_capacity_w <= 0) {
    warnings.push("defrost.compressor_capacity_w <= 0.");
    return buildErrorResult(input, warnings, null, null);
  }
  if (input.defrost.T_condensing_c <= input.defrost.T_evaporating_c) {
    warnings.push("defrost.T_condensing_c <= defrost.T_evaporating_c.");
    return buildErrorResult(input, warnings, null, null);
  }

  const coupledResult = solveCoupledCoil(input.coupled_input);
  warnings.push(...coupledResult.warnings);

  if (coupledResult.status === "error") {
    warnings.push("Coupled solver returned error.");
    return buildErrorResult(input, warnings, coupledResult, null);
  }

  const P_atm = 101325;
  const airRH = calculateRHFromW(
    coupledResult.air_outlet_temperature_c,
    coupledResult.W_out,
    P_atm,
  );

  let airMassFlow: number;
  if (input.coupled_input.air_mass_flow_kg_s !== undefined) {
    airMassFlow = input.coupled_input.air_mass_flow_kg_s;
  } else if (input.coupled_input.airflow_m3h) {
    airMassFlow = (input.coupled_input.airflow_m3h * 1.2) / 3600;
  } else {
    warnings.push("air_mass_flow_kg_s or airflow_m3h required.");
    return buildErrorResult(input, warnings, coupledResult, null);
  }

  const frostResult = calculateFrostFormation({
    air_temperature_c: coupledResult.air_outlet_temperature_c,
    air_relative_humidity: airRH,
    air_mass_flow_kg_s: airMassFlow,
    coil_surface_temperature_c: coupledResult.surface_temperature_c,
    evaporating_temperature_c: input.coupled_input.fluid_inlet_temp_c ?? undefined,
    operation_time_h: input.operation_time_h,
    evaporator_external_area_m2: input.frost.evaporator_external_area_m2,
    frost_density_kg_m3: input.frost.frost_density_kg_m3,
    defrost_threshold_frost_mass_kg: input.frost.defrost_threshold_frost_mass_kg,
    defrost_threshold_frost_thickness_mm: input.frost.defrost_threshold_frost_thickness_mm,
  });
  warnings.push(...frostResult.warnings);

  const capacityLoss = frostResult.estimated_capacity_loss_pct;
  const airflowReduction = frostResult.airflow_reduction_factor;
  const effectiveCapacity = coupledResult.capacity_w * (1 - capacityLoss / 100);

  let defrostResult: DefrostCycleResult | null = null;

  if (frostResult.recommended_defrost) {
    defrostResult = calculateDefrostCycle({
      method: input.defrost.method,
      frost_mass_kg: frostResult.frost_mass_kg,
      frost_temperature_c: coupledResult.surface_temperature_c,
      compressor_capacity_w: input.defrost.compressor_capacity_w,
      T_condensing_c: input.defrost.T_condensing_c,
      T_evaporating_c: input.defrost.T_evaporating_c,
      bypass_fraction: input.defrost.bypass_fraction,
      evaporator_external_area_m2:
        input.defrost.evaporator_external_area_m2 ?? input.frost.evaporator_external_area_m2,
      max_defrost_time_min: input.defrost.max_defrost_time_min,
    });
    warnings.push(...defrostResult.warnings);
  }

  const defrostTimeMin = defrostResult?.defrost_time_min ?? 0;
  const usefulTime = Math.max(0, input.operation_time_h - defrostTimeMin / 60);
  const availability = input.operation_time_h > 0 ? (usefulTime / input.operation_time_h) * 100 : 0;

  let cycleStatus: OperationalOrchestratorResult["cycle_status"];
  if (frostResult.recommended_defrost && defrostResult && !defrostResult.defrost_time_feasible) {
    cycleStatus = "defrost_required";
  } else if (frostResult.recommended_defrost) {
    cycleStatus = "defrost_recommended";
  } else {
    cycleStatus = "normal";
  }

  if (capacityLoss > 20) {
    warnings.push("Perda de capacidade acima de 20%. Recomenda-se degelo.");
  }
  if (availability < 90) {
    warnings.push("Disponibilidade operacional abaixo de 90%.");
  }

  let status: OperationalOrchestratorResult["status"] = "ok";
  if (
    frostResult.recommended_defrost ||
    capacityLoss > 20 ||
    (defrostResult && !defrostResult.defrost_time_feasible)
  ) {
    status = "warning";
  }

  return {
    operation_time_h: input.operation_time_h,
    coupled_result: coupledResult,
    frost_result: frostResult,
    defrost_result: defrostResult,
    recommended_defrost: frostResult.recommended_defrost,
    effective_capacity_w: effectiveCapacity,
    capacity_loss_pct: capacityLoss,
    airflow_reduction_factor: airflowReduction,
    defrost_time_min: defrostTimeMin,
    useful_operation_time_h: usefulTime,
    operational_availability_pct: availability,
    cycle_status: cycleStatus,
    warnings,
    status,
  };
}
