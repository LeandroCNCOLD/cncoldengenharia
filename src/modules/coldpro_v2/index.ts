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

// Engines — air side
export { calculateAirProperties } from "./engines/airSide/airProperties";

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
