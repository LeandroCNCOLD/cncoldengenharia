/**
 * Tipos do CoilAssembly — múltiplos trocadores em série ou paralelo.
 */

import type { CoilCycleInputs, CoilCycleResult } from "../coil/coilCycleAdapter";

export interface CoilAssemblyUnit {
  id: string;
  name: string;
  position: number;
  coilInputs: Omit<
    CoilCycleInputs,
    | "airInletTempC"
    | "airRelativeHumidity"
    | "evaporatingTempC"
    | "condensingTempC"
    | "refrigerantMassFlowKgS"
    | "refrigerantId"
    | "componentType"
    | "superheatK"
    | "subcoolingK"
  >;
  airFlowFraction?: number;
  refrigerantFlowFraction?: number;
  vbankAngleDeg?: number;
}

export type AssemblyArrangement =
  | "single"
  | "series_air"
  | "parallel_air"
  | "parallel_refrigerant"
  | "vbank";

export interface CoilAssemblyConfig {
  id: string;
  name: string;
  arrangement: AssemblyArrangement;
  coils: CoilAssemblyUnit[];
  airInlet: {
    tempC: number;
    relativeHumidity: number;
    totalFlowM3H: number;
  };
  refrigerant: {
    id: string;
    evaporatingTempC?: number;
    condensingTempC?: number;
    totalMassFlowKgS: number;
    superheatK: number;
    subcoolingK: number;
  };
  componentType: "evaporator" | "condenser";
}

export interface CoilAssemblyUnitResult {
  unitId: string;
  unitName: string;
  position: number;
  coilResult: CoilCycleResult;
  airInletTempC: number;
  airInletRH: number;
  airOutletTempC: number;
  airOutletRH: number;
  airFlowFraction: number;
  refrigerantFlowFraction: number;
}

export interface CoilAssemblyResult {
  converged: boolean;
  arrangement: AssemblyArrangement;
  units: CoilAssemblyUnitResult[];
  totals: {
    totalCapacityW: number;
    sensibleCapacityW: number;
    latentCapacityW: number;
    airOutletTempC: number;
    airOutletRH: number;
    maxAirPressureDropPa: number;
    totalAirPressureDropPa: number;
    maxFluidPressureDropKPa: number;
    minSafetyFactor: number;
    weightedOverallU_WM2K: number;
  };
  warnings: string[];
}
