/**
 * thermalcalc — Motor de sistema (ciclo completo).
 */

export { simulateSystem } from "./systemSimulator";
export { simulateSystemVapcyc } from "./vapcycSystemSimulator";
export type { VapcycSystemInput, VapcycSystemResult } from "./vapcycSystemSimulator";

export { runCompressor, listCompressorModels, getCompressorModel } from "./compressorEngine";
export { simulateCompressor, evaluateCompressor } from "./vapcycCompressorEngine";
export type {
  SimulateCompressorInput,
  SimulateCompressorResult,
  VapcycCompressorRecord,
  VapcycPolynomialRecord,
  VapcycCurveType,
} from "./vapcycCompressorEngine";

export { runCoilSection, simulateCoil } from "./coilWrapper";
export type { Coil, CoilMode, CoilSectionRunInput } from "./coilWrapper";
export { runExpansionDevice } from "./expansionDeviceEngine";
export { defaultGeometryFromCode } from "./systemGeometryDefaults";

export type {
  SystemInput,
  SystemResult,
  SectionResult,
  CompressorResult,
  CompressorModelData,
  Bottleneck,
  Refrigerant,
} from "./systemTypes";
