// Barrel público do módulo CN Coils Simulator.
export { CnCoilsDashboardPage } from "./pages/CnCoilsDashboardPage";
export { CnCoilsWorkspacePage } from "./pages/CnCoilsWorkspacePage";
export { useCnCoilsCatalogs, REQUIRED_CATALOG_FILES } from "./hooks/useCnCoilsCatalogs";
export { useCnCoilsSimulation } from "./hooks/useCnCoilsSimulation";
export { useCnCoilsSimulationStore } from "./store/useCnCoilsSimulationStore";
export { runSimulation, SimulationError } from "./engine/simulatorCore";
export {
  toEvaporatorInput,
  toCondenserInput,
  validateBeforeAdapt,
} from "./adapters/toColdProAdapter";
export * from "./types/cncoils.types";
