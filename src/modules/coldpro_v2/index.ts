// Domain types
export type {
  AgroCycleInput,
  AgroCycleMode,
  AgroCycleResult,
  CircuitAggregationResult,
  CircuitControlResult,
  CircuitFlowDistributionResult,
  CircuitFlowItem,
  CircuitPerformanceResult,
  CircuitSummary,
  CoilAdvancedInput,
  CoilAdvancedResult,
  CoilEngineResult,
  CoilInput,
  CoilIterativeInput,
  CoilIterativeResult,
  CoilResult,
  CoilSolverMode,
  CoilSurfaceModeResult,
  ComponentUtilization,
  Compressor,
  CompressorControlMode,
  CompressorDispatchResult,
  CompressorDispatchState,
  CompressorSpec,
  CompressorType,
  CompressorUnit,
  CondenserSpec,
  CondenserUnit,
  CoupledCoilResult,
  CoupledIterationRecord,
  DefrostComponentRecommendation,
  DefrostCycleInput,
  DefrostCycleResult,
  DefrostMethod,
  DripTrayCoilInput,
  DripTrayCoilResult,
  DripTrayCondition,
  Equipment,
  EquipmentConfigurationResult,
  EquipmentSimulationResult,
  EquipmentType,
  EvaporatorUnit,
  ExpansionControlMode,
  ExpansionValve,
  ExpansionValveSpec,
  Fan,
  FanControlMode,
  FanSpec,
  FitQuality,
  FourWayValveSpec,
  FrostFormationInput,
  FrostFormationResult,
  HeatExchanger,
  HeatExchangerPosition,
  HeatExchangerRole,
  HeatExchangerType,
  IterationRecord,
  MoistAirCoolingLoadResult,
  MultiCircuitControlInput,
  MultiCircuitControlResult,
  OperatingEnvelope,
  OperatingIsoline,
  OperatingMapGridConfig,
  OperatingMapInput,
  OperatingMapPoint,
  OperatingMapResult,
  OperatingMapStats,
  OperatingPoint,
  OperationalMode,
  OperationalOrchestratorInput,
  OperationalOrchestratorResult,
  PerformanceEnvelope,
  PerformanceOperatingPoint,
  PerformancePoint,
  PerformanceSummary,
  PolynomialCoefficientSet,
  PolynomialCoefficients,
  PolynomialGenerationInput,
  PolynomialGenerationOptions,
  PolynomialGenerationResult,
  PolynomialTarget,
  ProductComparisonItem,
  ProductIdentity,
  ProductOperatingLimits,
  ProductPerformanceCurveInput,
  ProductPerformanceCurveResult,
  ProductPerformancePoint,
  ProductRegistryAddResult,
  ProductRegistryFilter,
  ProductRegistryStats,
  ProductTechnicalExportInput,
  ProductTechnicalExportPayload,
  ProductTechnicalRecord,
  ProductTechnicalRecordInput,
  ProductTechnicalRegistryHandle,
  ProductValidationSummary,
  ProgressiveCoilInput,
  ProgressiveCoilResult,
  Refrigerant,
  RefrigerationCircuit,
  ReheatCoilSizingInput,
  ReheatCoilSizingResult,
  ReheatInput,
  ReheatResult,
  RollGeometry,
  RollResult,
  SimulationAssembly,
  SystemArchitectureInput,
  SystemArchitectureResult,
  SystemComponentsInput,
  SystemEquilibriumResult,
  ThermalBalance,
  UnifiedDefrostStatus,
  UnifiedFrostStatus,
  UnifiedOperationalOutput,
  UnifiedProgressiveInfo,
  VariableControlInput,
  VariableControlResult,
  WetAirCorrectionResult,
  WetCoilInput,
  WetCoilResult,
} from "./domain/types";

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

// Engines — polynomial
export { generatePolynomialCoefficients } from "./engines/polynomial/polynomialCoefficientGenerator";

// Database
export { buildProductTechnicalRecord } from "./database/productTechnicalRecordBuilder";

// Engines — map
export { generateOperatingMap } from "./engines/map/operatingMapEngine";

// Engines — control
export { simulateVariableSystemControl } from "./engines/control/variableSystemControlEngine";

// Engines — architecture
export { evaluateSystemArchitecture } from "./engines/architecture/systemArchitectureEngine";

// Engines — multi-circuit control
export { solveMultiCircuitVariableControl } from "./engines/control/multiCircuitVariableControlSolver";

// Registry
export { createProductTechnicalRegistry } from "./database/productTechnicalRegistry";

// Adapters
export { normalizeOperationalOutput } from "./adapters/unifiedOperationalOutputAdapter";
export { exportProductTechnicalData } from "./adapters/productTechnicalExportAdapter";

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
