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

export interface FinGeometry {
  finPitchMm: number;
  finThicknessMm?: number;
  finnedHeightMm?: number;
  finnedDepthMm?: number;
  material?: string;
}

export interface CoilGeometryInput {
  tube: TubeGeometry;
  fin: FinGeometry;
}

export interface CoilGeometryResult {
  innerDiameterM: number;
  totalTubes: number;
  totalTubeLengthM: number;
  internalAreaM2: number;
  externalTubeAreaM2: number;
  externalFinAreaM2: number;
  externalAreaM2: number;
  internalVolumeM3: number;
  internalVolumeL: number;
  finCount: number;
  frontalAreaM2: number | null;
  finnedDepthM: number | null;
  warnings: ValidationWarning[];
}

export interface RefrigerantDensityPoint {
  referenceTemperatureC: number;
  densityKgM3: number;
}

export interface RefrigerantFluid {
  code: string;
  name: string;
  densityPoints: RefrigerantDensityPoint[];
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

export interface HeatTransferInput {
  geometry: CoilGeometryInput;
  airInletTemperatureC: number;
  refrigerantTemperatureC: number;
  overallHeatTransferCoefficientWm2K?: number;
  effectiveAreaFactor?: number;
}

export interface HeatTransferResult {
  deltaTemperatureK: number;
  overallHeatTransferCoefficientWm2K: number;
  effectiveAreaM2: number;
  capacityW: number;
  capacityKcalh: number;
  geometry: CoilGeometryResult;
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
