import { createHash } from 'node:crypto';
import type { CoilCalculationInput, CoilCalculationResult, CoilCalibration } from './types';
import { calculateAirSide } from './airSideEngine';
import { calculateEffectiveAreaM2 } from './geometryEngine';
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

  const frontalAreaM2 = (input.geometry.coilLengthMm / 1000) * (input.geometry.coilHeightMm / 1000);
  if (!frontalAreaM2 || frontalAreaM2 <= 0) {
    warnings.push('Geometria insuficiente para calcular área frontal.');
  }

  const air = calculateAirSide(input, frontalAreaM2);
  const area = calculateEffectiveAreaM2(input.geometry, air.hAirWm2K);
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
  const qBase = uBase * area.effectiveAreaM2 * dtml * securityFactor;

  const signature = generateModelSignature(input, air.correlationAir, area.effectiveAreaM2);
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

  const isEstimated = !input.factors;
  if (isEstimated) {
    warnings.push('Sem fatores de geometria Unilab; resultado continua estimado.');
  }

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
    debug: { air, ref, area, rWall, rTotal, qBase, qFinal, securityFactor, capFactor },
  };
}
