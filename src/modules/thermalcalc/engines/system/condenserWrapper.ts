// ColdPro — Wrapper do condensador. Usa o mesmo motor híbrido em modo 'condensation'.
import { simulateHybridCoil } from '../coil/internals/hybridCoilEngine';
import type { CoilCalculationInput, GeometryInput } from '../coil/internals/types';
import type { Refrigerant, SectionResult } from './systemTypes';
import { defaultGeometryFromCode } from './systemGeometryDefaults';

export interface CondenserRunInput {
  geometryCode: string;
  refrigerant: Refrigerant;
  airInletTempC: number;
  condensingTempC: number;
  airflowM3h: number;
  refrigerantMassFlowKgh: number;
}

export function runCondenser(input: CondenserRunInput): SectionResult {
  const geometry: GeometryInput = defaultGeometryFromCode(input.geometryCode, 'condensation');
  const calcInput: CoilCalculationInput = {
    mode: 'condensation',
    geometry,
    airInletTempC: input.airInletTempC,
    refTempC: input.condensingTempC,
    airflowM3h: input.airflowM3h,
    relativeHumidityPct: 50,
    wet: false,
    refrigerant: input.refrigerant,
    refrigerantMassFlowKgH: input.refrigerantMassFlowKgh,
  };
  const r = simulateHybridCoil(calcInput);

  const cpAir = 1005;
  const rhoAir = 1.2;
  const massFlowAirKgs = (input.airflowM3h / 3600) * rhoAir;
  const dT = massFlowAirKgs > 0 ? r.capacityW / (massFlowAirKgs * cpAir) : 0;
  const airOutletTempC = input.airInletTempC + dT;

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
