// Barrel público do módulo UNILAB Simulator.
export { UnilabDashboardPage } from "./pages/UnilabDashboardPage";
export { CnCoilsWorkspacePage } from "./pages/UnilabWorkspacePage";
export { useCnCoilsCatalogs, REQUIRED_CATALOG_FILES } from "./hooks/useUnilabCatalogs";
export { useCnCoilsSimulation } from "./hooks/useUnilabSimulation";
export { useCnCoilsSimulationStore } from "./store/useUnilabSimulationStore";
export { runSimulation, SimulationError } from "./engine/simulatorCore";
export {
  toEvaporatorInput,
  toCondenserInput,
  validateBeforeAdapt,
} from "./adapters/toColdProAdapter";
export * from "./types/unilab.types";
