/**
 * Engines — cálculo puro de refrigeração.
 * Nenhum import de React, Supabase ou rotas aqui dentro.
 */

// Coil (trocadores de calor)
export * from "../coil/engines";
export * from "../coil/correlations";
export { simulateHybridCoilWithUnilab } from "../coil/unilab/simulateHybridCoilWithUnilab";
export * from "../coil/airSideCorrelations";
export * from "../coil/coilCalibration";
export * from "../coil/calibrationSafe";
export * from "../coil/calibrationSignature";
export * from "../coil/condenserCoilSimulator";
export * from "../coil/dxCondenserSimulator";
export * from "../coil/dxEvaporatorSimulator";
export * from "../coil/evaporatorCoilSimulator";
export * from "../coil/geometryDerived";
export * from "../coil/heatExchangeArea";
export * from "../coil/hybridDebugAdapter";
export * from "../coil/performanceMapGenerator";
export * from "../coil/performanceMapNominalGuard";
export * from "../coil/physicalSimpleEngine";
export * from "../coil/unilabFactorApplication";
export * from "../coil/coilDesignSolver";

// System (ciclo completo)
export {
  simulateSystem,
  simulateSystemVapcyc,
  runCompressor,
  listCompressorModels,
  getCompressorModel,
  simulateCompressor,
  evaluateCompressor,
  runEvaporator,
  runCondenser,
  runExpansionDevice,
} from "../system";
