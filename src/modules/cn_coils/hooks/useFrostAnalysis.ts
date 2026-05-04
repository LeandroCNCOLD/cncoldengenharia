import { useMemo } from "react";
import { calculateFrostAnalysis } from "../engines/frost/frostCycleService";
import type {
  FrostAnalysisConfig,
  FrostAnalysisResult,
} from "../engines/frost/frostTypes";
import type { CycleResult } from "../engines/cycle/cycleTypes";

export interface FrostAnalysisWithEnvelopeFields extends FrostAnalysisResult {
  frostPoint_C: number;
  massRate_kgh: number;
  degradationCurve: FrostAnalysisResult["degradationCurve"] & Array<{
    t_h: number;
    Q_kcalh: number;
    thickness_mm: number;
  }>;
  recommendedDefrostInterval_h: number;
  residualCapacityPct: number;
}

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
}: UseFrostAnalysisOptions): FrostAnalysisWithEnvelopeFields | null {
  return useMemo(() => {
    if (!cycleResult || !cycleResult.converged) return null;
    if (evaporatorExternalAreaM2 <= 0) return null;

    const mergedConfig: FrostAnalysisConfig = { ...DEFAULT_CONFIG, ...config };

    try {
      const result = calculateFrostAnalysis({
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
      const rhPct = airRelativeHumidity <= 1 ? airRelativeHumidity * 100 : airRelativeHumidity;
      const frostPoint_C = airInletTempC - (100 - rhPct) / 5 - 2;
      const massRate_kgh =
        mergedConfig.operationTimeH > 0
          ? result.frostAtEndOfCycle.frost_mass_kg / mergedConfig.operationTimeH
          : 0;
      const degradationCurve = result.degradationCurve.map((point) =>
        Object.assign(point, {
          t_h: point.timeH,
          Q_kcalh: point.effectiveCapacityW * 0.86,
          thickness_mm: point.frostThicknessMm,
        }),
      ) as FrostAnalysisWithEnvelopeFields["degradationCurve"];
      return {
        ...result,
        frostPoint_C,
        massRate_kgh,
        degradationCurve,
        recommendedDefrostInterval_h:
          result.estimatedTimeToDefrostH ?? mergedConfig.operationTimeH,
        residualCapacityPct:
          cycleResult.Q_evap_W > 0
            ? (result.effectiveCapacityAtEndW / cycleResult.Q_evap_W) * 100
            : 100,
      };
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
