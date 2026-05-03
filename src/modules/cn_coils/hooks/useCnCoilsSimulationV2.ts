// Hook que executa o motor V2 (Etapa 6) sem alterar o V1.
// Lê do store, busca catálogo de coeficientes CN Coils, chama runSimulationV2.

import { useCallback } from "react";
import {
  runSimulationV2,
  SimulationV2Error,
} from "../engine_v2/simulatorCoreV2";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { getRefrigerantLiquidProps } from "../engine_v2/refrigerantProps";
import type {
  TubeMaterialItem,
  CnCoilsComponentType,
  CoilGeometryCatalogItem,
} from "../types/cncoils.types";
import type { StructuredWarning } from "../types/warnings";

export interface UseCnCoilsSimulationV2Params {
  tubeMaterials: TubeMaterialItem[];
  geometries: CoilGeometryCatalogItem[];
  componentType: CnCoilsComponentType;
}


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

      const T_sat = thermo.evaporatingTempC ?? thermo.condensingTempC ?? state.fluidOperatingTemp_C ?? -10;
      const fluidData = getRefrigerantLiquidProps(state.fluid ?? "REF_R404A", T_sat);
      const fluidProps = {
        rho_kg_m3: fluidData.rho_kg_m3,
        mu_Pa_s: fluidData.mu_Pa_s,
        cp_J_kgK: fluidData.cp_J_kgK,
        k_W_mK: fluidData.k_W_mK,
      };

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
        h_fg_kJkg: fluidData.h_fg_kJkg,
      });
      const result = {
        ...rawResult,
      };
      const warnings: StructuredWarning[] = [
        ...fluidData.warnings.map((msg) => ({ code: "FLUID_FALLBACK" as const, message: msg, severity: "warning" as const })),
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
