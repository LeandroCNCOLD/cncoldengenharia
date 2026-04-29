// Seletores de correlação (ar e refrigerante).
// Implementam a árvore de decisão descrita na Etapa 3.

import {
  calculateChangWangLouverHTC,
  calculatePlainFinHTC,
  calculateWangHerringboneHTC,
  calculateWetCorrection,
  calculateZhukauskasBareTubes,
} from './airCorrelations';
import {
  calculateCavalliniCondHTC,
  calculateDittusBoelterHTC,
  calculateGnielinskiHTC,
  calculateKandlikarEvapHTC,
  calculateLaminarRefHTC,
  calculateShahCondHTC,
  calculateShahEvapHTC,
} from './refrigerantCorrelations';
import type { CorrelationContext, CorrelationResult } from './correlationTypes';

export function selectAirCorrelation(ctx: CorrelationContext): CorrelationResult {
  let dry: CorrelationResult;
  switch (ctx.finType) {
    case 'louver':
      dry = calculateChangWangLouverHTC(ctx);
      break;
    case 'wavy':
    case 'herringbone':
      dry = calculateWangHerringboneHTC(ctx);
      break;
    case 'plain':
      dry = calculatePlainFinHTC(ctx);
      break;
    default:
      dry = calculateZhukauskasBareTubes(ctx);
  }

  if (!ctx.wet) return dry;

  const wet = calculateWetCorrection(ctx, dry.value);
  return {
    ...wet,
    warnings: [...dry.warnings, ...wet.warnings],
  };
}

export interface RefrigerantSelectorOptions {
  conductivityWmK?: number;
}

export function selectRefrigerantCorrelation(
  ctx: CorrelationContext,
  opts: RefrigerantSelectorOptions = {},
): CorrelationResult {
  const k = opts.conductivityWmK ?? 0.6;

  if (ctx.phase === 'two_phase_evaporation') {
    const shah = calculateShahEvapHTC(ctx);
    if (shah.value > 0) return shah;
    return calculateKandlikarEvapHTC(ctx);
  }

  if (ctx.phase === 'two_phase_condensation') {
    const shah = calculateShahCondHTC(ctx);
    if (shah.value > 0) return shah;
    return calculateCavalliniCondHTC(ctx);
  }

  // single-phase
  const Re = ctx.reynoldsRefrigerant;
  if (Re < 2300) return calculateLaminarRefHTC(ctx, k);
  if (Re < 10_000) return calculateGnielinskiHTC(ctx, k);
  return calculateDittusBoelterHTC(ctx, k);
}
