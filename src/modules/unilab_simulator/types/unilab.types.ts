// Tipos estritos do módulo UNILAB Simulator.
// Não traduzir nomes de propriedades — devem casar com chaves dos JSONs UNILAB.

export type UnilabComponentType =
  | "evaporator_dx"
  | "evaporator_pumped"
  | "condenser_air"
  | "condenser_shell_tube"
  | "heating_coil"
  | "cooling_coil"
  | "defrost_steam_coil"
  | "recuperator"
  | "shell_tube"
  | "chiller_unit";

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

export type HeaderPosition = "LL" | "LR" | "RL" | "RR" | "TB" | "BT";

export interface UnilabPhysicalInputs {
  componentType: UnilabComponentType;
  geometryId: string;
  finnedHeightMm: number;
  finnedLengthMm: number;
  /** Nº de tubos por fila — entrada direta do usuário (CN COILS). */
  tubesPerRow?: number;
  /** Nº de tubos não utilizados (CN COILS). */
  unusedTubes?: number;
  /** Nº de divisores (CN COILS). */
  dividers?: number;
  rows: number;
  circuits: number;
  tubeMaterialId: string;
  finPitchMm: number;
  finThicknessMm: number;
  tubePitchTransverseMm: number;
  tubePitchLongitudinalMm: number;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
  /** Posição do distribuidor / coletor (CN COILS — Etapa de circuitagem). */
  headerPosition?: HeaderPosition;
  /** Quando true, cada fila tem seu próprio passo de aleta (ver rowFinPitchesMm). */
  isVariableFinPitch?: boolean;
  /** Passos por fila — tamanho deve casar com `rows` quando isVariableFinPitch=true. */
  rowFinPitchesMm?: number[];
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
  A_fin_m2?: number;
  A_tube_bare_m2?: number;
  A_total_m2?: number;
  eta_fin?: number;
  surface_ratio?: number;
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
