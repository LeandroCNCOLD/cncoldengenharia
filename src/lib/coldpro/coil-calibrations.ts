import { supabase } from "@/integrations/supabase/client";
import type { CoilSimulatorInput, CoilSimulatorResult } from "@/modules/coldpro/coil/coilSimulatorTypes";
import type { CalibrationOutcome } from "@/modules/coldpro/coil/coilCalibration";

export async function saveCoilCalibration(params: {
  componentItemId: string;
  coilType: "evaporator" | "condenser";
  outcome: CalibrationOutcome;
  referenceSource?: string;
  notes?: string;
  inputSnapshot: CoilSimulatorInput;
  outputSnapshot: CoilSimulatorResult;
  userId?: string;
}) {
  const { error } = await supabase.from("coil_calibrations").insert({
    component_item_id: params.componentItemId,
    coil_type: params.coilType,
    engine: "physical_simple",
    capacity_correction_factor: params.outcome.factors.capacityCorrectionFactor,
    air_dp_correction_factor: params.outcome.factors.airDpCorrectionFactor,
    ref_dp_correction_factor: params.outcome.factors.refDpCorrectionFactor,
    ua_correction_factor: params.outcome.factors.uaCorrectionFactor,
    reference_source: params.referenceSource ?? null,
    deviation_before: params.outcome.deviationBefore as never,
    deviation_after: params.outcome.deviationAfter as never,
    meets_targets: params.outcome.meetsTargets,
    notes: params.notes ?? params.outcome.notes.join(" | ") ?? null,
    inputs_snapshot: params.inputSnapshot as never,
    outputs_snapshot: params.outputSnapshot as never,
    created_by: params.userId ?? null,
  } as never);
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

export async function getLatestCalibration(componentItemId: string) {
  const list = await listCoilCalibrations(componentItemId);
  return list[0] ?? null;
}
