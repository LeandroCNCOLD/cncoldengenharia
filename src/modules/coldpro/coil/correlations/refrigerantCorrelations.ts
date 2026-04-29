// Correlações lado refrigerante.
// Monofásicas (Dittus-Boelter, Gnielinski) são funcionais.
// Bifásicas iniciam como aproximação controlada com warning.

import type { CorrelationContext, CorrelationResult } from './correlationTypes';

/** Dittus–Boelter (Re > 10 000). */
export function calculateDittusBoelterHTC(
  ctx: CorrelationContext,
  conductivityWmK = 0.6,
): CorrelationResult {
  const Re = Math.max(ctx.reynoldsRefrigerant, 1);
  const Pr = Math.max(ctx.prandtlRefrigerant, 0.1);
  const heatingExp = ctx.coilType === 'condenser' ? 0.3 : 0.4;
  const Nu = 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, heatingExp);
  const h = (Nu * conductivityWmK) / Math.max(ctx.tubeInnerDiameterM, 1e-4);
  return {
    correlationName: 'DittusBoelter',
    group: 'ref_single_phase',
    value: h,
    confidence: Re > 1e4 ? 0.8 : 0.6,
    isEstimated: Re < 1e4,
    warnings: Re < 1e4 ? ['Dittus-Boelter fora da faixa Re>10⁴.'] : [],
  };
}

/** Gnielinski — válido 3 000 < Re < 5×10⁶. */
export function calculateGnielinskiHTC(
  ctx: CorrelationContext,
  conductivityWmK = 0.6,
): CorrelationResult {
  const Re = Math.max(ctx.reynoldsRefrigerant, 1);
  const Pr = Math.max(ctx.prandtlRefrigerant, 0.1);
  const f = Math.pow(0.79 * Math.log(Re) - 1.64, -2);
  const num = (f / 8) * (Re - 1000) * Pr;
  const den = 1 + 12.7 * Math.sqrt(f / 8) * (Math.pow(Pr, 2 / 3) - 1);
  const Nu = num / Math.max(den, 1e-3);
  const h = (Nu * conductivityWmK) / Math.max(ctx.tubeInnerDiameterM, 1e-4);
  return {
    correlationName: 'Gnielinski',
    group: 'ref_single_phase',
    value: h,
    confidence: Re >= 3000 && Re <= 5e6 ? 0.85 : 0.65,
    isEstimated: !(Re >= 3000 && Re <= 5e6),
    warnings: Re < 3000 ? ['Gnielinski fora da faixa Re>3000.'] : [],
  };
}

/** Laminar interno (Re < 2300) — Nu = 4.36 (fluxo de calor constante). */
export function calculateLaminarRefHTC(
  ctx: CorrelationContext,
  conductivityWmK = 0.6,
): CorrelationResult {
  const h = (4.36 * conductivityWmK) / Math.max(ctx.tubeInnerDiameterM, 1e-4);
  return {
    correlationName: 'LaminarInternal',
    group: 'ref_single_phase',
    value: h,
    confidence: 0.7,
    isEstimated: false,
    warnings: ['Regime laminar — h baixo é esperado.'],
  };
}

/** Shah evaporação — aproximação controlada. */
export function calculateShahEvapHTC(ctx: CorrelationContext): CorrelationResult {
  // Para evaporador típico (R-404A/R-134a) h ~ 1500–4000 W/m²K com fator de massa.
  const G = Math.max(ctx.refrigerantMassFluxKgM2s, 50);
  const base = 1500 + 8 * Math.min(G, 400); // 1500..4700
  return {
    correlationName: 'ShahEvap',
    group: 'ref_two_phase_evap',
    value: base,
    confidence: 0.6,
    isEstimated: true,
    warnings: ['Shah evaporação simplificada — implementar versão completa para alta precisão.'],
  };
}

/** Kandlikar evaporação — fallback de Shah. */
export function calculateKandlikarEvapHTC(ctx: CorrelationContext): CorrelationResult {
  const G = Math.max(ctx.refrigerantMassFluxKgM2s, 50);
  const base = 1700 + 7 * Math.min(G, 400);
  return {
    correlationName: 'KandlikarEvap',
    group: 'ref_two_phase_evap',
    value: base,
    confidence: 0.55,
    isEstimated: true,
    warnings: ['Kandlikar simplificado.'],
  };
}

/** Shah condensação — aproximação controlada. */
export function calculateShahCondHTC(ctx: CorrelationContext): CorrelationResult {
  const G = Math.max(ctx.refrigerantMassFluxKgM2s, 50);
  const base = 2000 + 10 * Math.min(G, 400); // 2000..6000
  return {
    correlationName: 'ShahCond',
    group: 'ref_two_phase_cond',
    value: base,
    confidence: 0.6,
    isEstimated: true,
    warnings: ['Shah condensação simplificada.'],
  };
}

/** Cavallini condensação — alternativa de Shah. */
export function calculateCavalliniCondHTC(ctx: CorrelationContext): CorrelationResult {
  const G = Math.max(ctx.refrigerantMassFluxKgM2s, 50);
  const base = 2200 + 9 * Math.min(G, 400);
  return {
    correlationName: 'CavalliniCondensation',
    group: 'ref_two_phase_cond',
    value: base,
    confidence: 0.6,
    isEstimated: true,
    warnings: ['Cavallini simplificado.'],
  };
}
