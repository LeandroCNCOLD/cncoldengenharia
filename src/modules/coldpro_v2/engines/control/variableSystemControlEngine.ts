import type {
  CompressorControlMode,
  FanControlMode,
  SystemComponentsInput,
  VariableControlInput,
  VariableControlResult,
} from "../../domain/types";
import { evaluateSystemEquilibrium } from "../equilibrium/systemEquilibriumEngine";

const FAN_BASE_POWER_W = 500;

function safeDivide(num: number, den: number, fallback = 0): number {
  if (den === 0 || !Number.isFinite(den)) return fallback;
  return num / den;
}

function buildErrorResult(warnings: string[]): VariableControlResult {
  return {
    status: "error",
    iterations: 0,
    compressor_speed_pct: 0,
    condenser_fan_speed_pct: 0,
    evaporator_fan_speed_pct: 0,
    evap_temp_c: 0,
    cond_temp_c: 0,
    delivered_capacity_w: 0,
    compressor_power_w: 0,
    fan_power_w: 0,
    cop_system: 0,
    capacity_error_pct: 0,
    warnings,
  };
}

function isValidCompressorMode(mode: CompressorControlMode): boolean {
  return mode === "fixed" || mode === "inverter" || mode === "staged";
}

function isValidFanMode(mode: FanControlMode): boolean {
  return mode === "fixed" || mode === "variable";
}

function validateInput(input: VariableControlInput): string[] {
  const warnings: string[] = [];
  const minCapacityPct = input.control?.compressor?.min_capacity_pct ?? 20;
  const stages = input.control?.compressor?.stages;

  if (!input.base_system) warnings.push("simulateVariableSystemControl: base_system is required.");
  if (!input.required_capacity_w || input.required_capacity_w <= 0) {
    warnings.push("simulateVariableSystemControl: required_capacity_w must be greater than zero.");
  }
  if (!Number.isFinite(input.targets?.room_temp_c)) {
    warnings.push("simulateVariableSystemControl: targets.room_temp_c must be finite.");
  }
  if (!input.targets?.evap_approach_k || input.targets.evap_approach_k <= 0) {
    warnings.push(
      "simulateVariableSystemControl: targets.evap_approach_k must be greater than zero.",
    );
  }
  if (!input.targets?.cond_approach_k || input.targets.cond_approach_k <= 0) {
    warnings.push(
      "simulateVariableSystemControl: targets.cond_approach_k must be greater than zero.",
    );
  }
  if (!isValidCompressorMode(input.control?.compressor?.mode)) {
    warnings.push("simulateVariableSystemControl: compressor control mode is invalid.");
  }
  if (!isValidFanMode(input.control?.condenser_fan?.mode)) {
    warnings.push("simulateVariableSystemControl: condenser fan control mode is invalid.");
  }
  if (!isValidFanMode(input.control?.evaporator_fan?.mode)) {
    warnings.push("simulateVariableSystemControl: evaporator fan control mode is invalid.");
  }
  if (
    input.control?.compressor?.mode === "inverter" &&
    (minCapacityPct < 1 || minCapacityPct > 99)
  ) {
    warnings.push("simulateVariableSystemControl: min_capacity_pct must be between 1 and 99.");
  }
  if (
    input.control?.compressor?.mode === "staged" &&
    (!Array.isArray(stages) ||
      stages.length === 0 ||
      stages.some((stage) => !Number.isFinite(stage) || stage < 1 || stage > 100))
  ) {
    warnings.push("simulateVariableSystemControl: compressor stages must be between 1 and 100.");
  }

  return warnings;
}

