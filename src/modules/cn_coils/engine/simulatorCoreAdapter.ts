/**
 * Adaptador unificado para os motores de simulação CN Coils.
 *
 * Estratégia de unificação progressiva:
 *   - V1 (simulatorCore.ts): Motor original com correção CN Coils + Wang-Chi-Chang
 *   - V2 (simulatorCoreV2.ts): Motor ASHRAE com psicrometria real + NTU-ε
 *   - coldpro_v2/engines: Motor V2+ com solver acoplado — interface incompatível,
 *     unificação adiada para versão 2.0.
 *
 * Este adaptador delega ao V1 por padrão (preservando comportamento atual)
 * e exporta runSimulationV2 para quem precisa do motor avançado.
 */

import {
  runSimulation as runSimulationV1,
  SimulationError,
  type RunSimulationParams,
} from "./simulatorCore";
import {
  runSimulationV2 as runSimulationV2Direct,
  SimulationV2Error,
  type SimulationV2Inputs,
  type SimulationV2Result,
} from "../engine_v2/simulatorCoreV2";
import type { CnCoilsSimulationResult } from "../types/cncoils.types";

export type { RunSimulationParams } from "./simulatorCore";
export type { SimulationV2Inputs, SimulationV2Result } from "../engine_v2/simulatorCoreV2";
export { SimulationError } from "./simulatorCore";
export { SimulationV2Error } from "../engine_v2/simulatorCoreV2";

export function runSimulation(params: RunSimulationParams): CnCoilsSimulationResult {
  return runSimulationV1(params);
}

export function runSimulationV2(inputs: SimulationV2Inputs): SimulationV2Result {
  return runSimulationV2Direct(inputs);
}
