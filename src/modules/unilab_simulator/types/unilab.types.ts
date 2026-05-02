// Tipos estritos do módulo UNILAB Simulator.
// Não traduzir nomes de propriedades — devem casar com chaves dos JSONs UNILAB.

export type UnilabComponentType =
  | "evaporator_dx"
  | "evaporator_pumped"
  | "condenser_air"
  | "condenser_shell_tube"
  | "heating_coil"
  | "cooling_coil"
  | "defrost_steam_coil";

export interface CoilGeometryCatalogItem {
  id: string;
  name: string;
  tubePitchTransverseMm: number;
  tubePitchLongitudinalMm: number;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm?: number;
  defaultRows?: number;
  defaultCircuits?: number;
  uBaseWm2K?: number;
  raw: Record<string, unknown>;
}

export interface TubeMaterialItem {
  id: string;
  name: string;
  conductivityWmK: number;
}

export interface FinPitchItem {
  id: string;
  pitchMm: number;
  label?: string;
}

export interface FinThicknessItem {
  id: string;
  thicknessMm: number;
  label?: string;
}

export interface RefrigerantItem {
  id: string;
  name: string;
  kind: "pure" | "mixture";
  raw: Record<string, unknown>;
}

export interface AirVelocityCorrectionItem {
  geometryId: string;
  vMin: number;
  vMax: number;
  coefficients: number[]; // a0..a7
}

export interface PressureDropFanItem {
  geometryId: string;
  coefficients: number[];
  vMin?: number;
  vMax?: number;
}

export interface UnilabPhysicalInputs {
  componentType: UnilabComponentType;
  geometryId: string;
  finnedHeightMm: number;
  finnedLengthMm: number;
  rows: number;
  circuits: number;
  tubeMaterialId: string;
  finPitchMm: number;
  finThicknessMm: number;
  tubePitchTransverseMm: number;
  tubePitchLongitudinalMm: number;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
}

export interface UnilabThermoInputs {
  refrigerantId: string;
  airFlowM3H: number;
  airInletTempC: number;
  airInletRhPercent: number;
  altitudeM: number;
  evaporatingTempC?: number;
  condensingTempC?: number;
  superheatK?: number;
  subcoolingK?: number;
}

export interface UnilabSimulationResult {
  totalCapacityKw: number;
  sensibleCapacityKw: number;
  latentCapacityKw: number;
  shf: number;
  airPressureDropPa: number;
  fluidPressureDropKpa: number;
  airOutletTempC: number;
  airOutletRhPercent: number;
  faceAreaM2: number;
  faceVelocityMs: number;
  airMassFlowKgS: number;
  regime: "DRY" | "WET";
  lmtdK?: number;
  ntu?: number;
  effectiveness?: number;
  correctionFactor: number;
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CatalogLoadState {
  loading: boolean;
  ready: boolean;
  errors: Record<string, string>; // arquivo -> mensagem de erro
  missing: string[]; // arquivos que falharam ou não existem
}
