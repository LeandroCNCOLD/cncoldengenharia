// Correlações de perda de carga (ar e refrigerante).
// Versões aproximadas alinhadas ao padrão CorrelationResult.

import type { CorrelationContext, CorrelationResult } from './correlationTypes';

function airDpBase(ctx: CorrelationContext, fApp: number, rows: number): number {
  // ΔP = f × N_rows × ρ V² / 2
  return fApp * rows * 0.5 * ctx.airDensityKgM3 * Math.pow(ctx.airVelocityMs, 2);
}

export interface AirDpInput {
  rows: number;
}

export function calculateChangWangLouverDP(
  ctx: CorrelationContext,
  input: AirDpInput,
): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  const f = 0.5 * Math.pow(Re, -0.3);
  return {
    correlationName: 'ChangWangLouverDP',
    group: 'air_dp_dry_louver',
    value: airDpBase(ctx, f, input.rows),
    confidence: 0.7,
    isEstimated: false,
    warnings: [],
  };
}

export function calculateWangHwangLinWavyDP(
  ctx: CorrelationContext,
  input: AirDpInput,
): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  const f = 0.6 * Math.pow(Re, -0.28);
  return {
    correlationName: 'WangHwangLinWavyDP',
    group: 'air_dp_dry_wavy',
    value: airDpBase(ctx, f, input.rows),
    confidence: 0.7,
    isEstimated: false,
    warnings: [],
  };
}

export function calculateWetAirDP(
  ctx: CorrelationContext,
  input: AirDpInput,
): CorrelationResult {
  const Re = Math.max(ctx.reynoldsAir, 1);
  const f = 0.7 * Math.pow(Re, -0.27);
  return {
    correlationName: 'WetAirDP',
    group: 'air_dp_wet',
    value: airDpBase(ctx, f, input.rows),
    confidence: 0.6,
    isEstimated: true,
    warnings: ['Perda de carga em superfície úmida — correlação simplificada.'],
  };
}

/** Refrigerante monofásico — Blasius (Re < 1e5) ou Churchill genérico. */
export function calculateChurchillBlasiusDP(ctx: CorrelationContext): CorrelationResult {
  const Re = Math.max(ctx.reynoldsRefrigerant, 1);
  const f = Re < 1e5 ? 0.316 * Math.pow(Re, -0.25) : 0.184 * Math.pow(Re, -0.2);
  // ΔP por metro × diâmetro normalizado — valor unitário (kPa/m proxy)
  const value = (f * ctx.refrigerantMassFluxKgM2s * ctx.refrigerantMassFluxKgM2s) / 2000;
  return {
    correlationName: Re < 1e5 ? 'BlasiusDP' : 'ChurchillDP',
    group: 'ref_dp_single_phase',
    value,
    confidence: 0.75,
    isEstimated: false,
    warnings: [],
  };
}

export function calculateMullerSteinhagenHeckDP(ctx: CorrelationContext): CorrelationResult {
  const G = Math.max(ctx.refrigerantMassFluxKgM2s, 50);
  return {
    correlationName: 'MullerSteinhagenHeck',
    group: 'ref_dp_two_phase_evap',
    value: 0.05 * G,
    confidence: 0.6,
    isEstimated: true,
    warnings: ['Müller-Steinhagen-Heck simplificada.'],
  };
}

export function calculateFriedelDP(ctx: CorrelationContext): CorrelationResult {
  const G = Math.max(ctx.refrigerantMassFluxKgM2s, 50);
  return {
    correlationName: 'FriedelDP',
    group: 'ref_dp_two_phase_cond',
    value: 0.04 * G,
    confidence: 0.6,
    isEstimated: true,
    warnings: ['Friedel simplificada.'],
  };
}

// ---------- Seletores ----------

export function selectAirPressureDropCorrelation(
  ctx: CorrelationContext,
  input: AirDpInput,
): CorrelationResult {
  if (ctx.wet) return calculateWetAirDP(ctx, input);
  if (ctx.finType === 'louver') return calculateChangWangLouverDP(ctx, input);
  return calculateWangHwangLinWavyDP(ctx, input);
}

export function selectRefrigerantPressureDropCorrelation(
  ctx: CorrelationContext,
): CorrelationResult {
  if (ctx.phase === 'two_phase_evaporation') return calculateMullerSteinhagenHeckDP(ctx);
  if (ctx.phase === 'two_phase_condensation') return calculateFriedelDP(ctx);
  return calculateChurchillBlasiusDP(ctx);
}
