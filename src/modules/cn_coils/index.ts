// Barrel público do módulo UNILAB Simulator.
export { UnilabDashboardPage } from "./pages/UnilabDashboardPage";
export { UnilabWorkspacePage } from "./pages/UnilabWorkspacePage";
export { useUnilabCatalogs, REQUIRED_CATALOG_FILES } from "./hooks/useUnilabCatalogs";
export { useUnilabSimulation } from "./hooks/useUnilabSimulation";
export { useUnilabSimulationStore } from "./store/useUnilabSimulationStore";
export { runSimulation, SimulationError } from "./engine/simulatorCore";
export {
  toEvaporatorInput,
  toCondenserInput,
  validateBeforeAdapt,
} from "./adapters/toColdProAdapter";
export * from "./types/unilab.types";
