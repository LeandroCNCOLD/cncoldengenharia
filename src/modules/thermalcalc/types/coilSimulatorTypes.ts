/**
 * Tipos compartilhados do Coil Simulator (Verify/Design).
 * Geometria + lado do ar + lado refrigerante + resultado.
 */

export type CoilSimulatorMode = "verify" | "design";
export type CoilType = "evaporator" | "condenser";
export type CoilOperatingMode = CoilType;

export type FinType = "integral" | "espiral";
export type TubeArrangement = "staggered" | "aligned";

export interface CoilGeometry {
  description?: string;
  finType?: FinType;
  tubeArrangement?: TubeArrangement;
  tubeSpacingMm?: number; // espaçamento entre tubos
  rowSpacingMm?: number; // espaçamento entre fileiras
  tubeOdMm?: number;
  tubeIdMm?: number;
  tubeWallMm?: number;
  finThicknessMm?: number;
  finCorrugation?: string;
  tubeCorrugation?: string;
  tubesPerRow?: number;
  rows?: number;
  circuits?: number;
  coilLengthMm?: number;
  finPitchMm?: number;
  skippedTubes?: number;
  tubeMaterial?: string;
  finMaterial?: string;
}

export interface AirSide {
  airflowM3h?: number;
  faceVelocityMs?: number;
  airTempInC?: number;
  airTempOutC?: number;
  rhInPct?: number;
  rhOutPct?: number;
  atmPressureKpa?: number;
  altitudeM?: number;
  airDensityKgM3?: number;
  enthalpyInKjkg?: number;
  enthalpyOutKjkg?: number;
  airPressureDropPa?: number;
}

export interface RefrigerantSide {
  refrigerant?: string;
  refTempC?: number; // Tevap (evap) ou Tcond (cond)
  pressureKpa?: number;
  massFlowKgs?: number;
  superheatK?: number;
  subcoolingK?: number;
  vapourVelocityMs?: number;
  liquidVelocityMs?: number;
  refrigerantPressureDropKpa?: number;
}

export interface NominalReference {
  capacityW: number;
  airTempInC: number;
  refTempC: number;
  airflowM3h: number;
}

export interface CoilSimulatorInput {
  mode: CoilSimulatorMode;
  coilType: CoilType;
  label?: string;
  geometry: CoilGeometry;
  air: AirSide;
  refrigerant: RefrigerantSide;
  /** Ponto nominal de referência (datasheet). Quando ausente, é estimado. */
  nominal?: NominalReference;
  frostFactor?: number; // evap, default 0.90
  foulingFactor?: number; // default 1.00
  altitudeFactor?: number; // cond, default 1.00
}

export interface Coil {
  id: string;
  type: "coil";
  mode: CoilOperatingMode;
  geometry: CoilGeometry;
  air: AirSide;
  refrigerantSide: RefrigerantSide;
  datasheetReference?: DatasheetReference | null;
  calibration?: {
    capacityCorrectionFactor?: number;
    uaCorrectionFactor?: number;
    airDpCorrectionFactor?: number;
    refDpCorrectionFactor?: number;
    airPressureDropFactor?: number;
    refrigerantPressureDropFactor?: number;
    heatTransferFactor?: number;
  } | null;
  label?: string;
  frostFactor?: number;
  foulingFactor?: number;
  altitudeFactor?: number;
}

export interface DatasheetReference {
  capacityW?: number | null;
  airInletTempC?: number | null;
  airOutletTempC?: number | null;
  evaporationTempC?: number | null;
  condensationTempC?: number | null;
  airflowM3h?: number | null;
  airPressureDropPa?: number | null;
  refrigerantPressureDropKpa?: number | null;
  refrigerant?: string | null;
}

/** Snapshot técnico do motor híbrido (correlações + fatores Unilab). */
export interface HybridDebugInfo {
  source: "unilab" | "partial" | "fallback";
  geometryCode?: string;
  finType?: string;
  tubeType?: string;
  airCorrelationName: string;
  refCorrelationName: string;
  hAirBaseWm2K: number;
  hAirFinalWm2K: number;
  hRefBaseWm2K: number;
  hRefFinalWm2K: number;
  uWm2K: number;
  effectiveAreaM2: number;
  airCorrelationConfidence: number;
  refCorrelationConfidence: number;
  confidenceScore: number;
  isEstimated: boolean;
  factorsApplied: Record<string, number | undefined> | null;
  warnings: string[];
  /** Geometria calculada do aletado. */
  geometry?: {
    frontalAreaM2: number;
    totalExternalAreaM2: number;
    internalTubeAreaM2: number;
    internalVolumeL: number;
    finEfficiency: number;
    finCount: number;
    totalTubeCount: number;
    totalTubeLengthM: number;
    qSpecificWm2: number;
    areaSource: "calculated_geometry" | "imported_unilab";
    areaDeviationPct?: number;
    volumeDeviationPct?: number;
  };
}

export interface CoilSimulatorResult {
  coilType: CoilType;
  capacityW: number;
  capacityKcalh: number;
  sensibleW: number | null;
  latentW: number | null;
  dtRealK: number;
  dtNominalK: number;
  faceAreaM2: number | null;
  faceVelocityMs: number | null;
  airflowFactor: number;
  dtFactor: number;
  airPressureDropPa: number | null;
  refPressureDropKpa: number | null;
  condensateLh: number | null;
  warnings: string[];
  rejection?: { used: NominalReference; estimated: boolean };
  /** Telemetria do motor híbrido para o painel de Debug Técnico. */
  debug?: HybridDebugInfo;
}
