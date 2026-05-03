// Espelha os campos da UI (Etapas 3 e 4) para physicalInputs/thermoInputs
// que o motor (engine/) consome. Sem alterar o engine.
//
// - Lado Ventilação (Etapa 3): airFlow_m3h, tempInDB_C, rhIn_pct
// - Lado Fluido (Etapa 4): fluid, fluidOperatingTemp_C, superheat_K, subcooling_K
//
// Tipo de aplicação define se a temperatura de operação alimenta
// evaporatingTempC ou condensingTempC.

import { useEffect } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type { UnilabComponentType } from "../types/unilab.types";

const DEFAULT_ALTITUDE_M = 0;

function isCondenserType(t: UnilabComponentType): boolean {
  return t === "condenser_air" || t === "condenser_shell_tube";
}

function isEvaporatorType(t: UnilabComponentType): boolean {
  return t === "evaporator_dx" || t === "evaporator_pumped";
}

export function useUnilabInputBridge(componentType: UnilabComponentType) {
  const airFlow_m3h = useUnilabSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useUnilabSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useUnilabSimulationStore((s) => s.rhIn_pct);
  const fluid = useUnilabSimulationStore((s) => s.fluid);
  const fluidOperatingTemp_C = useUnilabSimulationStore((s) => s.fluidOperatingTemp_C);
  const superheat_K = useUnilabSimulationStore((s) => s.superheat_K);
  const subcooling_K = useUnilabSimulationStore((s) => s.subcooling_K);
  const setThermoInputs = useUnilabSimulationStore((s) => s.setThermoInputs);
  const setPhysicalInputs = useUnilabSimulationStore((s) => s.setPhysicalInputs);

  // componentType na parte física (motor exige)
  useEffect(() => {
    setPhysicalInputs({ componentType });
  }, [componentType, setPhysicalInputs]);

  useEffect(() => {
    const patch: Record<string, unknown> = {
      refrigerantId: fluid,
      airFlowM3H: airFlow_m3h,
      airInletTempC: tempInDB_C,
      airInletRhPercent: rhIn_pct,
      altitudeM: DEFAULT_ALTITUDE_M,
      superheatK: superheat_K,
      subcoolingK: subcooling_K,
    };

    if (isCondenserType(componentType)) {
      patch.condensingTempC = fluidOperatingTemp_C;
      patch.evaporatingTempC = undefined;
    } else if (isEvaporatorType(componentType)) {
      patch.evaporatingTempC = fluidOperatingTemp_C;
      patch.condensingTempC = undefined;
    } else {
      // Bateria de aquecimento/resfriamento: usa como evaporating proxy
      // (motor precisa de uma temperatura de superfície)
      patch.evaporatingTempC = fluidOperatingTemp_C;
      patch.condensingTempC = undefined;
    }

    setThermoInputs(patch);
  }, [
    componentType,
    fluid,
    airFlow_m3h,
    tempInDB_C,
    rhIn_pct,
    fluidOperatingTemp_C,
    superheat_K,
    subcooling_K,
    setThermoInputs,
  ]);
}
