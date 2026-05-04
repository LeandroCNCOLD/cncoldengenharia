/**
 * Tipos do CycleEngine v1.
 * Sistema de refrigeração simples: compressor -> condensador -> válvula -> evaporador.
 */

import type { CoilCycleInputs } from "../coil/coilCycleAdapter";
import type { CompressorRecord } from "../compressor/compressorModel";
import type {
  ExpansionDeviceConfig,
  ExpansionDeviceInput,
  ExpansionDeviceResult,
  ExpansionDeviceType,
} from "../expansion/expansionTypes";

export interface CycleExpansionDeviceConfig
  extends Partial<
    Omit<ExpansionDeviceInput, "evaporatingTempC" | "condensingTempC" | "refrigerantId">
  > {
  /** Formato legado usado antes do motor de expansão ativo. */
  type?: Exclude<ExpansionDeviceType, "none">;
  superheatTarget_K?: number;
  capillaryLength_m?: number;
  /** Configuração completa do novo módulo de expansão. */
  device?: ExpansionDeviceConfig;
}

export interface CycleSystemConfig {
  id: string;
  name: string;
  refrigerantId: string;
  compressor: CompressorRecord;
  evaporator: Omit<
    CoilCycleInputs,
    "evaporatingTempC" | "condensingTempC" | "refrigerantMassFlowKgS" | "componentType" | "refrigerantId"
  >;
  condenser: Omit<
    CoilCycleInputs,
    "evaporatingTempC" | "condensingTempC" | "refrigerantMassFlowKgS" | "componentType" | "refrigerantId"
  >;
  expansionDevice: CycleExpansionDeviceConfig;
  solver?: {
    Te_initial_C?: number;
    Tc_initial_C?: number;
    tolerance?: number;
    maxIterations?: number;
    relaxation?: number;
  };
}

export interface CycleStatePoint {
  T_C: number;
  P_kPa: number;
  h_kJkg: number;
  s_kJkgK: number;
  quality: number;
  phase: "liquid" | "vapor" | "two_phase" | "superheated" | "subcooled";
}

export interface CycleResult {
  converged: boolean;
  iterations: number;
  residual: number;
  Te_C: number;
  Tc_C: number;
  m_dot_kgS: number;
  Q_evap_W: number;
  Q_cond_W: number;
  W_comp_W: number;
  COP: number;
  EER: number;
  statePoints: {
    point1_evapOut: CycleStatePoint;
    point2_compOut: CycleStatePoint;
    point3_condOut: CycleStatePoint;
    point4_valveOut: CycleStatePoint;
  };
  evaporatorResult: {
    totalCapacityW: number;
    sensibleCapacityW: number;
    latentCapacityW: number;
    airOutletTempC: number;
    airOutletRH: number;
    airPressureDropPa: number;
    fluidPressureDropKPa: number;
    overallU_WM2K: number;
    safetyFactor: number;
  };
  condenserResult: {
    totalCapacityW: number;
    airOutletTempC: number;
    airPressureDropPa: number;
    fluidPressureDropKPa: number;
    overallU_WM2K: number;
  };
  compressorResult: {
    Q_evap_W: number;
    W_comp_W: number;
    COP: number;
    compressionRatio: number;
    mode: string;
  };
  expansionDevice?: ExpansionDeviceResult;
  inletQuality?: number;
  warnings: string[];
}

export interface CycleThermoConfig {
  refrigerantId: string;
  Te_C: number;
  Tc_C: number;
  superheatK: number;
  subcoolingK: number;
}

export interface CycleThermoResult {
  Te_C: number;
  Tc_C: number;
  h1_kJkg: number;
  h2_kJkg: number;
  h3_kJkg: number;
  h4_kJkg: number;
  qEvap_kJkg: number;
  wComp_kJkg: number;
  qCond_kJkg: number;
  COP: number;
  EER: number;
  warnings: string[];
}
