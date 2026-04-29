/**
 * STUB — modo DESIGN (próxima etapa).
 * Receberá capacidade desejada + limites e testará combinações de fileiras,
 * circuitos, passo de aleta e comprimento, retornando geometrias compatíveis.
 */
import type {
  CoilSimulatorInput,
  CoilGeometry,
  CoilSimulatorResult,
} from "./coilSimulatorTypes";

export interface DesignTarget {
  desiredCapacityW: number;
  maxAirPressureDropPa?: number;
  maxRefPressureDropKpa?: number;
}

export interface DesignSuggestion {
  geometry: CoilGeometry;
  result: CoilSimulatorResult;
}

export function solveCoilDesign(
  _input: CoilSimulatorInput,
  _target: DesignTarget,
): DesignSuggestion[] {
  // TODO: varrer combinações (rows × circuits × finPitch × length) e ranquear.
  return [];
}
