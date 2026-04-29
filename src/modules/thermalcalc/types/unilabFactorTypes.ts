export type UnilabCalculationMode =
  | 'cooling'
  | 'heating'
  | 'condensing'
  | 'direct_expansion'
  | 'pump_evaporator'
  | 'steam';

export type UnilabGeometryFactor = {
  id?: string;
  mode: UnilabCalculationMode;
  geometryCode: string;
  batteryCode?: string;
  sigla?: string;
  description?: string;
  sourceTable: string;

  rowSpacingMm?: number;
  tubeSpacingMm?: number;
  tubeOuterDiameterMm?: number;
  tubeThicknessMm?: number;
  finThicknessMm?: number;
  finHeightMm?: number;
  tubeHeightMm?: number;
  tubeWidthMm?: number;

  fatCorAl: number;
  fatCoefLatoTubo: number;
  fatRidAumSup: number;
  fatCorrFatAttr: number;
  ridAreaPassTubo: number;
  fattoreAttrAria: number;
  fattoreAttrAriaLatente: number;
  slopeFatCorAl: number;
  slopeFatCoefLatoTubo: number;
  slopeFatCorrFatAttr: number;
  slopeFattoreAttrAria: number;
  securityFactor: number;
  factorA0: number;
  factorA1: number;
  factorA2: number;
  factorFatc: number;
  fattPdcConcentrate: number;

  raw: Record<string, unknown>;
};

export type CoilBaseResult = {
  capacityW?: number;
  capacityKcalh?: number;
  airPressureDropPa?: number;
  refrigerantPressureDropKpa?: number;
  uGlobalWm2K?: number;
  hAirWm2K?: number;
  hRefWm2K?: number;
  externalAreaM2?: number;
  internalAreaM2?: number;
  faceVelocityMs?: number;
  warnings?: string[];
  [key: string]: unknown;
};

export type FactorApplicationContext = {
  engine: 'empirical' | 'physical_simple' | 'physical_advanced';
  mode: UnilabCalculationMode;
  isWetCoil?: boolean;
  currentFaceVelocityMs?: number;
  nominalFaceVelocityMs?: number;
};

export type AppliedUnilabFactors = {
  heatTransferFactor: number;
  surfaceFactor: number;
  securityFactor: number;
  airPressureDropFactor: number;
  refrigerantPressureDropFactor: number;
  effectiveCapacityFactor: number;
  factorDetails: Record<string, number>;
  warnings: string[];
};
