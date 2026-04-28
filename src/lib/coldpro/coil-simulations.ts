import { supabase } from "@/integrations/supabase/client";
import type { CoilSimulatorInput, CoilSimulatorResult } from "@/modules/coldpro/coil/coilSimulatorTypes";

export async function saveCoilSimulatorRun(params: {
  equipmentProjectId: string;
  componentItemId?: string | null;
  input: CoilSimulatorInput;
  result: CoilSimulatorResult;
  userId?: string;
}) {
  const { error } = await supabase.from("coil_simulations").insert({
    equipment_project_id: params.equipmentProjectId,
    component_item_id: params.componentItemId ?? null,
    mode: params.input.mode,
    coil_type: params.input.coilType,
    label: params.input.label ?? null,
    inputs: params.input as never,
    outputs: params.result as never,
    warnings: result_warnings(params.result) as never,
    created_by: params.userId ?? null,
  } as never);
  if (error) throw error;
}

function result_warnings(r: CoilSimulatorResult) {
  return r.warnings ?? [];
}

export async function listEquipmentCoilSimulations(equipmentProjectId: string) {
  const { data, error } = await supabase
    .from("coil_simulations")
    .select("*")
    .eq("equipment_project_id", equipmentProjectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
