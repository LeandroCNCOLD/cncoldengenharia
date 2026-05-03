/**
 * Tipos para a Análise de Incerteza do motor CN Coils.
 */

export interface CorrelationUncertainty {
  h_air_relative: number;
  dp_air_relative: number;
  h_fluid_relative: number;
  refrigerant_props_relative: number;
  fin_efficiency_relative: number;
  contact_resistance_relative: number;
}

export interface UncertaintyConfig {
  samples: number;
  confidenceLevel: number;
  seed: number;
  correlationUncertainties: CorrelationUncertainty;
}

export interface UncertaintyBand {
  nominal: number;
  lower: number;
  upper: number;
  stdDev: number;
  confidenceLevel: number;
}

export interface UncertaintyResult {
  totalCapacityW: UncertaintyBand;
  sensibleCapacityW: UncertaintyBand;
  airPressureDropPa: UncertaintyBand;
  overallU_WM2K: UncertaintyBand;
  COP?: UncertaintyBand;
  EER?: UncertaintyBand;
  samplesUsed: number;
  computeTimeMs: number;
  warnings: string[];
}
