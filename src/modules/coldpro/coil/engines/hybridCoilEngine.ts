// Hash determinística leve (FNV-1a 64-bit em hex) — funciona no browser e no server.
function hashHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc9dc5118;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
import type { CoilCalculationInput, CoilCalculationResult, CoilCalibration } from './types';
import { calculateAirSide } from './airSideEngine';
import { calculateCoilGeometry } from './geometryEngine';
import { calculateRefrigerantSide } from './refrigerantSideEngine';
import { calculateAirPressureDrop, calculateRefrigerantPressureDrop } from './pressureDropEngine';
import { isCalibrationCompatible, validateCalibrationFactors } from './calibrationEngine';

export const ENGINE_NAME = 'hybrid_unilab';
export const ENGINE_VERSION = 'v1';

function calcLMTD(dt1: number, dt2: number): number {
  if (dt1 <= 0 || dt2 <= 0) return Math.max(0, (dt1 + dt2) / 2);
  if (Math.abs(dt1 - dt2) < 0.001) return dt1;
  return (dt1 - dt2) / Math.log(dt1 / dt2);
}

function wallResistance(input: CoilCalculationInput): number {
  const g = input.geometry;
  const k = g.tubeMaterialConductivityWmK ?? 385;
  const doM = g.tubeOuterDiameterMm / 1000;
  const diM = g.tubeInnerDiameterMm / 1000;
  if (doM <= diM || k <= 0) return 0.00001;
  return Math.log(doM / diM) / (2 * Math.PI * k);
}

function factorsHash(input: CoilCalculationInput): string {
  return hashHex(JSON.stringify(input.factors ?? {}));
}

export interface SignatureContext {
  airCorrelationName?: string;
  refrigerantCorrelationName?: string;
  effectiveAreaM2?: number;
  areaSource?: string;
  hAirBase?: number;
  hRefBase?: number;
  uBase?: number;
}

export function generateModelSignature(
  input: CoilCalculationInput,
  ctx: SignatureContext = {},
): string {
  const payload = {
    engineName: ENGINE_NAME,
    engineVersion: ENGINE_VERSION,
    geometryCode: input.geometry.code,
    coilType: input.mode,
    refrigerant: input.refrigerant,
    finType: input.geometry.finType,
    tubeType: input.geometry.tubeType,
    airCorrelationName: ctx.airCorrelationName,
    refrigerantCorrelationName: ctx.refrigerantCorrelationName,
    factorsHash: factorsHash(input),
    effectiveAreaM2: ctx.effectiveAreaM2 != null ? Number(ctx.effectiveAreaM2.toFixed(4)) : null,
    areaSource: ctx.areaSource,
    hAirBase: ctx.hAirBase != null ? Number(ctx.hAirBase.toFixed(2)) : null,
    hRefBase: ctx.hRefBase != null ? Number(ctx.hRefBase.toFixed(2)) : null,
    uBase: ctx.uBase != null ? Number(ctx.uBase.toFixed(2)) : null,
  };
  return hashHex(JSON.stringify(payload));
}

