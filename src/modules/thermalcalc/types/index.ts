export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationWarning {
  code: string;
  severity: ValidationSeverity;
  message: string;
  path?: string;
}

export interface TubeGeometry {
  outerDiameterMm: number;
  wallThicknessMm?: number;
  innerDiameterMm?: number;
  usefulLengthMm: number;
  rows: number;
  tubesPerRow: number;
  circuits: number;
  skippedTubes?: number;
  tubePitchMm?: number;
  rowPitchMm?: number;
  material?: string;
}

export type FinSurfaceType = "plain" | "louver" | "wavy" | "herringbone";

export interface FinGeometry {
  finPitchMm: number;
  finThicknessMm?: number;
  surfaceType?: FinSurfaceType;
  finnedHeightMm?: number;
  finnedDepthMm?: number;
  louverPitchMm?: number;
  louverAngleDeg?: number;
  material?: string;
}

export interface CoilGeometryInput {
  tube: TubeGeometry;
  fin: FinGeometry;
  unilabExchangeAreaM2?: number;
  unilabInternalVolumeL?: number;
}

export type GeometrySource = "calculated" | "imported_unilab" | "fitted";
export type GeometryMode = "calculated" | "geometry_from_unilab";

export interface GeometryFitResult {
  geometrySource: GeometrySource;
  geometryMode: GeometryMode;
  totalTubes: number;
  tubesPerRow: number;
  rows: number;
  circuits: number;
  effectiveTubeLengthM: number;
  totalTubeLengthM: number;
  internalVolumeM3: number;
  internalVolumeL: number;
  externalAreaM2: number;
  externalTubeAreaM2: number;
  externalFinAreaM2: number;
  areaDeviationPct: number;
  volumeDeviationPct: number;
  warnings: ValidationWarning[];
}

export interface CoilGeometryResult {
  geometrySource: GeometrySource;
  geometryMode: GeometryMode;
  innerDiameterM: number;
  outerDiameterM: number;
  totalTubes: number;
  tubesPerRow: number;
  rows: number;
  circuits: number;
  effectiveTubeLengthM: number;
  totalTubeLengthM: number;
  internalAreaM2: number;
  externalTubeAreaM2: number;
  externalFinAreaM2: number;
  externalAreaM2: number;
  effectiveExternalAreaM2: number;
  finEfficiency: number;
  overallSurfaceEfficiency: number;
  internalVolumeM3: number;
  internalVolumeL: number;
  finCount: number;
  frontalAreaM2: number | null;
  finnedDepthM: number | null;
  freeFlowAreaM2: number | null;
  minimumFlowAreaM2: number | null;
  hydraulicDiameterAirM: number | null;
  unilabExchangeAreaM2?: number;
  unilabInternalVolumeL?: number;
  areaDeviationPct?: number;
  volumeDeviationPct?: number;
  fittedGeometry?: GeometryFitResult;
  warnings: ValidationWarning[];
}

export interface RefrigerantDensityPoint {
  referenceTemperatureC: number;
  densityKgM3: number;
}

export interface RefrigerantPropertyPoint {
  temperatureC: number;
  densityKgM3: number;
  cpJKgK: number;
  viscosityPaS: number;
  thermalConductivityWmK: number;
  liquidDensityKgM3?: number;
  vaporDensityKgM3?: number;
  latentHeatJKg?: number;
}

export interface RefrigerantFluid {
  code: string;
  name: string;
  densityPoints: RefrigerantDensityPoint[];
  propertyPoints: RefrigerantPropertyPoint[];
  defaultFillFactor: number;
}

export interface RefrigerantChargeResult {
  refrigerantCode: string;
  referenceTemperatureC: number;
  densityKgM3: number;
  fillFactor: number;
  internalVolumeM3: number;
  massKg: number;
  warnings: ValidationWarning[];
}

export interface AirSideInput {
  volumeFlowM3H?: number;
  massFlowKgS?: number;
  faceVelocityMS?: number;
  densityKgM3?: number;
  cpJKgK?: number;
  viscosityPaS?: number;
  thermalConductivityWmK?: number;
}

export type RefrigerantHeatTransferCorrelation =
  | "dittus_boelter"
  | "gnielinski"
  | "shah_evaporation"
  | "condensation_base";

export interface RefrigerantSideInput {
  code?: string;
  massFlowKgS?: number;
  massFluxKgM2S?: number;
  inletTemperatureC?: number;
  outletTemperatureC?: number;
  saturationTemperatureC?: number;
  quality?: number;
  correlation?: RefrigerantHeatTransferCorrelation;
}

export interface EffectiveAreaResult {
  externalTubeAreaM2: number;
  externalFinAreaM2: number;
  totalExternalAreaM2: number;
  effectiveAreaM2: number;
  finEfficiency: number;
  overallSurfaceEfficiency: number;
  finCount: number;
  warnings: ValidationWarning[];
}

export interface HeatTransferInput {
  geometry: CoilGeometryInput;
  airInletTemperatureC: number;
  airOutletTemperatureC?: number;
  refrigerantTemperatureC: number;
  refrigerantOutletTemperatureC?: number;
  overallHeatTransferCoefficientWm2K?: number;
  effectiveAreaFactor?: number;
  air?: AirSideInput;
  refrigerant?: RefrigerantSideInput;
}

export interface HeatTransferResult {
  deltaTemperatureK: number;
  logMeanTemperatureDifferenceK: number;
  airHeatTransferCoefficientWm2K: number;
  refrigerantHeatTransferCoefficientWm2K: number;
  overallHeatTransferCoefficientWm2K: number;
  effectiveAreaM2: number;
  capacityW: number;
  capacityKcalh: number;
  airPressureDropPa: number;
  refrigerantPressureDropPa: number;
  airCorrelation: string;
  refrigerantCorrelation: string;
  geometry: CoilGeometryResult;
  effectiveArea: EffectiveAreaResult;
  warnings: ValidationWarning[];
}

export interface ThermalCalcInput {
  geometry: CoilGeometryInput;
  refrigerantCode?: string;
  referenceTemperatureC?: number;
  fillFactor?: number;
  heatTransfer?: Omit<HeatTransferInput, "geometry">;
}

export interface ThermalCalcResult {
  geometry: CoilGeometryResult;
  refrigerantCharge: RefrigerantChargeResult | null;
  heatTransfer: HeatTransferResult | null;
  warnings: ValidationWarning[];
}
