import { supabase } from "@/integrations/supabase/client";
import type {
  PerformanceMapResult,
  PerformanceEngine,
} from "@/modules/coldpro/coil/performanceMapGenerator";

export type CoilPerformanceMapStatus = "draft" | "generated" | "approved" | "archived";

export interface SavePerformanceMapParams {
  componentItemId: string;
  equipmentProjectId?: string | null;
  coilType: "evaporator" | "condenser";
  engine: PerformanceEngine;
  calibrationId?: string | null;
  mapName?: string | null;
  result: PerformanceMapResult;
  notes?: string | null;
  userId?: string | null;
}

export async function savePerformanceMap(params: SavePerformanceMapParams) {
  const payload: Record<string, unknown> = {
    component_item_id: params.componentItemId,
    equipment_project_id: params.equipmentProjectId ?? null,
    coil_type: params.coilType,
    engine: params.engine,
    calibration_id: params.calibrationId ?? null,
    map_name: params.mapName ?? null,
    input_grid_json: params.result.ranges,
    results_json: { points: params.result.points },
    summary_json: {
      ...params.result.summary,
      nominalValidation: params.result.nominalValidation,
      modelSignature: params.result.modelSignature ?? null,
      blocked: params.result.blocked ?? false,
      blockReason: params.result.blockReason ?? null,
      engine: params.engine,
    },
    confidence_score: params.result.summary.avgConfidence,
    status: "generated" satisfies CoilPerformanceMapStatus,
    is_estimated: params.result.isEstimated,
    notes: params.notes ?? null,
    created_by: params.userId ?? null,
  };
  const { data, error } = await supabase
    .from("coil_performance_maps")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function listPerformanceMaps(componentItemId: string) {
  const { data, error } = await supabase
    .from("coil_performance_maps")
    .select(
      "id, component_item_id, equipment_project_id, coil_type, engine, calibration_id, map_name, summary_json, confidence_score, status, is_estimated, notes, created_at, created_by",
    )
    .eq("component_item_id", componentItemId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function updatePerformanceMapStatus(id: string, status: CoilPerformanceMapStatus) {
  const { error } = await supabase
    .from("coil_performance_maps")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw error;
}
