import { useMemo } from "react";
import { calculateFrostAnalysis } from "../engines/frost/frostCycleService";
import type {
  FrostAnalysisConfig,
  FrostAnalysisResult,
} from "../engines/frost/frostTypes";
import type { CycleResult } from "../engines/cycle/cycleTypes";

interface UseFrostAnalysisOptions {
  cycleResult: CycleResult | null;
  refrigerantId?: string;
  airInletTempC: number;
  airRelativeHumidity: number;
  airMassFlowKgS: number;
  evaporatorExternalAreaM2: number;
  config?: Partial<FrostAnalysisConfig>;
}

const DEFAULT_CONFIG: FrostAnalysisConfig = {
  operationTimeH: 6,
  defrostMethod: "electric",
  defrostThresholdMm: 3,
  maxDefrostTimeMin: 30,
  frostDensityKgM3: 250,
};

export function useFrostAnalysis({
  cycleResult,
  refrigerantId = "R404A",
  airInletTempC,
  airRelativeHumidity,
  airMassFlowKgS,
  evaporatorExternalAreaM2,
  config = {},
}: UseFrostAnalysisOptions): FrostAnalysisResult | null {
  return useMemo(() => {
    if (!cycleResult || !cycleResult.converged) return null;
    if (evaporatorExternalAreaM2 <= 0) return null;

    const mergedConfig: FrostAnalysisConfig = { ...DEFAULT_CONFIG, ...config };

    try {
      return calculateFrostAnalysis({
        airInletTempC,
        airRelativeHumidity,
        airMassFlowKgS,
        evaporatingTempC: cycleResult.Te_C,
        evaporatorExternalAreaM2,
        evaporatorCapacityW: cycleResult.Q_evap_W,
        condensingTempC: cycleResult.Tc_C,
        refrigerantId,
        config: mergedConfig,
      });
    } catch {
      return null;
    }
  }, [
    cycleResult,
    refrigerantId,
    airInletTempC,
    airRelativeHumidity,
    airMassFlowKgS,
    evaporatorExternalAreaM2,
    config,
  ]);
}
