// Domain types
export * from "./domain/types";

// Mapper
export { mapCatalogRowToEquipment } from "./mappers/catalogToEquipment";
export { FIELD_ALIASES } from "./mappers/fieldAliases";

// Validators
export { getTechnicalStatus } from "./validators/technicalStatus";
export type { TechnicalStatusResult } from "./validators/technicalStatus";

// Utils
export { parseNullableNumber, normalizeString, isFilled } from "./utils/number";
export { normalizeFieldName, resolveField } from "./utils/fieldNormalizer";
export { toWatts, fromWatts, formatCapacity, detectUnitFromFieldName } from "./utils/unitConverter";
export { readNumberWithUnit } from "./utils/readNumberWithUnit";
export type { ReadNumberWithUnitResult } from "./utils/readNumberWithUnit";

// Engines — main
export { calculateCoil, calculateCoilAdvanced } from "./engines/coilCalculationEngine";

// Engines — solver
export { solveCoilIterative } from "./engines/solver/iterativeCoilSolver";

// Engines — core
export {
  calculateSensibleHeatW,
  calculateMassFlowAirKgS,
  calculateHeatCapacityRateW_K,
} from "./engines/core/heatBalance";
export { calculateLMTD, calculateHeatTransferByLMTD } from "./engines/core/lmtd";
export {
  calculateNTU,
  calculateEffectivenessCrossflowUnmixed,
  calculateHeatTransferByNTU,
} from "./engines/core/ntu";
export {
  calculateReynolds,
  calculatePrandtl,
  calculateNusseltGnielinski,
  calculateConvectiveCoefficient,
} from "./engines/core/dimensionless";
export { calculateDarcyFrictionFactor } from "./engines/core/friction";
export { calculateDarcyWeisbachPressureDrop } from "./engines/core/pressureDrop";
export { calculateOverallU } from "./engines/core/overallHeatTransfer";
export { calculateFinEfficiencySimplified } from "./engines/core/finEfficiency";

// Engines — core (wall)
export { calculateTubeWallResistance } from "./engines/core/wallResistance";

// Engines — air side
export { calculateAirProperties } from "./engines/airSide/airProperties";

// Engines — fluid side
export { calculateFluidProperties } from "./engines/fluidSide/fluidProperties";
export { calculateInternalFluidHTC } from "./engines/fluidSide/fluidHeatTransfer";
export { calculateInternalFluidPressureDrop } from "./engines/fluidSide/fluidPressureDrop";

// Engines — fluid side (two-phase)
export { calculateTwoPhaseProperties } from "./engines/fluidSide/twoPhaseProperties";
export { calculateTwoPhaseHTC } from "./engines/fluidSide/twoPhaseHeatTransfer";

// Engines — circuit
export { calculateCircuitFlowDistribution } from "./engines/circuit/flowDistribution";
export { calculateCircuitPerformance } from "./engines/circuit/circuitPerformance";
export { aggregateCircuitResults } from "./engines/circuit/circuitAggregator";

// Services
export {
  createEquipment,
  addHeatExchanger,
  removeHeatExchanger,
  toggleHeatExchanger,
  sortHeatExchangersBySequence,
  validateEquipmentConfiguration,
  simulateEquipment,
} from "./services/equipmentBuilder";
