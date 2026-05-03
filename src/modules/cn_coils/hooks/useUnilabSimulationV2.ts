// Hook que executa o motor V2 (Etapa 6) sem alterar o V1.
// Lê do store, busca catálogo de coeficientes UNILAB, chama runSimulationV2.

import { useCallback } from "react";
import {
  runSimulationV2,
  SimulationV2Error,
  UnilabCoefficientsMissingError,
} from "../engine_v2/simulatorCoreV2";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  TubeMaterialItem,
  UnilabComponentType,
} from "../types/unilab.types";
import type { UnilabHeatTransferCatalog } from "../engine_v2/heatTransfer";

export interface UseUnilabSimulationV2Params {
  tubeMaterials: TubeMaterialItem[];
  htCatalog: UnilabHeatTransferCatalog;
  componentType: UnilabComponentType;
}

// Propriedades default para R404A líquido a -10 °C (placeholder até integrarmos
// o catálogo termodinâmico de refrigerantes — Etapa 7). Valores literatura
// (NIST REFPROP, R404A saturado).
const DEFAULT_FLUID_PROPS = {
  rho_kg_m3: 1180,
  mu_Pa_s: 2.0e-4,
  cp_J_kgK: 1450,
  k_W_mK: 0.078,
};

export function useUnilabSimulationV2(params: UseUnilabSimulationV2Params) {
  const setResult = useUnilabSimulationStore((s) => s.setResult);
  const setWarnings = useUnilabSimulationStore((s) => s.setWarnings);
  const setIsSimulating = useUnilabSimulationStore((s) => s.setIsSimulating);

  const run = useCallback(() => {
    const state = useUnilabSimulationStore.getState();
    const { physicalInputs, thermoInputs } = state;
    setIsSimulating(true);
    try {
      const physical = physicalInputs as Required<typeof physicalInputs>;
      const thermo = thermoInputs as Required<typeof thermoInputs>;

      const tubeMat = params.tubeMaterials.find(
        (m) => m.id === physical.tubeMaterialId,
      );
      if (!tubeMat) {
        throw new SimulationV2Error("Material do tubo ausente.", [
          `Material ${physical.tubeMaterialId} não encontrado.`,
        ]);
      }

      const fluidMassFlowKgS = (state.fluidMassFlow_kg_h || 0) / 3600;

      const rawResult = runSimulationV2({
        physical,
        thermo,
        componentType: params.componentType,
        htCatalog: params.htCatalog,
        tubeMaterialConductivity: tubeMat.conductivityWmK,
        fluidProps: DEFAULT_FLUID_PROPS,
        fluidMassFlowKgS,
        foulingExternal: state.foulingFactorAir,
        foulingInternal: state.foulingFactorFluid,
        superheatK: state.superheat_K,
        subcoolingK: state.subcooling_K,
      });
      const k =
        1 +
        (Number.isFinite(state.errorFactorPercent) ? state.errorFactorPercent : 0) /
          100;
      const result = {
        ...rawResult,
        totalCapacityKw: rawResult.totalCapacityKw * k,
        sensibleCapacityKw: rawResult.sensibleCapacityKw * k,
        latentCapacityKw: rawResult.latentCapacityKw * k,
      };
      setResult(result);
      setWarnings(result.warnings);
      return { success: true as const, result };
    } catch (err) {
      const errors =
        err instanceof UnilabCoefficientsMissingError
          ? [err.message]
          : err instanceof SimulationV2Error
            ? err.errors
            : [String(err)];
      setResult(undefined);
      setWarnings(errors);
      return { success: false as const, errors };
    } finally {
      setIsSimulating(false);
    }
  }, [params, setIsSimulating, setResult, setWarnings]);

  return { run };
}
