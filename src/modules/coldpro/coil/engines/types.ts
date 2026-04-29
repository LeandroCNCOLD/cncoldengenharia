export type CoilMode = 'cooling' | 'heating' | 'condensation' | 'direct_expansion' | 'steam' | 'pump_evaporator' | 'multiphase';

export type FinType = 'plain' | 'wavy' | 'louver' | 'herringbone' | 'unknown';
export type TubeType = 'smooth' | 'microfin' | 'grooved' | 'unknown';

export interface GeometryInput {
  code: string;
  mode: CoilMode;
  finType: FinType;
  tubeType: TubeType;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
  tubePitchMm: number;
  rowPitchMm: number;
  finPitchMm: number;
  finThicknessMm: number;
  coilLengthMm: number;
  coilHeightMm: number;
  /** Profundidade do coil (na direção do escoamento). Default = rows × rowPitchMm. */
  coilDepthMm?: number;
  rows: number;
  tubesPerRow: number;
  circuits: number;
  /** Tubos suprimidos (entradas/saídas/manifolds). Default 0. */
  skippedTubes?: number;
  tubeMaterialConductivityWmK?: number;
  /** Condutividade do material da aleta (W/mK). Default 205 (Al). */
  finMaterialConductivityWmK?: number;
  /** Área de troca de catálogo Unilab (m²) — usada como fallback se geometria divergir. */
  unilabExchangeAreaM2?: number;
  /** Volume interno de catálogo Unilab (L) — referência para comparação. */
  unilabInternalVolumeL?: number;
}

export interface UnilabFactors {
  fatCorAl?: number;
  fatCoeflattub?: number;
  fatRidAumSup?: number;
  fattoreAttrAria?: number;
  fattoreAttrAriaLatente?: number;
  fatCorrFatAttr?: number;
  slopeFatCorAl?: number;
  slopeFatCoeflattub?: number;
  slopeFattoreAttrAria?: number;
  securityFactor?: number;
}

export type UnilabSource = 'unilab' | 'partial' | 'fallback';

export interface CoilCalculationInput {
  mode: CoilMode;
  geometry: GeometryInput;
  factors?: UnilabFactors;
  /** Origem dos dados Unilab (informativo — apenas debug/telemetria). */
  unilabSource?: UnilabSource;
  airInletTempC: number;
  airOutletTempC?: number;
  refTempC: number;
  airflowM3h: number;
  relativeHumidityPct?: number;
  wet?: boolean;
  refrigerant?: string;
  refrigerantMassFlowKgH?: number;
  hRefOverrideWm2K?: number;
  hAirOverrideWm2K?: number;
  foulingAirM2KW?: number;
  foulingRefM2KW?: number;
  calibration?: CoilCalibration | null;
}

export type CalibrationStatus = 'draft' | 'calibrated' | 'needs_review';

export interface CoilCalibration {
  /** Identificadores opcionais — preenchidos quando vem do banco. */
  id?: string;
  calibrationId?: string;
  componentId?: string;
  /** Identificação do motor que gerou a calibração. */
  engineName?: string;
  engineVersion?: string;
  /** Hash do modelo no momento da calibração. Bloqueia aplicação se mudar. */
  modelSignature?: string;
  /** Fatores de ajuste fino — todos no intervalo recomendado [0.7, 1.3]. */
  capacityCorrectionFactor?: number;
  airPressureDropFactor?: number;
  refrigerantPressureDropFactor?: number;
  heatTransferFactor?: number;
  /** Estado da calibração e confiança. */
  status?: CalibrationStatus;
  confidenceScore?: number;
  createdAt?: string;
}

export interface CoilCalculationResult {
  engine: 'hybrid_unilab_v1';
  mode: CoilMode;
  capacityW: number;
  capacityKcalh: number;
  uWm2K: number;
  hAirWm2K: number;
  hRefWm2K: number;
  effectiveAreaM2: number;
  frontalAreaM2: number;
  airPressureDropPa: number | null;
  refrigerantPressureDropKpa: number | null;
  dtmlK: number;
  correlationAir: string;
  correctionApplied: boolean;
  calibrationApplied: boolean;
  /** True quando havia calibração mas a assinatura não bate. */
  calibrationCompatible: boolean;
  calibrationId?: string;
  calibrationStatus?: CalibrationStatus;
  calibrationWarnings: string[];
  /** True quando faltam fatores Unilab ou geometria de catálogo. */
  isEstimated: boolean;
  modelSignature: string;
  warnings: string[];
  /** Resultado completo do cálculo geométrico (área frontal, externa, volume etc.). */
  geometryResult?: {
    frontalAreaM2: number;
    totalExternalAreaM2: number;
    internalTubeAreaM2: number;
    internalVolumeL: number;
    finEfficiency: number;
    finCount: number;
    totalTubeCount: number;
    totalTubeLengthM: number;
    qSpecificWm2: number;
    areaSource: 'calculated_geometry' | 'imported_unilab';
    areaDeviationPct?: number;
    volumeDeviationPct?: number;
  };
  debug: Record<string, any>;
}
