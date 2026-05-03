/**
 * Tipos para o Frost Model integrado ao CycleEngine CN Coils.
 */

import type {
  DefrostCycleResult,
  FrostFormationResult,
} from "../../../coldpro_v2/domain/types";

export type DefrostMethod =
  | "hot_gas_reversal"
  | "hot_gas_bypass"
  | "electric"
  | "natural";

export interface FrostAnalysisConfig {
  operationTimeH: number;
  defrostMethod: DefrostMethod;
  defrostThresholdMm: number;
  maxDefrostTimeMin: number;
  frostDensityKgM3: number;
}

export interface FrostAnalysisInput {
  airInletTempC: number;
  airRelativeHumidity: number;
  airMassFlowKgS: number;
  evaporatingTempC: number;
  evaporatorExternalAreaM2: number;
  evaporatorCapacityW: number;
  condensingTempC: number;
  refrigerantId: string;
  config: FrostAnalysisConfig;
}

export interface FrostTimePoint {
  timeH: number;
  frostThicknessMm: number;
  capacityLossPct: number;
  effectiveCapacityW: number;
  airflowReductionFactor: number;
  mode: FrostFormationResult["mode"];
}

export interface FrostAnalysisResult {
  frostAtEndOfCycle: FrostFormationResult;
  defrostResult: DefrostCycleResult;
  degradationCurve: FrostTimePoint[];
  estimatedTimeToDefrostH: number | null;
  effectiveCapacityAtEndW: number;
  capacityLossAtEndPct: number;
  coilSurfaceTempC: number;
  recommendedDefrost: boolean;
  warnings: string[];
}
