import type {
  CircuitControlResult,
  CompressorDispatchResult,
  CompressorUnit,
  MultiCircuitControlInput,
  MultiCircuitControlResult,
  RefrigerationCircuit,
} from "../../domain/types";
import { evaluateSystemArchitecture } from "../architecture/systemArchitectureEngine";

function safeDivide(num: number, den: number, fallback = 0): number {
  if (den === 0 || !Number.isFinite(den)) return fallback;
  return num / den;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildErrorResult(warnings: string[]): MultiCircuitControlResult {
  return {
    status: "error",
    circuits: [],
    total_required_capacity_w: 0,
    total_delivered_capacity_w: 0,
    total_capacity_error_pct: 0,
    estimated_total_power_w: 0,
    estimated_cop: 0,
    condenser_loads: {},
    condenser_warnings: [],
    warnings,
  };
}

function validateLoads(input: MultiCircuitControlInput): string[] {
  const warnings: string[] = [];
  const circuitIds = new Set(input.architecture.circuits.map((circuit) => circuit.id));

  for (const load of input.loads ?? []) {
    if (!circuitIds.has(load.circuit_id)) {
      warnings.push(
        `solveMultiCircuitVariableControl: load references unknown circuit "${load.circuit_id}".`,
      );
    }
    if (!Number.isFinite(load.required_capacity_w) || load.required_capacity_w < 0) {
      warnings.push(
        `solveMultiCircuitVariableControl: required_capacity_w for circuit "${load.circuit_id}" must be >= 0.`,
      );
    }
  }

  return warnings;
}

function sortCompressors(
  compressors: CompressorUnit[],
  preferInverterTrim: boolean,
): CompressorUnit[] {
  const order = preferInverterTrim
    ? { fixed: 0, staged: 1, inverter: 2 }
    : { inverter: 0, staged: 1, fixed: 2 };

  return [...compressors].sort((a, b) => order[a.type] - order[b.type]);
}

function dispatchFixed(
  comp: CompressorUnit,
  remaining: number,
): { dispatch: CompressorDispatchResult; delivered: number; remaining: number } {
  const cap = comp.nominal_capacity_w;
  const pwr = comp.power_w;

  return {
    dispatch: {
      compressor_id: comp.id,
      type: comp.type,
      state: "on",
      capacity_w: cap,
      power_w: pwr,
    },
    delivered: cap,
    remaining: remaining - cap,
  };
}

function dispatchStaged(
  comp: CompressorUnit,
  remaining: number,
): { dispatch: CompressorDispatchResult; delivered: number; remaining: number } {
  const rawStages = comp.min_capacity_pct != null ? [comp.min_capacity_pct, 100] : [50, 100];
  const stages = [...new Set(rawStages)].sort((a, b) => a - b);
  let selectedStage = stages[stages.length - 1];

  for (const stage of stages) {
    if ((comp.nominal_capacity_w * stage) / 100 >= remaining) {
      selectedStage = stage;
      break;
    }
  }

  const cap = (comp.nominal_capacity_w * selectedStage) / 100;
  const pwr = (comp.power_w * selectedStage) / 100;

  return {
    dispatch: {
      compressor_id: comp.id,
      type: comp.type,
      state: "on",
      capacity_w: cap,
      power_w: pwr,
      speed_pct: selectedStage,
    },
    delivered: cap,
    remaining: remaining - cap,
  };
}

function dispatchInverter(
  circuitId: string,
  comp: CompressorUnit,
  remaining: number,
  allowCycling: boolean,
  warnings: string[],
): { dispatch: CompressorDispatchResult; delivered: number; remaining: number } {
  const minPct = clamp(comp.min_capacity_pct ?? 30, 1, 100);
  const minCap = (comp.nominal_capacity_w * minPct) / 100;

  if (remaining >= comp.nominal_capacity_w) {
    return {
      dispatch: {
        compressor_id: comp.id,
        type: comp.type,
        state: "modulating",
        capacity_w: comp.nominal_capacity_w,
        power_w: comp.power_w,
        speed_pct: 100,
      },
      delivered: comp.nominal_capacity_w,
      remaining: remaining - comp.nominal_capacity_w,
    };
  }

  if (remaining >= minCap) {
    const speedPct = clamp(safeDivide(remaining, comp.nominal_capacity_w) * 100, minPct, 100);
    const cap = (comp.nominal_capacity_w * speedPct) / 100;
    const pwr = comp.power_w * Math.pow(speedPct / 100, 1.15);

    return {
      dispatch: {
        compressor_id: comp.id,
        type: comp.type,
        state: "modulating",
        capacity_w: cap,
        power_w: pwr,
        speed_pct: Math.round(speedPct),
      },
      delivered: cap,
      remaining: remaining - cap,
    };
  }

  const pwr = comp.power_w * Math.pow(minPct / 100, 1.15);
  warnings.push(
    allowCycling
      ? `Circuit ${circuitId}: inverter ${comp.id} cycling — load below minimum capacity.`
      : `Circuit ${circuitId}: inverter ${comp.id} oversupply — load below minimum, cycling disabled.`,
  );

  return {
    dispatch: {
      compressor_id: comp.id,
      type: comp.type,
      state: "modulating",
      capacity_w: minCap,
      power_w: pwr,
      speed_pct: minPct,
    },
    delivered: minCap,
    remaining: remaining - minCap,
  };
}

function dispatchCircuit(
  circuit: RefrigerationCircuit,
  required: number,
  tolerancePct: number,
  preferInverterTrim: boolean,
  allowCycling: boolean,
): CircuitControlResult {
  const circuitWarnings: string[] = [];
  const dispatch: CompressorDispatchResult[] = [];
  const available = circuit.compressors.filter((compressor) => compressor.available !== false);
  const unavailable = circuit.compressors.filter((compressor) => compressor.available === false);

  for (const comp of unavailable) {
    dispatch.push({
      compressor_id: comp.id,
      type: comp.type,
      state: "unavailable",
      capacity_w: 0,
      power_w: 0,
    });
  }

  if (available.length === 0) {
    circuitWarnings.push(`Circuit ${circuit.id}: no available compressors.`);
    return {
      circuit_id: circuit.id,
      required_capacity_w: required,
      delivered_capacity_w: 0,
      capacity_error_pct: required > 0 ? 100 : 0,
      compressor_dispatch: dispatch,
      status: "error",
      warnings: circuitWarnings,
    };
  }

  let remaining = required;
  let delivered = 0;

  for (const comp of sortCompressors(available, preferInverterTrim)) {
    if (remaining <= 0) {
      dispatch.push({
        compressor_id: comp.id,
        type: comp.type,
        state: "off",
        capacity_w: 0,
        power_w: 0,
      });
      continue;
    }

    const result =
      comp.type === "fixed"
        ? dispatchFixed(comp, remaining)
        : comp.type === "staged"
          ? dispatchStaged(comp, remaining)
          : dispatchInverter(circuit.id, comp, remaining, allowCycling, circuitWarnings);

    dispatch.push(result.dispatch);
    delivered += result.delivered;
    remaining = result.remaining;
  }

  const errorPct =
    required > 0
      ? Math.abs(safeDivide(delivered - required, required) * 100)
      : delivered > 0
        ? 100
        : 0;
  const isCycling = circuitWarnings.some((warning) => warning.includes("cycling"));
  const isUnreachable = remaining > 0 && delivered < required * (1 - tolerancePct / 100);
  let status: CircuitControlResult["status"] = "stable";

  if (isUnreachable) {
    status = "unreachable";
    circuitWarnings.push(
      `Circuit ${circuit.id}: load unreachable. Delivered ${delivered.toFixed(0)} W, required ${required.toFixed(0)} W.`,
    );
  } else if (isCycling) {
    status = "cycling";
  } else if (errorPct > tolerancePct) {
    status = "cycling";
    circuitWarnings.push(
      `Circuit ${circuit.id}: capacity error ${errorPct.toFixed(1)}% exceeds tolerance ${tolerancePct}%.`,
    );
  }

  return {
    circuit_id: circuit.id,
    required_capacity_w: required,
    delivered_capacity_w: delivered,
    capacity_error_pct: errorPct,
    compressor_dispatch: dispatch,
    status,
    warnings: Array.from(new Set(circuitWarnings)),
  };
}

function calculateCondenserLoads(
  input: MultiCircuitControlInput,
  circuitResults: CircuitControlResult[],
): {
  loads: Record<string, number>;
  warnings: string[];
} {
  const loads: Record<string, number> = {};
  const warnings: string[] = [];
  const condenserMap = new Map(
    input.architecture.condensers.map((condenser) => [condenser.id, condenser]),
  );

  for (const condenser of input.architecture.condensers) {
    loads[condenser.id] = 0;
  }

  for (let i = 0; i < circuitResults.length; i += 1) {
    const result = circuitResults[i];
    const circuit = input.architecture.circuits[i];
    const totalPower = result.compressor_dispatch.reduce(
      (sum, dispatch) => sum + dispatch.power_w,
      0,
    );
    const qCond = result.delivered_capacity_w + totalPower;
    loads[circuit.condenser_id] = (loads[circuit.condenser_id] ?? 0) + qCond;
  }

  for (const [condenserId, load] of Object.entries(loads)) {
    const condenser = condenserMap.get(condenserId);
    if (condenser && load > condenser.heat_rejection_capacity_w) {
      warnings.push(
        `Condenser ${condenserId}: overloaded. Load ${load.toFixed(0)} W exceeds capacity ${condenser.heat_rejection_capacity_w} W.`,
      );
    }
  }

  return { loads, warnings };
}

export function solveMultiCircuitVariableControl(
  input: MultiCircuitControlInput,
): MultiCircuitControlResult {
  const architecture = evaluateSystemArchitecture(input.architecture);
  if (architecture.status === "error") return buildErrorResult(architecture.warnings);

  const loadWarnings = validateLoads(input);
  if (loadWarnings.length > 0) return buildErrorResult(loadWarnings);

  const tolerancePct = input.options?.tolerance_pct ?? 5;
  const preferInverterTrim = input.options?.prefer_inverter_trim ?? true;
  const allowCycling = input.options?.allow_cycling ?? true;
  const loadMap = new Map(input.loads.map((load) => [load.circuit_id, load.required_capacity_w]));
  const circuitResults = input.architecture.circuits.map((circuit) =>
    dispatchCircuit(
      circuit,
      loadMap.get(circuit.id) ?? 0,
      tolerancePct,
      preferInverterTrim,
      allowCycling,
    ),
  );
  const condenser = calculateCondenserLoads(input, circuitResults);
  const totalRequired = circuitResults.reduce(
    (sum, circuit) => sum + circuit.required_capacity_w,
    0,
  );
  const totalDelivered = circuitResults.reduce(
    (sum, circuit) => sum + circuit.delivered_capacity_w,
    0,
  );
  const totalPower = circuitResults.reduce(
    (sum, circuit) =>
      sum +
      circuit.compressor_dispatch.reduce(
        (dispatchSum, dispatch) => dispatchSum + dispatch.power_w,
        0,
      ),
    0,
  );
  const totalErrorPct =
    totalRequired > 0
      ? Math.abs(safeDivide(totalDelivered - totalRequired, totalRequired) * 100)
      : 0;
  const estimatedCop = safeDivide(totalDelivered, totalPower);
  const hasError = circuitResults.some((circuit) => circuit.status === "error");
  const hasUnreachable = circuitResults.some((circuit) => circuit.status === "unreachable");
  const hasWarning =
    circuitResults.some((circuit) => circuit.status === "cycling") || condenser.warnings.length > 0;
  const status: MultiCircuitControlResult["status"] = hasError
    ? "error"
    : hasUnreachable
      ? "unreachable"
      : hasWarning
        ? "warning"
        : "stable";

  return {
    status,
    circuits: circuitResults,
    total_required_capacity_w: totalRequired,
    total_delivered_capacity_w: totalDelivered,
    total_capacity_error_pct: totalErrorPct,
    estimated_total_power_w: totalPower,
    estimated_cop: estimatedCop,
    condenser_loads: condenser.loads,
    condenser_warnings: Array.from(new Set(condenser.warnings)),
    warnings: Array.from(
      new Set([...condenser.warnings, ...circuitResults.flatMap((circuit) => circuit.warnings)]),
    ),
  };
}
