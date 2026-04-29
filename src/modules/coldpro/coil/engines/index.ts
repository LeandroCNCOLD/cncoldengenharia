/**
 * Motor híbrido Unilab + VAPXCode — entrypoint canônico.
 *
 * Fluxo:
 *   1. geometryEngine        → área (frontal, tubos, aletas, eficiência, efetiva)
 *   2. airSideEngine         → h_air (correlação por finType + fatores Unilab)
 *   3. refrigerantSideEngine → h_ref (placeholder físico até wiring de mass flow)
 *   4. U                     = 1 / (1/h_air + R_fouling_ar + R_parede + R_fouling_ref + 1/h_ref)
 *   5. Q                     = U × A_efetiva × DTML × securityFactor   ← REGRA CRÍTICA
 *   6. pressureDropEngine    → ΔP ar e refrigerante
 *   7. calibrationEngine     → ajuste fino auditável (compatibilidade por assinatura)
 *
 * Importar daqui:
 *   import { simulateHybridCoil } from "@/modules/coldpro/coil/engines";
 */
export {
  simulateHybridCoil,
  generateModelSignature,
  ENGINE_NAME,
  ENGINE_VERSION,
} from "./hybridCoilEngine";
export {
  calibrateAgainstUnilabDatasheet,
  calibrateAgainstDatasheet,
  isCalibrationCompatible,
  applyCalibration,
  validateCalibrationFactors,
} from "./calibrationEngine";
export type {
  DatasheetReference,
  CalibrationOutcome,
  CalibrationDeviation,
  ApplyCalibrationOutput,
} from "./calibrationEngine";
export type {
  CoilCalculationInput,
  CoilCalculationResult,
  CoilCalibration,
  CalibrationStatus,
  GeometryInput,
  UnilabFactors,
  CoilMode,
  FinType,
  TubeType,
} from "./types";
