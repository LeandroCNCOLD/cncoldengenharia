import type { CoilCalculationInput, FinType } from './types';
import {
  selectAirCorrelation,
  type CorrelationContext,
  type CorrelationResult,
} from '../correlations';

export function getAirProperties(Tc: number) {
  const Tk = Tc + 273.15;
  return {
    density: 1.2929 * (273.15 / Tk),
    viscosity: (1.458e-6 * Math.pow(Tk, 1.5)) / (Tk + 110.4),
    specificHeat: 1006.0 + 0.0217 * Tc,
    conductivity: 0.02442 + 7.18e-5 * Tc,
    prandtl: 0.71,
  };
}

function hydraulicDiameterM(input: CoilCalculationInput): number {
  const g = input.geometry;
  return Math.max(0.002, Math.min(0.03, (g.finPitchMm / 1000) * 2.0));
}

function buildContext(
  input: CoilCalculationInput,
  faceVelocity: number,
  props: ReturnType<typeof getAirProperties>,
): CorrelationContext {
  const Dh = hydraulicDiameterM(input);
  const Re = (props.density * faceVelocity * Dh) / Math.max(props.viscosity, 1e-9);
  const phase =
    input.mode === 'condensation'
      ? 'two_phase_condensation'
      : input.mode === 'direct_expansion'
        ? 'two_phase_evaporation'
        : 'single_phase';
  const coilType = input.mode === 'condensation' ? 'condenser' : 'evaporator';
  return {
    coilType,
    mode: input.mode,
    finType: (input.geometry.finType ?? 'unknown') as FinType,
    tubeType: input.geometry.tubeType ?? 'unknown',
    wet: Boolean(input.wet),
    phase,
    reynoldsAir: Re,
    reynoldsRefrigerant: 0,
    prandtlAir: props.prandtl,
    prandtlRefrigerant: 3,
    airVelocityMs: faceVelocity,
    refrigerantMassFluxKgM2s: 0,
    airDensityKgM3: props.density,
    airViscosityPaS: props.viscosity,
    airConductivityWmK: props.conductivity,
    airSpecificHeatJkgK: props.specificHeat,
    hydraulicDiameterAirM: Dh,
    tubeInnerDiameterM: input.geometry.tubeInnerDiameterMm / 1000,
    refrigerant: input.refrigerant,
    geometryCode: input.geometry.code,
  };
}

export function calculateAirSide(input: CoilCalculationInput, frontalAreaM2: number) {
  const meanAirTemp = (input.airInletTempC + (input.airOutletTempC ?? input.airInletTempC - 5)) / 2;
  const props = getAirProperties(meanAirTemp);
  const faceVelocity = frontalAreaM2 > 0 ? input.airflowM3h / 3600 / frontalAreaM2 : 0;

  let correlation: CorrelationResult;
  if (input.hAirOverrideWm2K) {
    correlation = {
      correlationName: 'manual_h_air',
      group: 'air_override',
      value: input.hAirOverrideWm2K,
      confidence: 1,
      isEstimated: false,
      warnings: ['h_air manual fornecido pelo usuário.'],
    };
  } else {
    const ctx = buildContext(input, faceVelocity, props);
    correlation = selectAirCorrelation(ctx);
  }

  const f = input.factors ?? {};
  const velDelta = faceVelocity - 3.0;
  const fatCorAl = (f.fatCorAl ?? 1) + (f.slopeFatCorAl ?? 0) * velDelta;
  const fatRidAumSup = f.fatRidAumSup ?? 1;
  const hAirBase = correlation.value;
  const hAirFinal = hAirBase * fatCorAl * fatRidAumSup;

  return {
    ...props,
    faceVelocityMs: faceVelocity,
    hAirBaseWm2K: hAirBase,
    hAirWm2K: hAirFinal,
    reynoldsAir: (props.density * faceVelocity * hydraulicDiameterM(input)) / Math.max(props.viscosity, 1e-9),
    correlationAir: correlation.correlationName,
    airCorrelationConfidence: correlation.confidence,
    airCorrelationWarnings: correlation.warnings,
    airCorrelationIsEstimated: correlation.isEstimated,
    factors: { fatCorAl, fatRidAumSup },
  };
}
