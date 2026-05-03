import { runCoilForCycle } from "../coil/coilCycleAdapter";
import { computeObjectiveValue, estimateCoilMaterials } from "./coilCostEstimator";
import type { CoilCycleInputs } from "../coil/coilCycleAdapter";
import type {
  OptimizationCandidate,
  OptimizationConfig,
  OptimizationResult,
  OptimizationSearchSpace,
} from "./optimizationTypes";

function generateSearchSpace(
  baseInputs: CoilCycleInputs,
  space: OptimizationSearchSpace,
): Array<{ rows: number; circuits: number; finPitchMm: number }> {
  const rowsOptions = space.rowsOptions ?? [2, 3, 4, 5, 6];
  const finPitchOptions = space.finPitchOptions ?? [4, 5, 6, 7, 8];
  const tubesPerRow = Math.max(1, baseInputs.physical.tubesPerRow);
  const combinations: Array<{ rows: number; circuits: number; finPitchMm: number }> = [];

  for (const rows of rowsOptions) {
    const circuitsOptions =
      space.circuitsOptions ??
      Array.from({ length: tubesPerRow }, (_, i) => i + 1).filter(
        (circuits) => tubesPerRow % circuits === 0,
      );
    for (const circuits of circuitsOptions) {
      for (const finPitchMm of finPitchOptions) {
        combinations.push({ rows, circuits, finPitchMm });
      }
    }
  }

  const maxEval = space.maxEvaluations ?? 500;
  if (combinations.length > maxEval) {
    const step = Math.ceil(combinations.length / maxEval);
    return combinations.filter((_, i) => i % step === 0);
  }
  return combinations;
}

function checkConstraints(
  candidate: Omit<OptimizationCandidate, "objectiveValue" | "feasible" | "violations">,
  config: OptimizationConfig,
): { feasible: boolean; violations: string[] } {
  const constraints = config.constraints;
  const violations: string[] = [];
  if (candidate.totalCapacityW < constraints.minCapacityW) {
    violations.push(
      `Capacidade ${(candidate.totalCapacityW / 1000).toFixed(1)} kW < mínimo ${(constraints.minCapacityW / 1000).toFixed(1)} kW`,
    );
  }
  if (constraints.maxCapacityW && candidate.totalCapacityW > constraints.maxCapacityW) {
    violations.push(
      `Capacidade ${(candidate.totalCapacityW / 1000).toFixed(1)} kW > máximo ${(constraints.maxCapacityW / 1000).toFixed(1)} kW`,
    );
  }
  if (
    constraints.maxAirPressureDropPa &&
    candidate.airPressureDropPa > constraints.maxAirPressureDropPa
  ) {
    violations.push(
      `ΔP ar ${candidate.airPressureDropPa.toFixed(0)} Pa > máximo ${constraints.maxAirPressureDropPa} Pa`,
    );
  }
  if (constraints.minCircuits && candidate.circuits < constraints.minCircuits) {
    violations.push(`Circuitos ${candidate.circuits} < mínimo ${constraints.minCircuits}`);
  }
  if (constraints.maxCircuits && candidate.circuits > constraints.maxCircuits) {
    violations.push(`Circuitos ${candidate.circuits} > máximo ${constraints.maxCircuits}`);
  }
  if (constraints.minRows && candidate.rows < constraints.minRows) {
    violations.push(`Fileiras ${candidate.rows} < mínimo ${constraints.minRows}`);
  }
  if (constraints.maxRows && candidate.rows > constraints.maxRows) {
    violations.push(`Fileiras ${candidate.rows} > máximo ${constraints.maxRows}`);
  }
  return { feasible: violations.length === 0, violations };
}

export async function runOptimization(
  baseInputs: CoilCycleInputs,
  config: OptimizationConfig,
): Promise<OptimizationResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const allCandidates: OptimizationCandidate[] = [];
  const combinations = generateSearchSpace(baseInputs, config.searchSpace ?? {});

  if (combinations.length === 0) {
    return {
      best: null,
      topCandidates: [],
      allCandidates: [],
      evaluationsCount: 0,
      feasibleCount: 0,
      computeTimeMs: 0,
      warnings: ["Espaço de busca vazio. Verifique os parâmetros de otimização."],
      converged: false,
    };
  }

  let evaluationsCount = 0;
  let bestFeasible: OptimizationCandidate | null = null;
  let maxWeight = 50;
  let maxDp = 500;
  let maxCapacity = config.constraints.minCapacityW * 2;

  for (const combo of combinations) {
    evaluationsCount++;
    const inputs: CoilCycleInputs = {
      ...baseInputs,
      physical: {
        ...baseInputs.physical,
        rows: combo.rows,
        circuits: combo.circuits,
        finPitchMm: combo.finPitchMm,
      },
    };

    let result: Awaited<ReturnType<typeof runCoilForCycle>>;
    try {
      result = await runCoilForCycle(inputs);
    } catch {
      continue;
    }
    if (!result.success || result.totalCapacityW <= 0) continue;

    const materials = estimateCoilMaterials({
      ...baseInputs.physical,
      rows: combo.rows,
      finPitchMm: combo.finPitchMm,
    });

    maxWeight = Math.max(maxWeight, materials.totalWeightKg);
    maxDp = Math.max(maxDp, result.airPressureDropPa ?? 0);
    maxCapacity = Math.max(maxCapacity, result.totalCapacityW);

    const candidateBase = {
      rows: combo.rows,
      circuits: combo.circuits,
      finPitchMm: combo.finPitchMm,
      totalCapacityW: result.totalCapacityW,
      airPressureDropPa: result.airPressureDropPa ?? 0,
      overallU_WM2K: result.overallU_WM2K ?? 0,
      estimatedWeightKg: materials.totalWeightKg,
      estimatedCopperKg: materials.copperKg,
      estimatedAluminumKg: materials.aluminumKg,
    };
    const { feasible, violations } = checkConstraints(candidateBase, config);
    const objectiveValue = computeObjectiveValue(candidateBase, config.objective, {
      maxWeight,
      maxDp,
      maxCapacity,
    });
    const candidate: OptimizationCandidate = {
      ...candidateBase,
      objectiveValue,
      feasible,
      violations,
    };
    allCandidates.push(candidate);
    if (feasible && (!bestFeasible || objectiveValue < bestFeasible.objectiveValue)) {
      bestFeasible = candidate;
    }
    if (evaluationsCount % 10 === 0) {
      const progress = Math.round((evaluationsCount / combinations.length) * 100);
      config.onProgress?.(progress, bestFeasible);
    }
  }

  for (const candidate of allCandidates) {
    candidate.objectiveValue = computeObjectiveValue(candidate, config.objective, {
      maxWeight,
      maxDp,
      maxCapacity,
    });
  }

  const feasibleCandidates = allCandidates
    .filter((candidate) => candidate.feasible)
    .sort((a, b) => a.objectiveValue - b.objectiveValue);
  const topCandidates = feasibleCandidates.slice(0, 5);
  const best = topCandidates[0] ?? null;

  if (!best) {
    warnings.push(
      "Nenhuma solução factível encontrada. Considere relaxar as restrições (capacidade mínima, ΔP máximo) ou ampliar o espaço de busca.",
    );
  }
  if (evaluationsCount < 10) {
    warnings.push("Poucas combinações avaliadas. O espaço de busca pode estar muito restrito.");
  }

  return {
    best,
    topCandidates,
    allCandidates,
    evaluationsCount,
    feasibleCount: feasibleCandidates.length,
    computeTimeMs: Date.now() - startTime,
    warnings,
    converged: best !== null,
  };
}
