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
  rows: number;
  tubesPerRow: number;
  circuits: number;
  tubeMaterialConductivityWmK?: number;
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

export interface CoilCalculationInput {
  mode: CoilMode;
  geometry: GeometryInput;
  factors?: UnilabFactors;
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

export interface CoilCalibration {
  id?: string;
  modelSignature?: string;
  capacityCorrectionFactor?: number;
  airPressureDropFactor?: number;
  refrigerantPressureDropFactor?: number;
  heatTransferFactor?: number;
  confidenceScore?: number;
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
  /** True quando faltam fatores Unilab ou geometria de catálogo. */
  isEstimated: boolean;
  modelSignature: string;
  warnings: string[];
  debug: Record<string, unknown>;
}
