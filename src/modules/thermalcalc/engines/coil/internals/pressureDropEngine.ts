import type { CoilCalculationInput } from './types';
import {
  selectAirPressureDropCorrelation,
  selectRefrigerantPressureDropCorrelation,
  type CorrelationContext,
} from '../correlations';

function buildAirCtx(
  input: CoilCalculationInput,
  airDensity: number,
  faceVelocity: number,
): CorrelationContext {
  const Dh = Math.max(0.002, Math.min(0.03, (input.geometry.finPitchMm / 1000) * 2.0));
  const Re = (airDensity * faceVelocity * Dh) / 1.8e-5;
  const phase =
    input.mode === 'condensation'
      ? 'two_phase_condensation'
      : input.mode === 'direct_expansion'
        ? 'two_phase_evaporation'
        : 'single_phase';
  return {
    coilType: input.mode === 'condensation' ? 'condenser' : 'evaporator',
    mode: input.mode,
    finType: (input.geometry.finType ?? 'unknown') as any,
    tubeType: input.geometry.tubeType ?? 'unknown',
    wet: Boolean(input.wet),
    phase,
    reynoldsAir: Re,
    reynoldsRefrigerant: 0,
    prandtlAir: 0.71,
    prandtlRefrigerant: 3,
    airVelocityMs: faceVelocity,
    refrigerantMassFluxKgM2s: 0,
    airDensityKgM3: airDensity,
    airViscosityPaS: 1.8e-5,
    airConductivityWmK: 0.025,
    airSpecificHeatJkgK: 1006,
    hydraulicDiameterAirM: Dh,
    tubeInnerDiameterM: input.geometry.tubeInnerDiameterMm / 1000,
    refrigerant: input.refrigerant,
    geometryCode: input.geometry.code,
  };
}

export function calculateAirPressureDrop(
  input: CoilCalculationInput,
  airDensity: number,
  faceVelocity: number,
) {
  if (!Number.isFinite(faceVelocity) || faceVelocity <= 0) return null;
  const ctx = buildAirCtx(input, airDensity, faceVelocity);
  const result = selectAirPressureDropCorrelation(ctx, { rows: input.geometry.rows });
  const f = input.factors ?? {};
  const slope = f.slopeFattoreAttrAria ?? 0;
  const baseFactor = ctx.wet
    ? (f.fattoreAttrAriaLatente ?? f.fattoreAttrAria ?? 1)
    : (f.fattoreAttrAria ?? 1);
  const factor = baseFactor + slope * (faceVelocity - 3.0);
  return result.value * factor;
}

export function calculateRefrigerantPressureDrop(input: CoilCalculationInput) {
  // contexto mínimo para o seletor monofásico/bifásico
  const tubeId = input.geometry.tubeInnerDiameterMm / 1000;
  const circuits = Math.max(1, input.geometry.circuits || 1);
  const sectionArea = (Math.PI * tubeId * tubeId) / 4;
  const mDotKgS = (input.refrigerantMassFlowKgH ?? 0) / 3600;
  const G = sectionArea > 0 && mDotKgS > 0 ? mDotKgS / (sectionArea * circuits) : 100;

  const ctx: CorrelationContext = {
    coilType: input.mode === 'condensation' ? 'condenser' : 'evaporator',
    mode: input.mode,
    finType: (input.geometry.finType ?? 'unknown') as any,
    tubeType: input.geometry.tubeType ?? 'unknown',
    wet: Boolean(input.wet),
    phase:
      input.mode === 'condensation'
        ? 'two_phase_condensation'
        : input.mode === 'direct_expansion'
          ? 'two_phase_evaporation'
          : 'single_phase',
    reynoldsAir: 0,
    reynoldsRefrigerant: (G * tubeId) / 200e-6,
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

  const result = selectRefrigerantPressureDropCorrelation(ctx);
  const f = input.factors ?? {};
  return result.value * (f.fatCorrFatAttr ?? 1);
}