export function simulateHybridCoil(input: CoilCalculationInput): CoilCalculationResult {
  const warnings: string[] = [];

  // 1ª passada da geometria sem hAir (eficiência inicial estimada).
  const geom0 = calculateCoilGeometry(input.geometry, {
    unilabExchangeAreaM2: input.geometry.unilabExchangeAreaM2,
    unilabInternalVolumeL: input.geometry.unilabInternalVolumeL,
  });
  for (const e of geom0.errors) warnings.push(`[geom] ${e}`);

  const frontalAreaM2 = geom0.frontalAreaM2;
  if (!frontalAreaM2 || frontalAreaM2 <= 0) {
    warnings.push('Geometria insuficiente para calcular área frontal.');
  }

  const air = calculateAirSide(input, frontalAreaM2);

  // 2ª passada: agora com hAir real, recalcula eficiência de aleta + áreas.
  const geom = calculateCoilGeometry(input.geometry, {
    hAirWm2K: air.hAirWm2K,
    unilabExchangeAreaM2: input.geometry.unilabExchangeAreaM2,
    unilabInternalVolumeL: input.geometry.unilabInternalVolumeL,
  });
  for (const w of geom.warnings) warnings.push(`[geom] ${w}`);

  const ref = calculateRefrigerantSide(input);

  const rWall = wallResistance(input);
  const rTotal =
    1 / Math.max(air.hAirWm2K, 0.001) +
    (input.foulingAirM2KW ?? 0.0001) +
    rWall +
    (input.foulingRefM2KW ?? 0.00005) +
    1 / Math.max(ref.hRefWm2K, 0.001);

  const uBase = 1 / rTotal;
  const securityFactor = input.factors?.securityFactor ?? 1;

  const airOut = input.airOutletTempC ?? input.airInletTempC - 2;
  const dt1 = input.airInletTempC - input.refTempC;
  const dt2 = airOut - input.refTempC;
  const dtml = calcLMTD(dt1, dt2);

  // REGRA CRÍTICA: Q = U × A_total × DTML — nunca U × DTML.
  const areaForHeatTransfer = geom.effectiveAreaForHeatTransferM2;
  const qBase = uBase * areaForHeatTransfer * dtml * securityFactor;
  const qSpecificWm2 = areaForHeatTransfer > 0 ? qBase / areaForHeatTransfer : 0;

  const signature = generateModelSignature(input, {
    airCorrelationName: air.correlationAir,
    refrigerantCorrelationName: (ref as any).correlationRef,
    effectiveAreaM2: areaForHeatTransfer,
    areaSource: geom.areaSource,
    hAirBase: (air as any).hAirBaseWm2K,
    hRefBase: (ref as any).hRefBaseWm2K,
    uBase,
  });

  // ---- Verificação de compatibilidade da calibração ------------------------
  const calibrationWarnings: string[] = [];
  let calibration: CoilCalibration | null = null;
  let calibrationCompatible = false;
  if (input.calibration) {
    calibrationCompatible = isCalibrationCompatible(input.calibration, signature);
    if (calibrationCompatible) {
      calibration = input.calibration;
      const v = validateCalibrationFactors(calibration);
      if (!v.withinFineRange) {
        calibrationWarnings.push(...v.warnings);
        warnings.push(...v.warnings);
      }
    } else {
      const msg = 'Calibração incompatível com a versão atual do modelo. Recalibre o componente.';
      calibrationWarnings.push(msg);
      warnings.push(msg);
    }
  }

  const capFactor = calibration?.capacityCorrectionFactor ?? 1;
  const qFinal = qBase * capFactor;

  const airDpBase = calculateAirPressureDrop(input, air.density, air.faceVelocityMs);
  const refDpBase = calculateRefrigerantPressureDrop(input);
  const airDp = airDpBase == null ? null : airDpBase * (calibration?.airPressureDropFactor ?? 1);
  const refDp = refDpBase == null ? null : refDpBase * (calibration?.refrigerantPressureDropFactor ?? 1);

  const source = input.unilabSource ?? (input.factors ? 'partial' : 'fallback');
  const correlationsEstimated =
    Boolean((air as any).airCorrelationIsEstimated) ||
    Boolean((ref as any).refCorrelationIsEstimated);
  const isEstimated = source !== 'unilab' || correlationsEstimated;
  if (source === 'fallback') {
    warnings.push('Sem geometria/fatores Unilab — cálculo usa fallback genérico.');
  } else if (source === 'partial') {
    warnings.push('Fatores Unilab incompletos ou neutros — resultado parcialmente estimado.');
  }

  // Propaga warnings vindos das correlações
  for (const w of (air as any).airCorrelationWarnings ?? []) warnings.push(`[ar] ${w}`);
  for (const w of (ref as any).refCorrelationWarnings ?? []) warnings.push(`[ref] ${w}`);
  if (correlationsEstimated) {
    warnings.push('Correlação estimada aplicada. Resultado requer validação.');
  }

  // Confidence agregado das correlações + boost se calibração compatível.
  const airConf = Number((air as any).airCorrelationConfidence ?? 0.7);
  const refConf = Number((ref as any).refCorrelationConfidence ?? 0.7);
  let confidenceScore = (airConf + refConf) / 2;
  if (airConf < 0.7 || refConf < 0.7) confidenceScore *= 0.85;
  if (calibration) {
    confidenceScore = Math.max(confidenceScore, calibration.confidenceScore ?? 0.85);
  }

  return {
    engine: 'hybrid_unilab_v1',
    mode: input.mode,
    capacityW: qFinal,
    capacityKcalh: qFinal * 0.859845,
    uWm2K: uBase,
    hAirWm2K: air.hAirWm2K,
    hRefWm2K: ref.hRefWm2K,
    effectiveAreaM2: areaForHeatTransfer,
    frontalAreaM2: geom.frontalAreaM2,
    airPressureDropPa: airDp,
    refrigerantPressureDropKpa: refDp,
    dtmlK: dtml,
    correlationAir: air.correlationAir,
    correctionApplied: Boolean(input.factors),
    calibrationApplied: Boolean(calibration),
    calibrationCompatible,
    calibrationId: calibration?.calibrationId ?? calibration?.id,
    calibrationStatus: calibration?.status,
    calibrationWarnings,
    isEstimated,
    modelSignature: signature,
    warnings,
    geometryResult: {
      frontalAreaM2: geom.frontalAreaM2,
      totalExternalAreaM2: geom.totalExternalAreaM2,
      internalTubeAreaM2: geom.internalTubeAreaM2,
      internalVolumeL: geom.internalVolumeL,
      finEfficiency: geom.finEfficiency,
      finCount: geom.finCount,
      totalTubeCount: geom.totalTubeCount,
      totalTubeLengthM: geom.totalTubeLengthM,
      qSpecificWm2,
      areaSource: geom.areaSource,
      areaDeviationPct: geom.areaDeviationPct,
      volumeDeviationPct: geom.volumeDeviationPct,
    },
    debug: {
      geometryCode: input.geometry.code,
      finType: input.geometry.finType,
      tubeType: input.geometry.tubeType,
      source,
      factorsApplied: input.factors ?? null,
      airCorrelationName: (air as any).correlationAir,
      refCorrelationName: (ref as any).correlationRef,
      hAirBase: (air as any).hAirBaseWm2K,
      hAirFinal: air.hAirWm2K,
      hRefBase: (ref as any).hRefBaseWm2K,
      hRefFinal: ref.hRefWm2K,
      airCorrelationConfidence: airConf,
      refCorrelationConfidence: refConf,
      confidenceScore,
      isEstimated,
      air,
      ref,
      geometry: geom,
      areaSource: geom.areaSource,
      qSpecificWm2,
      rWall,
      rTotal,
      qBase,
      qFinal,
      securityFactor,
      capFactor,
    },
  };
}
