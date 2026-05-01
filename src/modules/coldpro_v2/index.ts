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
export { solveCoupledCoil, calculateCoupledCoil } from "./engines/solver/coupledCoilSolver";

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
export { calculateAirGeometry } from "./engines/airSide/airGeometry";
export { calculateAirSideHTC } from "./engines/airSide/airHeatTransfer";
export { calculateAirPressureDrop } from "./engines/airSide/airPressureDrop";

// Engines — fluid side
export { calculateFluidProperties } from "./engines/fluidSide/fluidProperties";
export { calculateInternalFluidHTC } from "./engines/fluidSide/fluidHeatTransfer";
export { calculateInternalFluidPressureDrop } from "./engines/fluidSide/fluidPressureDrop";

// Engines — fluid side (two-phase)
export { calculateTwoPhaseProperties } from "./engines/fluidSide/twoPhaseProperties";
export { calculateTwoPhaseHTC } from "./engines/fluidSide/twoPhaseHeatTransfer";

// Engines — psychrometrics
export {
  saturationPressure,
  humidityRatio,
  enthalpyMoistAir,
  dewPoint,
  cpMoistAir,
} from "./engines/psychrometrics/psychrometricCore";
export { calculateWetCoil } from "./engines/psychrometrics/wetCoil";
export { calculateReheat } from "./engines/psychrometrics/reheatCoil";

// Engines — circuit
export { calculateCircuitFlowDistribution } from "./engines/circuit/flowDistribution";
export { calculateCircuitPerformance } from "./engines/circuit/circuitPerformance";
export { aggregateCircuitResults } from "./engines/circuit/circuitAggregator";

// Engines — agro
export { calculateAgroCycle } from "./engines/agro/agroCycle";
export { calculateReheatCoilSizing } from "./engines/agro/reheatCoilSizing";

// Engines — progressive
export { calculateProgressiveCoil } from "./engines/progressive/progressiveCoilSolver";

// Engines — operation
export { calculateOperationalCycle } from "./engines/operation/operationalOrchestrator";

// Engines — defrost
export { calculateDefrostCycle } from "./engines/defrost/defrostCycle";
export { calculateFrostFormation } from "./engines/defrost/frostFormation";

// Engines — subcooling
export { calculateDripTrayCoil } from "./engines/subcooling/dripTrayCoil";

// Engines — equilibrium
export { evaluateSystemEquilibrium } from "./engines/equilibrium/systemEquilibriumEngine";

// Engines — performance
export { generateProductPerformanceCurve } from "./engines/performance/productPerformanceCurveEngine";
export type {
  OperatingPoint,
  PerformanceOperatingPoint,
  PerformanceEnvelope,
  PerformanceSummary,
  ProductPerformanceCurveInput,
  ProductPerformanceCurveResult,
  ProductPerformancePoint,
} from "./domain/types";

// Engines — polynomial
export { generatePolynomialCoefficients } from "./engines/polynomial/polynomialCoefficientGenerator";
export type {
  FitQuality,
  PolynomialCoefficientSet,
  PolynomialCoefficients,
  PolynomialGenerationInput,
  PolynomialGenerationOptions,
  PolynomialGenerationResult,
  PolynomialTarget,
} from "./domain/types";

// Database
export { buildProductTechnicalRecord } from "./database/productTechnicalRecordBuilder";
export type {
  ProductIdentity,
  ProductOperatingLimits,
  ProductTechnicalRecord,
  ProductTechnicalRecordInput,
  ProductValidationSummary,
} from "./domain/types";

// Engines — map
export { generateOperatingMap } from "./engines/map/operatingMapEngine";
export type {
  OperatingEnvelope,
  OperatingIsoline,
  OperatingMapGridConfig,
  OperatingMapInput,
  OperatingMapPoint,
  OperatingMapResult,
  OperatingMapStats,
} from "./domain/types";

// Engines — control
export { simulateVariableSystemControl } from "./engines/control/variableSystemControlEngine";
export type {
  CompressorControlMode,
  ExpansionControlMode,
  FanControlMode,
  VariableControlInput,
  VariableControlResult,
} from "./domain/types";

// Engines — architecture
export { evaluateSystemArchitecture } from "./engines/architecture/systemArchitectureEngine";
export type {
  CircuitSummary,
  CompressorType,
  CompressorUnit,
  CondenserUnit,
  EvaporatorUnit,
  RefrigerationCircuit,
  SystemArchitectureInput,
  SystemArchitectureResult,
} from "./domain/types";

// Engines — multi-circuit control
export { solveMultiCircuitVariableControl } from "./engines/control/multiCircuitVariableControlSolver";
export type {
  CircuitControlResult,
  CompressorDispatchResult,
  CompressorDispatchState,
  MultiCircuitControlInput,
  MultiCircuitControlResult,
} from "./domain/types";

// Adapters
export { normalizeOperationalOutput } from "./adapters/unifiedOperationalOutputAdapter";

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
