/**
 * Tipos para o módulo Row-by-Row do CN Coils.
 */

import type { CoilCycleInputs } from "../coil/coilCycleAdapter";

export interface RowByRowInputs {
  baseInputs: CoilCycleInputs;
  enabled: boolean;
}

export interface RowResult {
  rowIndex: number;
  airInletTempC: number;
  airOutletTempC: number;
  capacityW: number;
  overallU_WM2K: number;
  airPressureDropPa: number;
  airOutletHumidityRatio?: number;
}

export interface RowByRowResult {
  rows: RowResult[];
  totalCapacityW: number;
  sensibleCapacityW: number;
  airOutletTempC: number;
  totalAirPressureDropPa: number;
  averageU_WM2K: number;
  deviationFromGlobalPercent: number;
  warnings: string[];
  method: "row_by_row" | "global_fallback";
}
