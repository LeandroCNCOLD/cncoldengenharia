import type {
  CircuitSummary,
  CondenserUnit,
  RefrigerationCircuit,
  SystemArchitectureInput,
  SystemArchitectureResult,
} from "../../domain/types";
import { calculateProgressiveCoil } from "../progressive/progressiveCoilSolver";

function safeDivide(num: number, den: number, fallback = 0): number {
  if (den === 0 || !Number.isFinite(den)) return fallback;
  return num / den;
}

function buildErrorResult(warnings: string[]): SystemArchitectureResult {
  return {
    status: "error",
    total_installed_capacity_w: 0,
    total_available_capacity_w: 0,
    circuits: [],
    shared_condenser_loads: {},
    warnings,
  };
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function buildCondenserMap(condensers: CondenserUnit[]): Map<string, CondenserUnit> {
  return new Map(condensers.map((condenser) => [condenser.id, condenser]));
}

function validateInput(input: SystemArchitectureInput): string[] {
  const warnings: string[] = [];
  const condenserMap = buildCondenserMap(input.condensers ?? []);

  if (!Array.isArray(input.circuits) || input.circuits.length === 0) {
    warnings.push("evaluateSystemArchitecture: circuits array cannot be empty.");
  }
  if (!Array.isArray(input.condensers) || input.condensers.length === 0) {
    warnings.push("evaluateSystemArchitecture: condensers array cannot be empty.");
  }

  for (const circuit of input.circuits ?? []) {
    if (isBlank(circuit.id)) {
      warnings.push("evaluateSystemArchitecture: circuit id is required.");
    }
    if (!Array.isArray(circuit.compressors) || circuit.compressors.length === 0) {
      warnings.push(`Circuit ${circuit.id}: compressors array cannot be empty.`);
    }
    if (!Array.isArray(circuit.evaporators) || circuit.evaporators.length === 0) {
      warnings.push(`Circuit ${circuit.id}: evaporators array cannot be empty.`);
    }
    if (isBlank(circuit.condenser_id) || !condenserMap.has(circuit.condenser_id)) {
      warnings.push(`Circuit ${circuit.id}: condenser_id "${circuit.condenser_id}" not found.`);
    }
  }

  return warnings;
}

function evaluateEvaporatorCapacity(circuit: RefrigerationCircuit): {
  capacity: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  let capacity = 0;

  for (const evaporator of circuit.evaporators) {
    try {
      const result = calculateProgressiveCoil(evaporator.progressive_input);
      if (result.status === "error") {
        warnings.push(
          `Circuit ${circuit.id}, evaporator ${evaporator.id}: calculateProgressiveCoil returned error.`,
        );
      } else {
        capacity += result.total_capacity_w ?? 0;
      }
    } catch {
      warnings.push(
        `Circuit ${circuit.id}, evaporator ${evaporator.id}: calculateProgressiveCoil threw an exception.`,
      );
    }
  }

  return { capacity, warnings };
}

function evaluateCircuit(
  circuit: RefrigerationCircuit,
  condenserLoads: Record<string, number>,
): CircuitSummary {
  const circuitWarnings: string[] = [];
  const allCompressors = circuit.compressors;
  const availableCompressors = allCompressors.filter(
    (compressor) => compressor.available !== false,
  );
  const totalCompressorCapacity = allCompressors.reduce(
    (sum, compressor) => sum + compressor.nominal_capacity_w,
    0,
  );
  const availableCompressorCapacity = availableCompressors.reduce(
    (sum, compressor) => sum + compressor.nominal_capacity_w,
    0,
  );

  if (availableCompressors.length === 0) {
    circuitWarnings.push(`Circuit ${circuit.id}: no available compressors.`);
  }

  const evaporator = evaluateEvaporatorCapacity(circuit);
  circuitWarnings.push(...evaporator.warnings);

  const circuitCapacity = Math.min(availableCompressorCapacity, evaporator.capacity);

  if (evaporator.capacity > 0 && totalCompressorCapacity > 0) {
    const mismatchPct = Math.abs(
      safeDivide(evaporator.capacity - totalCompressorCapacity, totalCompressorCapacity) * 100,
    );
    if (mismatchPct > 20) {
      circuitWarnings.push(
        `Circuit ${circuit.id}: evaporator/compressor capacity mismatch of ${mismatchPct.toFixed(1)}% (>20%).`,
      );
    }
  }

  const compressorPower = availableCompressors.reduce(
    (sum, compressor) => sum + compressor.power_w,
    0,
  );
  const qCond = evaporator.capacity + compressorPower;
  condenserLoads[circuit.condenser_id] = (condenserLoads[circuit.condenser_id] ?? 0) + qCond;

  let status: CircuitSummary["status"] = "ok";
  if (availableCompressors.length === 0 || evaporator.capacity === 0) {
    status = "error";
  } else if (circuitWarnings.length > 0) {
    status = "warning";
  }

  return {
    id: circuit.id,
    total_compressor_capacity_w: totalCompressorCapacity,
    available_compressor_capacity_w: availableCompressorCapacity,
    total_evaporator_capacity_w: evaporator.capacity,
    circuit_capacity_w: circuitCapacity,
    compressor_count: allCompressors.length,
    available_compressor_count: availableCompressors.length,
    evaporator_count: circuit.evaporators.length,
    status,
    warnings: Array.from(new Set(circuitWarnings)),
  };
}

function validateCondenserLoads(
  condenserLoads: Record<string, number>,
  condenserMap: Map<string, CondenserUnit>,
): string[] {
  const warnings: string[] = [];

  for (const [condenserId, load] of Object.entries(condenserLoads)) {
    const condenser = condenserMap.get(condenserId);
    if (condenser && load > condenser.heat_rejection_capacity_w) {
      warnings.push(
        `Condenser ${condenserId}: overloaded. Load ${load.toFixed(0)} W exceeds capacity ${condenser.heat_rejection_capacity_w} W.`,
      );
    }
  }

  return warnings;
}

function validateNPlusOne(
  input: SystemArchitectureInput,
  circuitSummaries: CircuitSummary[],
): string[] {
  if (input.options?.redundancy_mode !== "N+1") return [];

  const warnings: string[] = [];
  for (const circuit of input.circuits) {
    const available = circuit.compressors.filter((compressor) => compressor.available !== false);
    if (available.length < 2) {
      warnings.push(
        `Circuit ${circuit.id}: N+1 redundancy requires at least 2 available compressors. Found ${available.length}.`,
      );
      continue;
    }

    const sorted = [...available].sort((a, b) => b.nominal_capacity_w - a.nominal_capacity_w);
    const remainingCapacity = sorted
      .slice(1)
      .reduce((sum, compressor) => sum + compressor.nominal_capacity_w, 0);
    const required =
      circuitSummaries.find((summary) => summary.id === circuit.id)?.total_evaporator_capacity_w ??
      0;

    if (remainingCapacity < required * 0.8) {
      warnings.push(
        `Circuit ${circuit.id}: N+1 redundancy insufficient. Without largest compressor, available capacity ${remainingCapacity.toFixed(0)} W is less than 80% of evaporator demand ${required.toFixed(0)} W.`,
      );
    }
  }

  return warnings;
}

export function evaluateSystemArchitecture(
  input: SystemArchitectureInput,
): SystemArchitectureResult {
  const validationWarnings = validateInput(input);
  if (validationWarnings.length > 0) return buildErrorResult(validationWarnings);

  const condenserMap = buildCondenserMap(input.condensers);
  const condenserLoads = Object.fromEntries(
    input.condensers.map((condenser) => [condenser.id, 0]),
  ) as Record<string, number>;
  const circuitSummaries = input.circuits.map((circuit) =>
    evaluateCircuit(circuit, condenserLoads),
  );
  const globalWarnings = [
    ...validateCondenserLoads(condenserLoads, condenserMap),
    ...validateNPlusOne(input, circuitSummaries),
  ];
  const totalInstalledCapacity = circuitSummaries.reduce(
    (sum, circuit) => sum + circuit.total_compressor_capacity_w,
    0,
  );
  const totalAvailableCapacity = circuitSummaries.reduce(
    (sum, circuit) => sum + circuit.circuit_capacity_w,
    0,
  );
  const hasError = circuitSummaries.some((circuit) => circuit.status === "error");
  const hasWarning =
    circuitSummaries.some((circuit) => circuit.status === "warning") || globalWarnings.length > 0;

  return {
    status: hasError ? "error" : hasWarning ? "warning" : "ok",
    total_installed_capacity_w: totalInstalledCapacity,
    total_available_capacity_w: totalAvailableCapacity,
    circuits: circuitSummaries,
    shared_condenser_loads: condenserLoads,
    warnings: Array.from(
      new Set([...globalWarnings, ...circuitSummaries.flatMap((circuit) => circuit.warnings)]),
    ),
  };
}
