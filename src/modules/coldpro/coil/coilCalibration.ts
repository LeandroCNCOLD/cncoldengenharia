/**
 * Calibra o motor físico simples contra um ponto nominal Unilab.
 *
 * Estratégia: calcula desvio percentual no ponto nominal (com fatores neutros),
 * aplica fator inverso para zerar o erro de capacidade, e fatores
 * proporcionais para ΔP. Reporta desvio antes/depois e se atingiu metas.
 */

import type { CoilSimulatorInput } from "./coilSimulatorTypes";
import { simulatePhysicalSimple } from "./physicalSimpleEngine";
import {
  NEUTRAL_CALIBRATION,
  CALIBRATION_TARGETS,
  type CalibrationFactors,
} from "./coilEngineTypes";

export interface CalibrationReference {
  capacityW: number;
  airPressureDropPa?: number | null;
  refPressureDropKpa?: number | null;
}

export interface CalibrationDeviation {
  capacityPct: number | null;
  airDpPct: number | null;
  refDpPct: number | null;
}

export interface CalibrationOutcome {
  factors: CalibrationFactors;
  deviationBefore: CalibrationDeviation;
  deviationAfter: CalibrationDeviation;
  meetsTargets: boolean;
  notes: string[];
}

function pctDeviation(actual: number | null | undefined, ref: number | null | undefined): number | null {
  if (actual == null || ref == null || ref === 0) return null;
  return ((actual - ref) / ref) * 100;
}

export function calibrateAgainstReference(
  input: CoilSimulatorInput,
  reference: CalibrationReference,
): CalibrationOutcome {
  const notes: string[] = [];
  const baseline = simulatePhysicalSimple(input, { calibration: NEUTRAL_CALIBRATION });

  const deviationBefore: CalibrationDeviation = {
    capacityPct: pctDeviation(baseline.capacityW, reference.capacityW),
    airDpPct: pctDeviation(baseline.airPressureDropPa, reference.airPressureDropPa ?? null),
    refDpPct: pctDeviation(baseline.refPressureDropKpa, reference.refPressureDropKpa ?? null),
  };

  // Fator de capacidade: ref / actual
  const capacityFactor =
    baseline.capacityW > 0 ? reference.capacityW / baseline.capacityW : 1;

  const airDpFactor =
    baseline.airPressureDropPa && reference.airPressureDropPa
      ? reference.airPressureDropPa / baseline.airPressureDropPa
      : 1;

  const refDpFactor =
    baseline.refPressureDropKpa && reference.refPressureDropKpa
      ? reference.refPressureDropKpa / baseline.refPressureDropKpa
      : 1;

  const factors: CalibrationFactors = {
    capacityCorrectionFactor: clamp(capacityFactor, 0.3, 3),
    uaCorrectionFactor: 1, // mantemos UA neutro; correção entra na capacidade
    airDpCorrectionFactor: clamp(airDpFactor, 0.3, 3),
    refDpCorrectionFactor: clamp(refDpFactor, 0.3, 3),
  };

  if (capacityFactor !== factors.capacityCorrectionFactor) {
    notes.push(`Fator de capacidade clampado para ${factors.capacityCorrectionFactor.toFixed(2)} (sugerido ${capacityFactor.toFixed(2)}).`);
  }

  const calibrated = simulatePhysicalSimple(input, { calibration: factors });
  const deviationAfter: CalibrationDeviation = {
    capacityPct: pctDeviation(calibrated.capacityW, reference.capacityW),
    airDpPct: pctDeviation(calibrated.airPressureDropPa, reference.airPressureDropPa ?? null),
    refDpPct: pctDeviation(calibrated.refPressureDropKpa, reference.refPressureDropKpa ?? null),
  };

  const meetsTargets =
    Math.abs(deviationAfter.capacityPct ?? 999) <= CALIBRATION_TARGETS.capacityPct &&
    (deviationAfter.airDpPct == null || Math.abs(deviationAfter.airDpPct) <= CALIBRATION_TARGETS.airDpPct) &&
    (deviationAfter.refDpPct == null || Math.abs(deviationAfter.refDpPct) <= CALIBRATION_TARGETS.refDpPct);

  if (!meetsTargets) {
    notes.push("Calibração não atingiu todas as metas — revisar geometria ou refinar correlações.");
  }

  return { factors, deviationBefore, deviationAfter, meetsTargets, notes };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
