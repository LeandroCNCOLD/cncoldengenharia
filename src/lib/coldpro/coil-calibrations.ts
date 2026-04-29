import { supabase } from "@/integrations/supabase/client";
import type { CoilSimulatorInput, CoilSimulatorResult } from "@/modules/coldpro/coil/coilSimulatorTypes";
import type { CalibrationOutcome } from "@/modules/coldpro/coil/coilCalibration";
import {
  NEUTRAL_CALIBRATION,
  normalizeCalibrationFactors,
  type CalibrationFactors,
} from "@/modules/coldpro/coil/coilEngineTypes";

type CalRow = {
  id?: string | null;
  capacity_correction_factor: number | string | null;
  air_dp_correction_factor: number | string | null;
  ref_dp_correction_factor: number | string | null;
  ua_correction_factor: number | string | null;
  capacityCorrectionFactor?: number | string | null;
  airPressureDropFactor?: number | string | null;
  refrigerantPressureDropFactor?: number | string | null;
  uaCorrectionFactor?: number | string | null;
};

/** Converte registro do banco em CalibrationFactors. */
export function factorsFromRow(row: CalRow | null | undefined): CalibrationFactors {
  if (!row) return NEUTRAL_CALIBRATION;
  return normalizeCalibrationFactors({
    capacityCorrectionFactor:
      Number(row.capacityCorrectionFactor ?? row.capacity_correction_factor) || 1,
    airDpCorrectionFactor: Number(row.air_dp_correction_factor) || 1,
    refDpCorrectionFactor: Number(row.ref_dp_correction_factor) || 1,
    uaCorrectionFactor: Number(row.uaCorrectionFactor ?? row.ua_correction_factor) || 1,
    airPressureDropFactor:
      Number(row.airPressureDropFactor ?? row.air_dp_correction_factor) || 1,
    refrigerantPressureDropFactor:
      Number(row.refrigerantPressureDropFactor ?? row.ref_dp_correction_factor) || 1,
  });
}

/**
 * Aplica fatores de calibração a um resultado de simulação como
 * pós-processamento. USAR APENAS para motores que NÃO aplicam a
 * calibração internamente (motores empíricos quando chamados sem
 * `options.calibration`). Nunca chamar após `simulatePhysicalSimple`,
 * que já aplica os fatores no próprio motor.
 */
export function applyCalibrationToResult(
  result: CoilSimulatorResult,
  calibration: CalibrationFactors,
): CoilSimulatorResult {
  const cap = calibration.capacityCorrectionFactor;
  const a = calibration.airDpCorrectionFactor;
  const r = calibration.refDpCorrectionFactor;
  return {
    ...result,
    capacityW: result.capacityW * cap,
    capacityKcalh: result.capacityKcalh * cap,
    sensibleW: result.sensibleW != null ? result.sensibleW * cap : null,
    latentW: result.latentW != null ? result.latentW * cap : null,
    condensateLh: result.condensateLh != null ? result.condensateLh * cap : null,
    airPressureDropPa: result.airPressureDropPa != null ? result.airPressureDropPa * a : null,
    refPressureDropKpa: result.refPressureDropKpa != null ? result.refPressureDropKpa * r : null,
  };
}

export async function saveCoilCalibration(params: {
  componentItemId: string;
  coilType: "evaporator" | "condenser";
  outcome: CalibrationOutcome;
  referenceSource?: string;
  notes?: string;
  calibrationName?: string;
  inputSnapshot: CoilSimulatorInput;
  outputSnapshot: CoilSimulatorResult;
  userId?: string;
}) {
  const payload: Record<string, unknown> = {
    component_item_id: params.componentItemId,
    coil_type: params.coilType,
    engine: "physical_simple",
    capacity_correction_factor: params.outcome.factors.capacityCorrectionFactor,
    air_dp_correction_factor: params.outcome.factors.airDpCorrectionFactor,
    ref_dp_correction_factor: params.outcome.factors.refDpCorrectionFactor,
    ua_correction_factor: params.outcome.factors.uaCorrectionFactor,
    reference_source: params.referenceSource ?? null,
    deviation_before: params.outcome.deviationBefore,
    deviation_after: params.outcome.deviationAfter,
    meets_targets: params.outcome.meetsTargets,
    status: params.outcome.status,
    confidence_score: params.outcome.confidenceScore,
    calibration_name: params.calibrationName ?? null,
    notes: params.notes ?? params.outcome.notes.join(" | ") ?? null,
    inputs_snapshot: params.inputSnapshot,
    outputs_snapshot: params.outputSnapshot,
    created_by: params.userId ?? null,
  };
  const { error } = await supabase.from("coil_calibrations").insert(payload as never);
  if (error) throw error;
}

export async function listCoilCalibrations(componentItemId: string) {
  const { data, error } = await supabase
    .from("coil_calibrations")
    .select("*")
    .eq("component_item_id", componentItemId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

/** Histórico ordenado (mais recentes primeiro). */
export const getActiveCalibrationsForComponent = listCoilCalibrations;

/** Calibração ativa = última criada. */
export async function getActiveCalibrationForComponent(componentItemId: string) {
  const list = await listCoilCalibrations(componentItemId);
  return list?.[0] ?? null;
}

export const getLatestCalibration = getActiveCalibrationForComponent;
