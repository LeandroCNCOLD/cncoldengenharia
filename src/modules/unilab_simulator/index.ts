// Barrel público do módulo CN COILS.
export { UnilabDashboardPage } from "./pages/UnilabDashboardPage";
export { CnCoilsWorkspacePage } from "./pages/CnCoilsWorkspacePage";
export { useUnilabCatalogs, REQUIRED_CATALOG_FILES } from "./hooks/useUnilabCatalogs";
export { useCnCoilsSimulation } from "./hooks/useCnCoilsSimulation";
export { useUnilabSimulationStore } from "./store/useUnilabSimulationStore";
export { runSimulation, SimulationError } from "./engine/simulatorCore";
export {
  toEvaporatorInput,
  toCondenserInput,
  validateBeforeAdapt,
} from "./adapters/toColdProAdapter";
export * from "./types/unilab.types";
