/**
 * Tipos para o Mapa de Operação do CN Coils.
 */

export interface OperatingMapConfig {
  evapTempRange: { min: number; max: number; step: number };
  condensingTemps: number[];
  airInletTempC: number;
  airFlowM3H: number;
  designPoint?: {
    evapTempC: number;
    condensingTempC: number;
    capacityW: number;
  };
}

export interface OperatingMapPoint {
  evapTempC: number;
  condensingTempC: number;
  capacityW: number;
  copSystem: number;
  airOutletTempC: number;
  warnings: string[];
}

export interface OperatingMapCurve {
  condensingTempC: number;
  points: OperatingMapPoint[];
  color: string;
}

export interface OperatingMapResult {
  curves: OperatingMapCurve[];
  designPoint?: OperatingMapPoint;
  xRange: { min: number; max: number };
  yRange: { min: number; max: number };
  computeTimeMs: number;
  warnings: string[];
}
