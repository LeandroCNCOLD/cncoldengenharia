import { simulateCoil } from "@/modules/thermalcalc/engines/system/coilWrapper";
import type { Coil } from "@/modules/thermalcalc/types/coilSimulatorTypes";
import type { SectionResult } from "@/modules/thermalcalc/engines/system/systemTypes";

/**
 * Compatibility shim for older generated/dev-server imports.
 * New code must use `simulateCoil` / `runCoilSection` from `system/coilWrapper`.
 */
export function runCoilCollection(coils: Coil[]): SectionResult[] {
  return coils.map((coil) => simulateCoil(coil));
}

export { simulateCoil };