function selectCompressorState(
  input: VariableControlInput,
  nominalCapacity: number,
  nominalPower: number,
  minCompPct: number,
): {
  compressor_speed_pct: number;
  scaled_capacity_w: number;
  scaled_power_w: number;
} {
  if (input.control.compressor.mode === "fixed") {
    return {
      compressor_speed_pct: 100,
      scaled_capacity_w: nominalCapacity,
      scaled_power_w: nominalPower,
    };
  }

  if (input.control.compressor.mode === "inverter") {
    const targetPct = safeDivide(input.required_capacity_w, nominalCapacity) * 100;
    const compressorSpeedPct = Math.min(100, Math.max(minCompPct, targetPct));
    const speedRatio = compressorSpeedPct / 100;

    return {
      compressor_speed_pct: compressorSpeedPct,
      scaled_capacity_w: nominalCapacity * speedRatio,
      scaled_power_w: nominalPower * Math.pow(speedRatio, 0.9),
    };
  }

  const sortedStages = [...(input.control.compressor.stages ?? [100])].sort((a, b) => a - b);
  const requiredPct = safeDivide(input.required_capacity_w, nominalCapacity) * 100;
  const selectedStage =
    sortedStages.find((stage) => stage >= requiredPct) ?? sortedStages[sortedStages.length - 1];
  const speedRatio = selectedStage / 100;

  return {
    compressor_speed_pct: selectedStage,
    scaled_capacity_w: nominalCapacity * speedRatio,
    scaled_power_w: nominalPower * speedRatio,
  };
}

function buildUpdatedSystem(
  input: VariableControlInput,
  scaledCapacityW: number,
  scaledPowerW: number,
  evapTempC: number,
  condTempC: number,
  evapAirflowM3H: number,
  ambientTempC: number,
): SystemComponentsInput {
  return {
    ...input.base_system,
    compressor: {
      ...input.base_system.compressor,
      cooling_capacity_w: scaledCapacityW,
      power_w: scaledPowerW,
      evap_temp_c: evapTempC,
      cond_temp_c: condTempC,
    },
    evaporator: {
      progressive_input: {
        ...input.base_system.evaporator.progressive_input,
        rolls: input.base_system.evaporator.progressive_input.rolls.map((roll) => ({ ...roll })),
        T_evaporating_c: evapTempC,
      },
    },
    system_conditions: {
      ...input.base_system.system_conditions,
      ambient_temp_c: ambientTempC,
      required_airflow_m3_h: evapAirflowM3H,
    },
  };
}

