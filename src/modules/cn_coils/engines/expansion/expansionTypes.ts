/**
 * Tipos para o módulo de Dispositivo de Expansão do CycleEngine CN Coils.
 *
 * Modos de operação:
 * - disabled: válvula não participa do cálculo; m_dot definido pelo compressor
 * - passive: valida capacidade, faixa e deltaP disponível sem controlar o sistema
 * - active: participa do solver; controla SH e limita m_dot
 */

export type ExpansionDeviceType =
  | "txv"
  | "eev"
  | "capillary"
  | "fixed_orifice"
  | "none";

export type ExpansionMode = "disabled" | "passive" | "active";

export interface TXVConfig {
  type: "txv";
  nominalCapacityW: number;
  refrigerantId: string;
  nominalDeltaPressureKPa: number;
  superheatTargetK: number;
  superheatMinK: number;
  superheatMaxK: number;
  springConstantKPaPerK: number;
  kvNominal?: number;
}

export interface EEVConfig {
  type: "eev";
  openingFraction: number;
  orificeDiameterMm: number;
  dischargeCoefficient: number;
  superheatTargetK: number;
  controlToleranceK: number;
}

export interface CapillaryConfig {
  type: "capillary";
  lengthM: number;
  internalDiameterMm: number;
  relativeRoughness?: number;
}

export interface FixedOrificeConfig {
  type: "fixed_orifice";
  orificeDiameterMm: number;
  dischargeCoefficient: number;
}

export type ExpansionDeviceConfig =
  | TXVConfig
  | EEVConfig
  | CapillaryConfig
  | FixedOrificeConfig;

export interface ExpansionDeviceInput {
  mode: ExpansionMode;
  device?: ExpansionDeviceConfig;
  evaporatingTempC: number;
  condensingTempC: number;
  subcoolingK: number;
  actualSuperheatK?: number;
  refrigerantId: string;
}

export interface ExpansionDeviceResult {
  mode: ExpansionMode;
  deviceType: ExpansionDeviceType;
  inletQuality: number;
  inletEnthalpyKJkg: number;
  condenserOutletEnthalpyKJkg: number;
  massFlowKgS: number | null;
  availableDeltaPressureKPa: number;
  effectiveOpening: number | null;
  superheatTargetK: number | null;
  validation: {
    capacityOk: boolean;
    pressureRangeOk: boolean;
    superheatViable: boolean;
    operatingRangeOk: boolean;
  };
  warnings: string[];
  converged: boolean;
  iterations: number;
}
