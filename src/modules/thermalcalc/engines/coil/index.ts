/**
 * thermalcalc — Motor de cálculo de coil (entrypoint).
 *
 * Esta é a fachada oficial. Toda lógica matemática vive aqui dentro.
 * O ColdPro consome através de `@/modules/coldpro/adapters/thermalcalcAdapter`.
 */

export {
  simulateHybridCoil,
  generateModelSignature,
  ENGINE_NAME,
  ENGINE_VERSION,
} from './internals/hybridCoilEngine';

export {
  calibrateAgainstUnilabDatasheet,
  calibrateAgainstDatasheet,
  isCalibrationCompatible,
  applyCalibration,
  validateCalibrationFactors,
} from './internals/calibrationEngine';

export type {
  DatasheetReference,
  CalibrationOutcome,
  CalibrationDeviation,
  ApplyCalibrationOutput,
} from './internals/calibrationEngine';

export type {
  CoilCalculationInput,
  CoilCalculationResult,
  CoilCalibration,
  CalibrationStatus,
  GeometryInput,
  UnilabFactors,
  CoilMode,
  FinType,
  TubeType,
} from './internals/types';

// Helpers públicos do coil
export { simulatePhysicalSimple } from './physicalSimpleEngine';
export { simulateDxEvaporator } from './dxEvaporatorSimulator';
export { simulateDxCondenser } from './dxCondenserSimulator';
export { simulateEvaporator } from './evaporatorCoilSimulator';
export { simulateCondenser } from './condenserCoilSimulator';
export { calibrateAgainstReference } from './coilCalibration';
export type { CalibrationOutcome as CoilCalibrationOutcome, DatasheetPoint } from './coilCalibration';
export { deriveCoilGeometry } from './geometryDerived';
export type { GeometryDerived } from './geometryDerived';
export { calcHeatExchangeArea } from './heatExchangeArea';
export { selectAirHTC } from './airSideCorrelations';
export type { AirHtcCorrelation } from './airSideCorrelations';
export { computeUnilabFactors } from './unilabFactorApplication';
export { runHybridDebug, buildHybridCalcInput } from './hybridDebugAdapter';

// Performance map
export * from './performanceMapGenerator';
export * from './performanceMapNominalGuard';

// Calibração
export * from './calibrationSafe';
export * from './calibrationSignature';

// Unilab (tipos + mapper puro)
export * from './unilab/unilabTypes';
export * from './unilab/unilabMapper';

// Correlações
export * as Correlations from './correlations';
