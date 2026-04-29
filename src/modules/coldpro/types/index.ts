/**
 * Tipos TypeScript compartilhados do ColdPro.
 * Re-exportados das fontes canônicas para uso por screens/components/services.
 */

export type * from "../coil/coilSimulatorTypes";
export type * from "../coil/coilEngineTypes";
export type * from "../coil/engines/types";
export type * from "../coil/correlations/correlationTypes";
export type * from "../coil/unilab/unilabTypes";
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
export type * from "../unilabData/types";
