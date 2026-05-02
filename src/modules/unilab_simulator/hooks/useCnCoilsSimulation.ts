// Hook de orquestração da simulação. Lê o store, busca a condutividade do
// material do tubo no catálogo e chama runSimulation. Sem mocks.

import { useCallback } from "react";
import { SimulationError } from "../engine/simulatorCore";
import { runSimulationV2Async } from "../engine_v2/simulatorCoreV2";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  AirVelocityCorrectionItem,
  PressureDropFanItem,
  TubeMaterialItem,
  CoilGeometryCatalogItem,
} from "../types/unilab.types";

export interface UseCnCoilsSimulationParams {
  geometries: CoilGeometryCatalogItem[];
  tubeMaterials: TubeMaterialItem[];
  correctionCoefficients: AirVelocityCorrectionItem[];
  pressureDropFan: PressureDropFanItem[];
}

function readNumber(raw: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!raw) return undefined;
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function readString(raw: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!raw) return undefined;
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function useCnCoilsSimulation(catalogs: UseCnCoilsSimulationParams) {
  const setResult = useUnilabSimulationStore((s) => s.setResult);
  const setWarnings = useUnilabSimulationStore((s) => s.setWarnings);
  const setIsSimulating = useUnilabSimulationStore((s) => s.setIsSimulating);
  const clearResult = useUnilabSimulationStore((s) => s.clearResult);

  const run = useCallback(async () => {
    const { physicalInputs, thermoInputs } = useUnilabSimulationStore.getState();

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
      const result = await runSimulationV2Async({
        physical,
        thermo,
        catalogs: {
          correctionCoefficients: catalogs.correctionCoefficients,
          pressureDropFan: catalogs.pressureDropFan,
        },
        tubeMaterialConductivity: tubeMat.conductivityWmK,
        uBaseWm2K: geometry?.uBaseWm2K,
        unilabCorrectionInput: {
          idTipologia: readNumber(geometry?.raw, "unilab_id", "IdTipologia", "id"),
          serie: readString(geometry?.raw, "Serie", "serie", "code", "description"),
        },
      });

      setResult(result);
      setWarnings(result.warnings);
      return { success: true as const, result };
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

  return { run, clearResult };
}
