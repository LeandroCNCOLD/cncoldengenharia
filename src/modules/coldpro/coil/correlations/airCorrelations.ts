// Correlações lado ar (HTC).
// Versões simplificadas mas estruturadas — todas seguem o mesmo
// CorrelationResult para que o seletor possa trocar livremente.

import type { CorrelationContext, CorrelationResult } from './correlationTypes';

function nuFromJ(j: number, ctx: CorrelationContext): number {
  // h = j × ρ × V × cp / Pr^(2/3)  → equivalente Colburn
  const h =
    (j * ctx.airDensityKgM3 * ctx.airVelocityMs * ctx.airSpecificHeatJkgK) /
    Math.pow(Math.max(ctx.prandtlAir, 0.1), 2 / 3);
  return h;
}

/** Chang & Wang (1997) — louver fin, simplificado. */
export function calculateChangWangLouverHTC(ctx: CorrelationContext): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  // j ≈ 0.026 Re^-0.4 ajustado para louver (faixa 100–3000).
  const j = 0.026 * Math.pow(Re, -0.4);
  return {
    correlationName: 'ChangWangLouverHTC',
    group: 'air_dry_louver',
    value: nuFromJ(j, ctx),
    confidence: 0.78,
    isEstimated: false,
    warnings: [],
  };
}

/** Wang–Fu–Chang — wavy / herringbone fin. */
export function calculateWangHerringboneHTC(ctx: CorrelationContext): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  const Pr = Math.max(ctx.prandtlAir, 0.1);
  // Nu = 0.27 Re^0.63 Pr^0.36 — herringbone aproximado.
  const Nu = 0.27 * Math.pow(Re, 0.63) * Math.pow(Pr, 0.36);
  const h = (Nu * ctx.airConductivityWmK) / Math.max(ctx.hydraulicDiameterAirM, 1e-4);
  return {
    correlationName: 'WangFuChangWavyHerringbone',
    group: 'air_dry_wavy',
    value: h,
    confidence: 0.75,
    isEstimated: false,
    warnings: [],
  };
}

/** Wang–Chi–Chang — plate fin (plain). */
export function calculatePlainFinHTC(ctx: CorrelationContext): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  const j = 0.0149 * Math.pow(Re, -0.385);
  return {
    correlationName: 'WangChiChangPlateFinHTC',
    group: 'air_dry_plain',
    value: nuFromJ(j, ctx),
    confidence: 0.72,
    isEstimated: false,
    warnings: [],
  };
}

/** Tubos sem aleta — Zhukauskas. Fallback estrutural. */
export function calculateZhukauskasBareTubes(ctx: CorrelationContext): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  const Pr = Math.max(ctx.prandtlAir, 0.1);
  // Faixa staggered, 1000–2e5: Nu ≈ 0.35 Re^0.6 Pr^0.36.
  const Nu = 0.35 * Math.pow(Re, 0.6) * Math.pow(Pr, 0.36);
  const h = (Nu * ctx.airConductivityWmK) / Math.max(ctx.hydraulicDiameterAirM, 1e-4);
  return {
    correlationName: 'ZhukauskasBareTubes',
    group: 'air_fallback',
    value: h,
    confidence: 0.55,
    isEstimated: true,
    warnings: ['Correlação de fallback (sem aleta) aplicada — verificar geometria.'],
  };
}

/**
 * Correção wet→dry. Para evaporador úmido, h aparente cresce (massa+sensível);
 * em primeira aproximação usa-se fator de Threlkeld ~ 1.1–1.4 dependendo do regime.
 * Aqui adotamos 1.2 como aproximação controlada e marcamos warning.
 */
export function calculateWetCorrection(
  ctx: CorrelationContext,
  dryHTC: number,
): CorrelationResult {
  const factor = ctx.finType === 'louver' ? 1.25 : ctx.finType === 'wavy' ? 1.18 : 1.15;
  const name =
    ctx.finType === 'louver'
      ? 'WetWangLinLeeLouver'
      : ctx.finType === 'wavy'
        ? 'WetLinHwangWangHerringbone'
        : 'WetWangLinLeePlain';
  return {
    correlationName: name,
    group: 'air_wet',
    value: dryHTC * factor,
    confidence: 0.65,
    isEstimated: true,
    warnings: [`Correção úmido-seco simplificada (fator ${factor.toFixed(2)}).`],
  };
}
