/**
 * Engines — cálculo puro de refrigeração.
 * Nenhum import de React, Supabase ou rotas aqui dentro.
 *
 * Para evitar conflitos de nomes entre subsistemas, os pacotes maiores
 * são expostos como namespaces. Importações finas continuam disponíveis
 * via os caminhos originais (ex.: `@/modules/coldpro/coil/engines`).
 */

// Coil engines (geometria, ar, refrigerante, calibração, etc.)
export * as CoilEngines from "../coil/engines";
export * as CoilCorrelations from "../coil/correlations";

// Helpers de coil específicos (sem conflitos)
export { simulateHybridCoilWithUnilab } from "../coil/unilab/simulateHybridCoilWithUnilab";
export { performanceMapGenerator } from "../coil/performanceMapGenerator";
export { performanceMapNominalGuard } from "../coil/performanceMapNominalGuard";

// Simuladores DX
export * as DxEvaporator from "../coil/dxEvaporatorSimulator";
export * as DxCondenser from "../coil/dxCondenserSimulator";
export * as EvaporatorCoil from "../coil/evaporatorCoilSimulator";
export * as CondenserCoil from "../coil/condenserCoilSimulator";

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
