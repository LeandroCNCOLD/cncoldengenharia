/**
 * Cálculo geométrico completo do aletado.
 *
 * Calcula área frontal, área externa total (tubos + aletas com eficiência),
 * área interna dos tubos, volume interno, número/comprimento de tubos,
 * número de aletas, eficiência de aleta e diâmetros hidráulicos.
 *
 * Suporta fallback para área/volume importados do Unilab quando o cálculo
 * geométrico diverge >25% dos valores de catálogo.
 */
import type { GeometryInput } from './types';

const PI = Math.PI;
const mm = (v: number) => v / 1000;

// ============================================================================
// Tipos públicos
// ============================================================================

export interface CoilGeometryResult {
  // Áreas
  frontalAreaM2: number;
  externalTubeAreaM2: number;
  internalTubeAreaM2: number;
  grossFinAreaM2: number;
  tubeHoleAreaM2: number;
  netFinAreaM2: number;
  effectiveFinAreaM2: number;
  totalExternalAreaM2: number;

  // Eficiência
  finEfficiency: number;

  // Contagens
  finCount: number;
  totalTubeCount: number;
  totalTubeLengthM: number;

  // Volume
  internalVolumeL: number;

  // Diâmetros hidráulicos
  hydraulicDiameterAirM: number;
  hydraulicDiameterRefM: number;

  // Origem da área usada nos cálculos térmicos
  areaSource: 'calculated_geometry' | 'imported_unilab';
  effectiveAreaForHeatTransferM2: number;

  // Comparação com catálogo Unilab
  unilabExchangeAreaM2?: number;
  unilabInternalVolumeL?: number;
  areaDeviationPct?: number;
  volumeDeviationPct?: number;

  warnings: string[];
  errors: string[];
}

// ============================================================================
// Eficiência de aleta (Schmidt simplificado)
// ============================================================================

export function calculateFinEfficiency(params: {
  hAirWm2K: number;
  finThicknessMm: number;
  finMaterialConductivityWmK: number;
  finLengthCharacteristicM: number;
}): { value: number; warnings: string[] } {
  const warnings: string[] = [];
  const { hAirWm2K, finThicknessMm, finMaterialConductivityWmK, finLengthCharacteristicM } = params;

  let h = hAirWm2K;
  if (!Number.isFinite(h) || h <= 0) {
    h = 50; // hAir default (W/m²K)
    warnings.push('Eficiência de aleta estimada com hAir padrão (50 W/m²K).');
  }
  const k = finMaterialConductivityWmK > 0 ? finMaterialConductivityWmK : 205;
  const t = mm(finThicknessMm > 0 ? finThicknessMm : 0.13);
  const L = finLengthCharacteristicM > 0 ? finLengthCharacteristicM : 0.012;

  const m = Math.sqrt((2 * h) / (k * t));
  const mL = m * L;
  if (mL < 1e-6) return { value: 1, warnings };

  const eta = Math.tanh(mL) / mL;
  const clamped = Math.max(0.4, Math.min(1, eta));
  return { value: clamped, warnings };
}

// ============================================================================
// Cálculo geométrico principal
// ============================================================================

export interface CalculateCoilGeometryOptions {
  hAirWm2K?: number;
  unilabExchangeAreaM2?: number | null;
  unilabInternalVolumeL?: number | null;
  /** % máxima de divergência aceita antes de cair pro fallback Unilab. */
  maxDeviationPct?: number;
}

