// Hook de orquestração da simulação. Lê o store, busca a condutividade do
// material do tubo no catálogo e chama runSimulation. Sem mocks.

import { useCallback } from "react";
import { runSimulation, SimulationError } from "../engine/simulatorCore";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  AirVelocityCorrectionItem,
  PressureDropFanItem,
  TubeMaterialItem,
  CoilGeometryCatalogItem,
} from "../types/unilab.types";

export interface UseUnilabSimulationParams {
  geometries: CoilGeometryCatalogItem[];
  tubeMaterials: TubeMaterialItem[];
  correctionCoefficients: AirVelocityCorrectionItem[];
  pressureDropFan: PressureDropFanItem[];
}

export interface SimulationWarning {
  code: string;
  message: string | null;
  severity: "warning" | "error";
}

function resolveUBase(geometry: { uBaseWm2K?: number | null; coil_type?: string } | null | undefined) {
  const DEFAULT_U_BY_TYPE: Record<string, number> = {
    condensation: 40,
    direct_expansion: 35,
    flooded_evaporator: 40,
    cooling: 35,
    heating: 30,
    vapor: 50,
  };
  if (geometry?.uBaseWm2K && geometry.uBaseWm2K > 0) {
    return { uBaseWm2K: geometry.uBaseWm2K, isEstimated: false, warning: null };
  }
  const coilType = geometry?.coil_type ?? "cooling";
  const fallbackU = DEFAULT_U_BY_TYPE[coilType] ?? 35;
  return {
    uBaseWm2K: fallbackU,
    isEstimated: true,
    warning: `U_base não calibrado para esta geometria. Usando estimativa de ${fallbackU} W/m²K para "${coilType}". Resultado é ESTIMATIVA — não use para dimensionamento final.`,
  };
}

export function useUnilabSimulation(catalogs: UseUnilabSimulationParams) {
  const setResult = useUnilabSimulationStore((s) => s.setResult);
  const setWarnings = useUnilabSimulationStore((s) => s.setWarnings);
  const setIsSimulating = useUnilabSimulationStore((s) => s.setIsSimulating);
  const clearResult = useUnilabSimulationStore((s) => s.clearResult);

  const run = useCallback(() => {
    const { physicalInputs, thermoInputs, errorFactorPercent } =
      useUnilabSimulationStore.getState();

    setIsSimulating(true);
    try {
      const physical = physicalInputs as Required<typeof physicalInputs>;
      const thermo = thermoInputs as Required<typeof thermoInputs>;

      const tubeMat = catalogs.tubeMaterials.find(
        (m) => m.id === physical.tubeMaterialId,
      );
      if (!tubeMat) {
        throw new SimulationError("Material do tubo não encontrado no catálogo.", [
          `Material ${physical.tubeMaterialId} ausente em tubeMaterials.json.`,
        ]);
      }

      const geometry = catalogs.geometries.find((g) => g.id === physical.geometryId);
      const { uBaseWm2K, isEstimated: uBaseIsEstimated, warning: uBaseWarning } = resolveUBase(geometry);
      const rawResult = runSimulation({
        physical,
        thermo,
        catalogs: {
          correctionCoefficients: catalogs.correctionCoefficients,
          pressureDropFan: catalogs.pressureDropFan,
        },
        tubeMaterialConductivity: tubeMat.conductivityWmK,
        uBaseWm2K,
      });

      const k = 1 + (Number.isFinite(errorFactorPercent) ? errorFactorPercent : 0) / 100;
      const result = {
        ...rawResult,
        totalCapacityKw: rawResult.totalCapacityKw * k,
        sensibleCapacityKw: rawResult.sensibleCapacityKw * k,
        latentCapacityKw: rawResult.latentCapacityKw * k,
      };

      const warnings: SimulationWarning[] = [
        ...(uBaseIsEstimated ? [{ code: "U_BASE_ESTIMATED", message: uBaseWarning, severity: "warning" as const }] : []),
      ];

      setResult(result);
      setWarnings(result.warnings);
      return { success: true as const, result, warnings };
    } catch (err) {
      const errors =
        err instanceof SimulationError ? err.errors : [String(err)];
      setResult(undefined);
      setWarnings(errors);
      return { success: false as const, errors };
    } finally {
      setIsSimulating(false);
    }
  }, [catalogs, setIsSimulating, setResult, setWarnings]);

  return { run, clearResult } as {
    run: () => { success: true; result: ReturnType<typeof runSimulation>; warnings: SimulationWarning[] } | { success: false; errors: string[] };
    clearResult: () => void;
  };
}
