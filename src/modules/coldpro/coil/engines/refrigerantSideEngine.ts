import type { CoilCalculationInput } from './types';
import {
  selectRefrigerantCorrelation,
  type CorrelationContext,
  type CorrelationResult,
} from '../correlations';

function buildContext(input: CoilCalculationInput): CorrelationContext {
  const phase =
    input.mode === 'condensation'
      ? 'two_phase_condensation'
      : input.mode === 'direct_expansion'
        ? 'two_phase_evaporation'
        : 'single_phase';
  const coilType = input.mode === 'condensation' ? 'condenser' : 'evaporator';
  const tubeId = input.geometry.tubeInnerDiameterMm / 1000;

  // estimativa simples do mass flux quando há vazão e circuitos
  const circuits = Math.max(1, input.geometry.circuits || 1);
  const sectionArea = (Math.PI * tubeId * tubeId) / 4;
  const mDotKgS = (input.refrigerantMassFlowKgH ?? 0) / 3600;
  const G = sectionArea > 0 && mDotKgS > 0 ? mDotKgS / (sectionArea * circuits) : 0;

  // Re refrigerante (proxy): assume viscosidade ~ 200 µPa·s
  const Re = G > 0 ? (G * tubeId) / 200e-6 : 0;

  return {
    coilType,
    mode: input.mode,
    finType: (input.geometry.finType ?? 'unknown') as any,
    tubeType: input.geometry.tubeType ?? 'unknown',
    wet: Boolean(input.wet),
    phase,
    reynoldsAir: 0,
    reynoldsRefrigerant: Re,
    prandtlAir: 0.71,
    prandtlRefrigerant: 3,
    airVelocityMs: 0,
    refrigerantMassFluxKgM2s: G,
    airDensityKgM3: 1.2,
    airViscosityPaS: 1.8e-5,
    airConductivityWmK: 0.025,
    airSpecificHeatJkgK: 1006,
    hydraulicDiameterAirM: 0.005,
    tubeInnerDiameterM: tubeId,
    refrigerant: input.refrigerant,
    geometryCode: input.geometry.code,
  };
}

export function calculateRefrigerantSide(input: CoilCalculationInput) {
  const f = input.factors ?? {};
  let correlation: CorrelationResult;
  if (input.hRefOverrideWm2K) {
    correlation = {
      correlationName: 'manual_h_ref',
      group: 'ref_override',
      value: input.hRefOverrideWm2K,
      confidence: 1,
      isEstimated: false,
      warnings: ['h_ref manual fornecido pelo usuário.'],
    };
  } else {
    correlation = selectRefrigerantCorrelation(buildContext(input));
  }

  const fatCoef = f.fatCoeflattub ?? 1;
  const hRefBase = correlation.value;
  const hRefFinal = hRefBase * fatCoef;

  return {
    hRefBaseWm2K: hRefBase,
    hRefWm2K: hRefFinal,
    correlationRef: correlation.correlationName,
    refCorrelationConfidence: correlation.confidence,
    refCorrelationWarnings: correlation.warnings,
    refCorrelationIsEstimated: correlation.isEstimated,
    factors: { fatCoeflattub: fatCoef },
  };
}
