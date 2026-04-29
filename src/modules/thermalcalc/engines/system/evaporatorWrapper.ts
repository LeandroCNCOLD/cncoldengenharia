// ColdPro — Wrapper do evaporador para o System Simulator.
// Usa o motor híbrido (simulateHybridCoil), garantindo que não há lógica duplicada.
import { simulateHybridCoil } from '../coil/internals/hybridCoilEngine';
import type { CoilCalculationInput, GeometryInput } from '../coil/internals/types';
import type { Refrigerant, SectionResult } from './systemTypes';
import { defaultGeometryFromCode } from './systemGeometryDefaults';

export interface EvaporatorRunInput {
  geometryCode: string;
  refrigerant: Refrigerant;
  airInletTempC: number;
  evaporatingTempC: number;
  airflowM3h: number;
  refrigerantMassFlowKgh: number;
  relativeHumidityPct?: number;
}

export function runEvaporator(input: EvaporatorRunInput): SectionResult {
  const geometry: GeometryInput = defaultGeometryFromCode(input.geometryCode, 'direct_expansion');
  const calcInput: CoilCalculationInput = {
    mode: 'direct_expansion',
    geometry,
    airInletTempC: input.airInletTempC,
    refTempC: input.evaporatingTempC,
    airflowM3h: input.airflowM3h,
    relativeHumidityPct: input.relativeHumidityPct ?? 85,
    wet: (input.relativeHumidityPct ?? 85) >= 70,
    refrigerant: input.refrigerant,
    refrigerantMassFlowKgH: input.refrigerantMassFlowKgh,
  };
  const r = simulateHybridCoil(calcInput);

  // Estimativa de Tar saída pelo balanço sensível (ar seco aprox).
  const cpAir = 1005; // J/kg·K
  const rhoAir = 1.2; // kg/m³
  const massFlowAirKgs = (input.airflowM3h / 3600) * rhoAir;
  const dT = massFlowAirKgs > 0 ? r.capacityW / (massFlowAirKgs * cpAir) : 0;
  const airOutletTempC = input.airInletTempC - dT;

  return {
    capacityW: r.capacityW,
    uWm2K: r.uWm2K,
    hAirWm2K: r.hAirWm2K,
    hRefWm2K: r.hRefWm2K,
    airOutletTempC,
    effectiveAreaM2: r.effectiveAreaM2,
    warnings: r.warnings,
  };
}
