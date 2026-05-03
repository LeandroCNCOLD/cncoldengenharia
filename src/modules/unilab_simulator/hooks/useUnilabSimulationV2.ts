// Hook que executa o motor V2 (Etapa 6) sem alterar o V1.
// Lê do store, busca catálogo de coeficientes UNILAB, chama runSimulationV2.

import { useCallback } from "react";
import {
  runSimulationV2,
  SimulationV2Error,
} from "../engine_v2/simulatorCoreV2";
import { useCnCoilsSimulationStore } from "../store/useUnilabSimulationStore";
import { getRefrigerantProps } from "@/modules/unilab_simulator/services/refrigerantProperties";
import type {
  TubeMaterialItem,
  UnilabComponentType,
  CoilGeometryCatalogItem,
} from "../types/unilab.types";
import type { StructuredWarning } from "../types/warnings";

export interface UseCnCoilsSimulationV2Params {
  tubeMaterials: TubeMaterialItem[];
  geometries: CoilGeometryCatalogItem[];
  componentType: UnilabComponentType;
}

const FALLBACK_FLUID_PROPS = {
  rho_kg_m3: 1108,
  mu_Pa_s: 2.18e-4,
  cp_J_kgK: 1440,
  k_W_mK: 0.078,
  Pr: 4.02,
};

export function useCnCoilsSimulationV2(params: UseCnCoilsSimulationV2Params) {
  const setResult = useCnCoilsSimulationStore((s) => s.setResult);
  const setWarnings = useCnCoilsSimulationStore((s) => s.setWarnings);
  const setIsSimulating = useCnCoilsSimulationStore((s) => s.setIsSimulating);

  const run = useCallback(() => {
    const state = useCnCoilsSimulationStore.getState();
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

      const refrigerantName = (state.fluid ?? "REF_R404A").replace(/^REF_/, "");
      const fluidTemp = state.fluidOperatingTemp_C ?? -10;
      const fluidPropsResult = getRefrigerantProps(refrigerantName, fluidTemp, "liquid");
      const fluidProps = fluidPropsResult ?? FALLBACK_FLUID_PROPS;
      const fluidPropsIsFallback = !fluidPropsResult;

      const geometry = params.geometries.find((g) => g.id === physical.geometryId);
      const geoRaw = geometry?.raw as Record<string, unknown> | undefined;
      const finCorr = Number(geoRaw?.FatCorAl ?? geoRaw?.fin_correction_factor);

      const rawResult = runSimulationV2({
        physical,
        thermo,
        componentType: params.componentType,
        tubeMaterialConductivity: tubeMat.conductivityWmK,
        fluidProps,
        fluidMassFlowKgS,
        foulingExternal: state.foulingFactorAir,
        foulingInternal: state.foulingFactorFluid,
        superheatK: state.superheat_K,
        subcoolingK: state.subcooling_K,
        finCorrectionFactor: Number.isFinite(finCorr) && finCorr > 0 ? finCorr : 1.0,
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
      const warnings: StructuredWarning[] = [
        ...(fluidPropsIsFallback ? [{ code: "FLUID_FALLBACK", message: `Refrigerante "${refrigerantName}" não disponível na tabela. Usando R404A@-10°C como estimativa.`, severity: "warning" as const }] : []),
      ];
      const engineWarnings: StructuredWarning[] = result.warnings.map((msg) => ({
        code: "GENERAL_WARNING", message: msg, severity: "warning" as const,
      }));
      const allWarnings = [...engineWarnings, ...warnings];

      setResult(result);
      setWarnings(allWarnings);
      return { success: true as const, result, warnings: allWarnings };
    } catch (err) {
      const errors =
        err instanceof SimulationV2Error
          ? err.errors
          : [String(err)];
      setResult(undefined);
      setWarnings(errors.map((msg) => ({ code: "CALC_ERROR", message: msg, severity: "error" as const })));
      return { success: false as const, errors };
    } finally {
      setIsSimulating(false);
    }
  }, [params, setIsSimulating, setResult, setWarnings]);

  return { run };
}
