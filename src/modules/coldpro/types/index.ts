/**
 * Tipos TypeScript compartilhados do ColdPro.
 * Exposto como namespaces para evitar colisões entre subsistemas
 * (ex.: FinType existe em coilSimulatorTypes e em engines/types).
 *
 * Para tipos específicos, importe diretamente do módulo de origem:
 *   import type { CoilSimulatorInput } from "@/modules/coldpro/coil/coilSimulatorTypes";
 */

export type * as CoilSimulatorTypes from "../coil/coilSimulatorTypes";
export type * as CoilEngineTypes from "../coil/coilEngineTypes";
export type * as CoilEnginesTypes from "../coil/engines/types";
export type * as CorrelationTypes from "../coil/correlations/correlationTypes";
export type * as UnilabTypes from "../coil/unilab/unilabTypes";
export type * as UnilabDataTypes from "../unilabData/types";

// Tipos do sistema (sem conflitos — re-export plano)
export type {
  SystemInput,
  SystemResult,
  SectionResult,
  CompressorResult,
  CompressorModelData,
  Bottleneck,
  Refrigerant,
} from "../system/systemTypes";
export type {
  VapcycSystemInput,
  VapcycSystemResult,
} from "../system/vapcycSystemSimulator";
export type {
  SimulateCompressorInput,
  SimulateCompressorResult,
  VapcycCompressorRecord,
  VapcycPolynomialRecord,
  VapcycCurveType,
} from "../system/vapcycCompressorEngine";