export function simulateVariableSystemControl(input: VariableControlInput): VariableControlResult {
  const validationWarnings = validateInput(input);
  if (validationWarnings.length > 0) return buildErrorResult(validationWarnings);

  const maxIterations = input.limits?.max_iterations ?? 20;
  const tolerancePct = input.limits?.tolerance_pct ?? 5;
  const minCompPct = input.control.compressor.min_capacity_pct ?? 20;
  const nominalCapacity = input.base_system.compressor.cooling_capacity_w;
  const nominalPower = input.base_system.compressor.power_w;
  const ambientTemp = input.base_system.system_conditions?.ambient_temp_c ?? 32;
  const baseEvapAirflow = input.control.evaporator_fan.base_airflow_m3_h ?? 4000;

  let compressor_speed_pct = 100;
  let condenser_fan_speed_pct = 100;
  let evaporator_fan_speed_pct = 100;
  let evap_temp_c = input.targets.room_temp_c - input.targets.evap_approach_k;
  let cond_temp_c = input.base_system.compressor.cond_temp_c;
  let delivered_capacity_w = 0;
  let compressor_power_w = 0;
  let capacity_error_pct = 100;
  let iterations = 0;
  const warnings: string[] = [];
  let last_error_pct = Infinity;
  let oscillation_count = 0;

  for (let i = 0; i < maxIterations; i += 1) {
    iterations = i + 1;
    evap_temp_c = input.targets.room_temp_c - input.targets.evap_approach_k;

    if (input.control.condenser_fan.mode === "variable") {
      const fanPctClamped = Math.max(10, condenser_fan_speed_pct) / 100;
      cond_temp_c = ambientTemp + safeDivide(input.targets.cond_approach_k, fanPctClamped);
    } else {
      cond_temp_c = input.base_system.compressor.cond_temp_c;
    }

    const compressorState = selectCompressorState(input, nominalCapacity, nominalPower, minCompPct);
    compressor_speed_pct = compressorState.compressor_speed_pct;
    compressor_power_w = compressorState.scaled_power_w;

    const evapAirflowM3H =
      input.control.evaporator_fan.mode === "variable"
        ? baseEvapAirflow * (evaporator_fan_speed_pct / 100)
        : (input.base_system.system_conditions?.required_airflow_m3_h ?? baseEvapAirflow);

    const updatedSystem = buildUpdatedSystem(
      input,
      compressorState.scaled_capacity_w,
      compressorState.scaled_power_w,
      evap_temp_c,
      cond_temp_c,
      evapAirflowM3H,
      ambientTemp,
    );
    const equilibrium = evaluateSystemEquilibrium(updatedSystem);

    delivered_capacity_w =
      equilibrium.status === "rejected"
        ? Math.min(equilibrium.thermal_balance.q_evap_w, compressorState.scaled_capacity_w)
        : Math.min(
            equilibrium.thermal_balance.q_evap_w || compressorState.scaled_capacity_w,
            compressorState.scaled_capacity_w,
          );
    capacity_error_pct =
      safeDivide(
        Math.abs(delivered_capacity_w - input.required_capacity_w),
        input.required_capacity_w,
      ) * 100;

    if (capacity_error_pct <= tolerancePct) break;

    if (Math.abs(capacity_error_pct - last_error_pct) < 0.5) {
      oscillation_count += 1;
    } else {
      oscillation_count = 0;
    }
    last_error_pct = capacity_error_pct;

    if (input.control.condenser_fan.mode === "variable") {
      condenser_fan_speed_pct =
        delivered_capacity_w < input.required_capacity_w
          ? Math.min(100, condenser_fan_speed_pct + 5)
          : Math.max(10, condenser_fan_speed_pct - 5);
    }

    if (input.control.evaporator_fan.mode === "variable") {
      evaporator_fan_speed_pct =
        delivered_capacity_w < input.required_capacity_w
          ? Math.min(100, evaporator_fan_speed_pct + 5)
          : Math.max(10, evaporator_fan_speed_pct - 5);
    }
  }

  const condFanPower = FAN_BASE_POWER_W * Math.pow(condenser_fan_speed_pct / 100, 3);
  const evapFanPower = FAN_BASE_POWER_W * Math.pow(evaporator_fan_speed_pct / 100, 3);
  const fan_power_w = condFanPower + evapFanPower;
  const cop_system = safeDivide(delivered_capacity_w, compressor_power_w + fan_power_w);

  let status: VariableControlResult["status"];
  if (capacity_error_pct <= tolerancePct) {
    status = "stable";
  } else if (
    compressor_speed_pct >= 100 &&
    delivered_capacity_w < input.required_capacity_w * 0.9
  ) {
    status = "unreachable";
  } else if (oscillation_count >= 3) {
    status = "cycling";
  } else {
    status = "unreachable";
  }

  if (compressor_speed_pct >= 100 && delivered_capacity_w < input.required_capacity_w) {
    warnings.push("Compressor at maximum capacity but required load not reached.");
  }
  if (condenser_fan_speed_pct >= 100) warnings.push("Condenser fan at maximum speed.");
  if (evaporator_fan_speed_pct >= 100) warnings.push("Evaporator fan at maximum speed.");
  if (cop_system < 1.5) {
    warnings.push(`System COP is very low: ${cop_system.toFixed(2)}. Check operating conditions.`);
  }
  if (status !== "stable") {
    warnings.push(`Convergence not achieved after ${iterations} iterations. Status: ${status}.`);
  }

  return {
    status,
    iterations,
    compressor_speed_pct,
    condenser_fan_speed_pct,
    evaporator_fan_speed_pct,
    evap_temp_c,
    cond_temp_c,
    delivered_capacity_w,
    compressor_power_w,
    fan_power_w,
    cop_system,
    capacity_error_pct,
    warnings: Array.from(new Set(warnings)),
  };
}
