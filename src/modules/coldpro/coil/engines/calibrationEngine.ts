import type { CoilCalculationInput, CoilCalibration } from './types';
import { simulateHybridCoil } from './hybridCoilEngine';

export interface DatasheetReference {
  capacityW: number;
  airPressureDropPa?: number;
  refrigerantPressureDropKpa?: number;
  label?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function calibrateAgainstDatasheet(input: CoilCalculationInput, reference: DatasheetReference) {
  const neutral: CoilCalculationInput = { ...input, calibration: null };
  const baseline = simulateHybridCoil(neutral);

  const factors: CoilCalibration = {
    modelSignature: baseline.modelSignature,
    capacityCorrectionFactor: clamp(reference.capacityW / baseline.capacityW, 0.3, 3),
    airPressureDropFactor: reference.airPressureDropPa && baseline.airPressureDropPa
      ? clamp(reference.airPressureDropPa / baseline.airPressureDropPa, 0.3, 3)
      : 1,
    refrigerantPressureDropFactor: reference.refrigerantPressureDropKpa && baseline.refrigerantPressureDropKpa
      ? clamp(reference.refrigerantPressureDropKpa / baseline.refrigerantPressureDropKpa, 0.3, 3)
      : 1,
    heatTransferFactor: 1,
    confidenceScore: 0.85,
  };
  factors.heatTransferFactor = factors.capacityCorrectionFactor;

  const calibrated = simulateHybridCoil({ ...input, calibration: factors });
  const capDev = ((calibrated.capacityW - reference.capacityW) / reference.capacityW) * 100;
  const status = Math.abs(capDev) <= 5 ? 'calibrated' : 'needs_review';

  return { status, baseline, calibrated, factors, deviations: { capacityPercent: capDev } };
}
