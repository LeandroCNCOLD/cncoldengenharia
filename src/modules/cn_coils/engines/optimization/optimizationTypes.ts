/**
 * Tipos para o módulo de Otimização Multi-objetivo do CN Coils.
 */

export type OptimizationObjective =
  | "minimize_cost"
  | "maximize_cop"
  | "minimize_dp_air"
  | "minimize_weight"
  | "maximize_capacity";

export interface OptimizationConstraints {
  minCapacityW: number;
  maxCapacityW?: number;
  maxAirPressureDropPa?: number;
  maxFaceVelocityMs?: number;
  minMassVelocityKgM2S?: number;
  maxMassVelocityKgM2S?: number;
  minCircuits?: number;
  maxCircuits?: number;
  minRows?: number;
  maxRows?: number;
}

export interface OptimizationSearchSpace {
  rowsOptions?: number[];
  finPitchOptions?: number[];
  circuitsOptions?: number[];
  maxEvaluations?: number;
}

export interface OptimizationConfig {
  objective: OptimizationObjective;
  constraints: OptimizationConstraints;
  searchSpace?: OptimizationSearchSpace;
  onProgress?: (progress: number, bestSoFar: OptimizationCandidate | null) => void;
}

export interface OptimizationCandidate {
  rows: number;
  circuits: number;
  finPitchMm: number;
  totalCapacityW: number;
  airPressureDropPa: number;
  overallU_WM2K: number;
  estimatedWeightKg: number;
  estimatedCopperKg: number;
  estimatedAluminumKg: number;
  objectiveValue: number;
  feasible: boolean;
  violations: string[];
}

export interface OptimizationResult {
  best: OptimizationCandidate | null;
  topCandidates: OptimizationCandidate[];
  allCandidates: OptimizationCandidate[];
  evaluationsCount: number;
  feasibleCount: number;
  computeTimeMs: number;
  warnings: string[];
  converged: boolean;
}
