import { createHash } from 'node:crypto';
import type { CoilCalculationInput, CoilCalculationResult, CoilCalibration } from './types';
import { calculateAirSide } from './airSideEngine';
import { calculateCoilGeometry } from './geometryEngine';
import { calculateRefrigerantSide } from './refrigerantSideEngine';
import { calculateAirPressureDrop, calculateRefrigerantPressureDrop } from './pressureDropEngine';

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

export function generateModelSignature(
  input: CoilCalculationInput,
  correlationAir: string,
  effectiveAreaM2: number,
): string {
  const payload = {
    engine: 'hybrid_unilab_v1',
    geometryCode: input.geometry.code,
    mode: input.mode,
    finType: input.geometry.finType,
    tubeType: input.geometry.tubeType,
    refrigerant: input.refrigerant,
    correlationAir,
    effectiveAreaM2: Number(effectiveAreaM2.toFixed(4)),
    factors: input.factors ?? {},
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function compatibleCalibration(
  calibration: CoilCalibration | null | undefined,
  signature: string,
) {
  if (!calibration) return null;
  if (calibration.modelSignature && calibration.modelSignature !== signature) return null;
  return calibration;
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

  const signature = generateModelSignature(input, air.correlationAir, areaForHeatTransfer);
  const calibration = compatibleCalibration(input.calibration, signature);
  if (input.calibration && !calibration) {
    warnings.push('Calibração incompatível com assinatura atual — recalibre o componente.');
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

  // Confidence agregado (média ponderada das correlações; reduzido se <0.7).
  const airConf = Number((air as any).airCorrelationConfidence ?? 0.7);
  const refConf = Number((ref as any).refCorrelationConfidence ?? 0.7);
  let confidenceScore = (airConf + refConf) / 2;
  if (airConf < 0.7 || refConf < 0.7) confidenceScore *= 0.85;

  // Calibração só pode ser ajuste fino. >1.3 ou <0.7 → revisão estrutural.
  if (capFactor < 0.7 || capFactor > 1.3) {
    warnings.push(
      `Fator de calibração ${capFactor.toFixed(2)} fora da faixa de ajuste fino (0.7–1.3). ` +
        'Revisar área, correlação ou fatores Unilab — calibração não corrige erro estrutural.',
    );
  }

  return {
    engine: 'hybrid_unilab_v1',
    mode: input.mode,
    capacityW: qFinal,
    capacityKcalh: qFinal * 0.859845,
    uWm2K: uBase,
    hAirWm2K: air.hAirWm2K,
    hRefWm2K: ref.hRefWm2K,
    effectiveAreaM2: area.effectiveAreaM2,
    frontalAreaM2: area.frontalAreaM2,
    airPressureDropPa: airDp,
    refrigerantPressureDropKpa: refDp,
    dtmlK: dtml,
    correlationAir: air.correlationAir,
    correctionApplied: Boolean(input.factors),
    calibrationApplied: Boolean(calibration),
    isEstimated,
    modelSignature: signature,
    warnings,
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
      area,
      rWall,
      rTotal,
      qBase,
      qFinal,
      securityFactor,
      capFactor,
    },
  };
}