export function calculateCoilGeometry(
  g: GeometryInput,
  opts: CalculateCoilGeometryOptions = {},
): CoilGeometryResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // ---- Validações bloqueantes ---------------------------------------------
  if (g.coilLengthMm <= 0) errors.push('coilLengthMm inválido (<=0).');
  if (g.coilHeightMm <= 0) errors.push('coilHeightMm inválido (<=0).');
  if (g.tubesPerRow <= 0) errors.push('tubesPerRow inválido (<=0).');
  if (g.rows <= 0) errors.push('rows inválido (<=0).');
  if (g.tubeOuterDiameterMm <= 0) errors.push('tubeOuterDiameterMm inválido (<=0).');
  if (g.tubeInnerDiameterMm <= 0) errors.push('tubeInnerDiameterMm inválido (<=0).');
  if (g.tubeInnerDiameterMm >= g.tubeOuterDiameterMm)
    errors.push('tubeInnerDiameterMm >= tubeOuterDiameterMm.');
  if (g.finPitchMm <= 0) errors.push('finPitchMm inválido (<=0).');

  // ---- Geometria ----------------------------------------------------------
  const coilLengthM = mm(g.coilLengthMm);
  const coilHeightM = mm(g.coilHeightMm);
  const rowPitchM = mm(g.rowPitchMm || 22);
  const coilDepthM = (g.coilDepthMm ?? g.rows * (g.rowPitchMm || 22)) / 1000;

  const frontalAreaM2 = coilLengthM * coilHeightM;
  if (!frontalAreaM2 || frontalAreaM2 <= 0) {
    warnings.push('frontalAreaM2 não pôde ser calculada.');
  }

  const skippedTubes = g.skippedTubes ?? 0;
  const totalTubeCount = Math.max(0, g.tubesPerRow * g.rows - skippedTubes);
  const totalTubeLengthM = totalTubeCount * coilLengthM;

  const doM = mm(g.tubeOuterDiameterMm);
  const diM = mm(g.tubeInnerDiameterMm);

  const internalTubeAreaM2 = PI * diM * totalTubeLengthM;
  const externalTubeAreaM2 = PI * doM * totalTubeLengthM;

  const finCount = Math.max(1, Math.floor(g.coilLengthMm / g.finPitchMm));
  const grossFinAreaM2 = 2 * coilHeightM * coilDepthM * finCount;
  const tubeHoleAreaM2 =
    PI * Math.pow(doM / 2, 2) * totalTubeCount * finCount;
  const netFinAreaM2 = Math.max(0, grossFinAreaM2 - tubeHoleAreaM2);

  // ---- Eficiência de aleta ------------------------------------------------
  const finLengthCharacteristicM = Math.max(
    mm(g.tubePitchMm || 25) / 2 - doM / 2,
    0.005,
  );
  const finK =
    g.finMaterialConductivityWmK ??
    g.tubeMaterialConductivityWmK ?? // fallback: usa material do tubo
    205; // alumínio
  const eff = calculateFinEfficiency({
    hAirWm2K: opts.hAirWm2K ?? 0,
    finThicknessMm: g.finThicknessMm,
    finMaterialConductivityWmK: finK,
    finLengthCharacteristicM,
  });
  const finEfficiency = eff.value;
  warnings.push(...eff.warnings);

  if (finEfficiency < 0.6) warnings.push(`Eficiência de aleta baixa (${finEfficiency.toFixed(2)}).`);
  if (finEfficiency > 1.0) warnings.push(`Eficiência de aleta > 1.0 (${finEfficiency.toFixed(2)}).`);

  const effectiveFinAreaM2 = netFinAreaM2 * finEfficiency;
  const totalExternalAreaM2 = externalTubeAreaM2 + effectiveFinAreaM2;
  if (totalExternalAreaM2 <= 0) errors.push('totalExternalAreaM2 <= 0.');

  // ---- Volume interno -----------------------------------------------------
  const internalVolumeL = PI * Math.pow(diM / 2, 2) * totalTubeLengthM * 1000;

  // ---- Diâmetros hidráulicos ----------------------------------------------
  // Ar: aproximação clássica Dh_ar ≈ 2 × (passo de aleta − espessura)
  const finPitchM = mm(g.finPitchMm);
  const finThickM = mm(g.finThicknessMm || 0.13);
  const hydraulicDiameterAirM = Math.max(0.0015, 2 * (finPitchM - finThickM));
  // Refrigerante: diâmetro interno do tubo
  const hydraulicDiameterRefM = diM;

  // ---- Comparação com Unilab + fallback de área ---------------------------
  const maxDev = opts.maxDeviationPct ?? 25;
  let areaSource: 'calculated_geometry' | 'imported_unilab' = 'calculated_geometry';
  let effectiveAreaForHeatTransferM2 = totalExternalAreaM2;
  let areaDeviationPct: number | undefined;
  let volumeDeviationPct: number | undefined;

  const refArea = opts.unilabExchangeAreaM2 ?? undefined;
  const refVol = opts.unilabInternalVolumeL ?? undefined;

  if (refArea && refArea > 0 && totalExternalAreaM2 > 0) {
    areaDeviationPct = ((totalExternalAreaM2 - refArea) / refArea) * 100;
    if (Math.abs(areaDeviationPct) > maxDev) {
      warnings.push(
        `Área externa calculada diverge ${areaDeviationPct.toFixed(1)}% do Unilab (${refArea.toFixed(2)} m²) — usando área importada.`,
      );
      areaSource = 'imported_unilab';
      effectiveAreaForHeatTransferM2 = refArea;
    }
  }
  if (refVol && refVol > 0 && internalVolumeL > 0) {
    volumeDeviationPct = ((internalVolumeL - refVol) / refVol) * 100;
    if (Math.abs(volumeDeviationPct) > maxDev) {
      warnings.push(
        `Volume interno calculado diverge ${volumeDeviationPct.toFixed(1)}% do Unilab (${refVol.toFixed(1)} L).`,
      );
    }
  }

  return {
    frontalAreaM2,
    externalTubeAreaM2,
    internalTubeAreaM2,
    grossFinAreaM2,
    tubeHoleAreaM2,
    netFinAreaM2,
    effectiveFinAreaM2,
    totalExternalAreaM2,
    finEfficiency,
    finCount,
    totalTubeCount,
    totalTubeLengthM,
    internalVolumeL,
    hydraulicDiameterAirM,
    hydraulicDiameterRefM,
    areaSource,
    effectiveAreaForHeatTransferM2,
    unilabExchangeAreaM2: refArea,
    unilabInternalVolumeL: refVol,
    areaDeviationPct,
    volumeDeviationPct,
    warnings,
    errors,
  };
}

// ============================================================================
// Wrappers legados — mantêm compatibilidade com chamadas antigas
// ============================================================================

export function calculateFrontalAreaM2(g: GeometryInput): number {
  return mm(g.coilLengthMm) * mm(g.coilHeightMm);
}

export function calculateEffectiveAreaM2(g: GeometryInput, hAirWm2K: number) {
  const r = calculateCoilGeometry(g, { hAirWm2K });
  return {
    tubeExternalAreaM2: r.externalTubeAreaM2,
    tubeInternalAreaM2: r.internalTubeAreaM2,
    finAreaM2: r.netFinAreaM2,
    finEfficiency: r.finEfficiency,
    effectiveAreaM2: r.totalExternalAreaM2,
    frontalAreaM2: r.frontalAreaM2,
    geometry: r,
  };
}
