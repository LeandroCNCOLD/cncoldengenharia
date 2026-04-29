/**
 * Calibra o motor físico simples contra um ponto nominal Unilab.
 *
 * Estratégia: rodar baseline com fatores neutros, calcular fatores
 * inversos para zerar o erro de capacidade e proporcionais para ΔP,
 * clampar entre 0.3 e 3.0, validar contra metas.
 */

import type { CoilSimulatorInput, CoilSimulatorResult } from "./coilSimulatorTypes";
import { simulatePhysicalSimple } from "./physicalSimpleEngine";
import {
  NEUTRAL_CALIBRATION,
  CALIBRATION_TARGETS,
  clampFactor,
  confidenceScoreFor,
  type CalibrationFactors,
  type CalibrationStatus,
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
  heatTransferFactor: number;
  deviationBefore: CalibrationDeviation;
  deviationAfter: CalibrationDeviation;
  meetsTargets: boolean;
  status: CalibrationStatus;
  confidenceScore: number;
  notes: string[];
  baselineResult: CoilSimulatorResult;
  calibratedResult: CoilSimulatorResult;
}

function pctDeviation(actual: number | null | undefined, ref: number | null | undefined): number | null {
  if (actual == null || ref == null || ref === 0) return null;
  return ((actual - ref) / ref) * 100;
}

/** API canônica: calibração ponto-a-ponto contra datasheet Unilab. */
export interface DatasheetPoint {
  capacityW: number;
  airInletTempC?: number;
  airOutletTempC?: number;
  evaporationTempC?: number;
  condensationTempC?: number;
  airflowM3h?: number;
  airPressureDropPa?: number | null;
  refrigerantPressureDropKpa?: number | null;
  refrigerant?: string;
  coilType: "evaporator" | "condenser";
}

export function calibrateCoilFromDatasheet(params: {
  input: CoilSimulatorInput;
  datasheet: DatasheetPoint;
}): CalibrationOutcome {
  const { input, datasheet } = params;
  const reference: CalibrationReference = {
    capacityW: datasheet.capacityW,
    airPressureDropPa: datasheet.airPressureDropPa ?? null,
    refPressureDropKpa: datasheet.refrigerantPressureDropKpa ?? null,
  };
  return calibrateAgainstReference(input, reference);
}

export function calibrateAgainstReference(
  input: CoilSimulatorInput,
  reference: CalibrationReference,
): CalibrationOutcome {
  const notes: string[] = [];
  const baselineResult = simulatePhysicalSimple(input, { calibration: NEUTRAL_CALIBRATION });

  const deviationBefore: CalibrationDeviation = {
    capacityPct: pctDeviation(baselineResult.capacityW, reference.capacityW),
    airDpPct: pctDeviation(baselineResult.airPressureDropPa, reference.airPressureDropPa ?? null),
    refDpPct: pctDeviation(baselineResult.refPressureDropKpa, reference.refPressureDropKpa ?? null),
  };

  const rawCap = baselineResult.capacityW > 0 ? reference.capacityW / baselineResult.capacityW : 1;
  const rawAir =
    reference.airPressureDropPa && baselineResult.airPressureDropPa
      ? reference.airPressureDropPa / baselineResult.airPressureDropPa
      : 1;
  const rawRef =
    reference.refPressureDropKpa && baselineResult.refPressureDropKpa
      ? reference.refPressureDropKpa / baselineResult.refPressureDropKpa
      : 1;

  const factors: CalibrationFactors = {
    capacityCorrectionFactor: clampFactor(rawCap),
    uaCorrectionFactor: 1,
    airDpCorrectionFactor: clampFactor(rawAir),
    refDpCorrectionFactor: clampFactor(rawRef),
    airPressureDropFactor: clampFactor(rawAir),
    refrigerantPressureDropFactor: clampFactor(rawRef),
    heatTransferFactor: 1,
  };
  const heatTransferFactor = factors.capacityCorrectionFactor;

  if (Math.abs(rawCap - factors.capacityCorrectionFactor) > 1e-6) {
    notes.push(
      `Fator de capacidade clampado para ${factors.capacityCorrectionFactor.toFixed(2)} (sugerido ${rawCap.toFixed(2)}).`,
    );
  }
  if (reference.airPressureDropPa && Math.abs(rawAir - factors.airDpCorrectionFactor) > 1e-6) {
    notes.push(`Fator ΔP ar clampado para ${factors.airDpCorrectionFactor.toFixed(2)}.`);
  }
  if (reference.refPressureDropKpa && Math.abs(rawRef - factors.refDpCorrectionFactor) > 1e-6) {
    notes.push(`Fator ΔP refrigerante clampado para ${factors.refDpCorrectionFactor.toFixed(2)}.`);
  }

  const calibratedResult = simulatePhysicalSimple(input, { calibration: factors });
  const deviationAfter: CalibrationDeviation = {
    capacityPct: pctDeviation(calibratedResult.capacityW, reference.capacityW),
    airDpPct: pctDeviation(calibratedResult.airPressureDropPa, reference.airPressureDropPa ?? null),
    refDpPct: pctDeviation(calibratedResult.refPressureDropKpa, reference.refPressureDropKpa ?? null),
  };

  const capOk = Math.abs(deviationAfter.capacityPct ?? 999) <= CALIBRATION_TARGETS.capacityPct;
  const airOk =
    reference.airPressureDropPa == null ||
    deviationAfter.airDpPct == null ||
    Math.abs(deviationAfter.airDpPct) <= CALIBRATION_TARGETS.airDpPct;
  const refOk =
    reference.refPressureDropKpa == null ||
    deviationAfter.refDpPct == null ||
    Math.abs(deviationAfter.refDpPct) <= CALIBRATION_TARGETS.refDpPct;

  const meetsTargets = capOk && airOk && refOk;
  const status: CalibrationStatus = meetsTargets ? "calibrated" : "needs_review";
  const confidenceScore = confidenceScoreFor(status, 1);

  if (!meetsTargets) {
    notes.push("Calibração não atingiu todas as metas — revisar geometria ou refinar correlações.");
  }

  return {
    factors,
    heatTransferFactor,
    deviationBefore,
    deviationAfter,
    meetsTargets,
    status,
    confidenceScore,
    notes,
    baselineResult,
    calibratedResult,
  };
}
