import type { CoilCalculationInput } from './types';

export function calculateRefrigerantSide(input: CoilCalculationInput) {
  const f = input.factors ?? {};
  const base = input.hRefOverrideWm2K ?? (input.mode === 'condensation' ? 2200 : 1600);
  const velDelta = 0; // placeholder until mass flow and circuiting are fully wired
  const fatCoef = (f.fatCoeflattub ?? 1) + (f.slopeFatCoeflattub ?? 0) * velDelta;
  const hRef = base * fatCoef;

  return {
    hRefBaseWm2K: base,
    hRefWm2K: hRef,
    correlationRef: input.mode === 'condensation' ? 'ShahCond_fallback' : 'ShahEvap_fallback',
    factors: { fatCoeflattub: fatCoef },
  };
}
