// Hook de orquestração da simulação. Lê o store, busca a condutividade do
// material do tubo no catálogo e chama runSimulation. Sem mocks.

import { useCallback } from "react";
import { runSimulation, SimulationError } from "../engine/simulatorCoreAdapter";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import type {
  AirVelocityCorrectionItem,
  PressureDropFanItem,
  TubeMaterialItem,
  CoilGeometryCatalogItem,
} from "../types/cncoils.types";
import type { StructuredWarning } from "../types/warnings";

export type { StructuredWarning as SimulationWarning } from "../types/warnings";

export interface UseCnCoilsSimulationParams {
  geometries: CoilGeometryCatalogItem[];
  tubeMaterials: TubeMaterialItem[];
  correctionCoefficients: AirVelocityCorrectionItem[];
  pressureDropFan: PressureDropFanItem[];
}

export function useCnCoilsSimulation(catalogs: UseCnCoilsSimulationParams) {
  const setResult = useCnCoilsSimulationStore((s) => s.setResult);
  const setWarnings = useCnCoilsSimulationStore((s) => s.setWarnings);
  const setIsSimulating = useCnCoilsSimulationStore((s) => s.setIsSimulating);
  const clearResult = useCnCoilsSimulationStore((s) => s.clearResult);

  const run = useCallback(() => {
    const { physicalInputs, thermoInputs } =
      useCnCoilsSimulationStore.getState();

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
      const geoRaw = geometry?.raw as Record<string, unknown> | undefined;
      const finCorr = Number(geoRaw?.FatCorAl ?? geoRaw?.fin_correction_factor);
      const airFr = Number(geoRaw?.FattoreAttrAria ?? geoRaw?.air_friction_factor);

      const rawResult = runSimulation({
        physical,
        thermo,
        catalogs: {
          correctionCoefficients: catalogs.correctionCoefficients,
          pressureDropFan: catalogs.pressureDropFan,
        },
        tubeMaterialConductivity: tubeMat.conductivityWmK,
        finCorrectionFactor: Number.isFinite(finCorr) && finCorr > 0 ? finCorr : 1.0,
        airFrictionFactor: Number.isFinite(airFr) && airFr > 0 ? airFr : 1.0,
      });

      const result = rawResult;

      const warnings: StructuredWarning[] = [];

      const engineWarnings: StructuredWarning[] = result.warnings.map((msg) => ({
        code: "GENERAL_WARNING", message: msg, severity: "warning" as const,
      }));
      const allWarnings = [...engineWarnings, ...warnings];

      setResult(result);
      setWarnings(allWarnings);
      return { success: true as const, result, warnings: allWarnings };
    } catch (err) {
      const errors =
        err instanceof SimulationError ? err.errors : [String(err)];
      setResult(undefined);
      setWarnings(errors.map((msg) => ({ code: "CALC_ERROR", message: msg, severity: "error" as const })));
      return { success: false as const, errors };
    } finally {
      setIsSimulating(false);
    }
  }, [catalogs, setIsSimulating, setResult, setWarnings]);

  return { run, clearResult } as {
    run: () => { success: true; result: ReturnType<typeof runSimulation>; warnings: StructuredWarning[] } | { success: false; errors: string[] };
    clearResult: () => void;
  };
}
