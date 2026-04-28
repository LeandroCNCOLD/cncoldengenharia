import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ComponentKind } from "./labels";

export type ComponentItem = Database["public"]["Tables"]["component_items"]["Row"];
export type ComponentItemInsert = Database["public"]["Tables"]["component_items"]["Insert"];
export type ComponentItemUpdate = Database["public"]["Tables"]["component_items"]["Update"];

export async function listComponents(equipmentProjectId: string) {
  const { data, error } = await supabase
    .from("component_items")
    .select("*")
    .eq("equipment_project_id", equipmentProjectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listComponentsByKind(equipmentProjectId: string, kind: ComponentKind) {
  const { data, error } = await supabase
    .from("component_items")
    .select("*")
    .eq("equipment_project_id", equipmentProjectId)
    .eq("kind", kind)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getComponent(id: string) {
  const { data, error } = await supabase
    .from("component_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createComponent(input: ComponentItemInsert) {
  const { data, error } = await supabase
    .from("component_items")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateComponent(id: string, patch: ComponentItemUpdate) {
  const { data, error } = await supabase
    .from("component_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComponent(id: string) {
  const { error } = await supabase.from("component_items").delete().eq("id", id);
  if (error) throw error;
}

// Files
export async function listComponentFiles(componentItemId: string) {
  const { data, error } = await supabase
    .from("component_files")
    .select("*")
    .eq("component_item_id", componentItemId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadComponentFile(params: {
  componentItemId: string;
  file: File;
  userId: string;
}) {
  const { componentItemId, file, userId } = params;
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${componentItemId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("component-uploads")
    .upload(path, file, { contentType: file.type || undefined });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("component_files")
    .insert({
      component_item_id: componentItemId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComponentFile(fileId: string, storagePath: string) {
  await supabase.storage.from("component-uploads").remove([storagePath]);
  const { error } = await supabase.from("component_files").delete().eq("id", fileId);
  if (error) throw error;
}

// Coil models
export async function getEvaporatorCoilModel(componentItemId: string) {
  const { data, error } = await supabase
    .from("evaporator_coil_models")
    .select("*")
    .eq("component_item_id", componentItemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertEvaporatorCoilModel(
  payload: Database["public"]["Tables"]["evaporator_coil_models"]["Insert"],
) {
  const { data, error } = await supabase
    .from("evaporator_coil_models")
    .upsert(payload, { onConflict: "component_item_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCondenserCoilModel(componentItemId: string) {
  const { data, error } = await supabase
    .from("condenser_coil_models")
    .select("*")
    .eq("component_item_id", componentItemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCondenserCoilModel(
  payload: Database["public"]["Tables"]["condenser_coil_models"]["Insert"],
) {
  const { data, error } = await supabase
    .from("condenser_coil_models")
    .upsert(payload, { onConflict: "component_item_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Extractions
export async function recordUnilabExtraction(payload: {
  componentItemId: string;
  componentFileId?: string | null;
  parser: string;
  extractedFields: Record<string, unknown>;
  warnings: string[];
  rawPreview?: string;
  success: boolean;
  userId?: string;
}) {
  const { error } = await supabase.from("unilab_extractions").insert({
    component_item_id: payload.componentItemId,
    component_file_id: payload.componentFileId ?? null,
    parser: payload.parser,
    extracted_fields: payload.extractedFields as never,
    warnings: payload.warnings as never,
    raw_preview: payload.rawPreview ?? null,
    success: payload.success,
    created_by: payload.userId ?? null,
  });
  if (error) throw error;
}

// Coil simulations
export async function recordCoilSimulation(payload: {
  componentItemId: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  warnings: string[];
  userId?: string;
}) {
  const { error } = await supabase.from("coil_simulations").insert({
    component_item_id: payload.componentItemId,
    inputs: payload.inputs as never,
    outputs: payload.outputs as never,
    warnings: payload.warnings as never,
    created_by: payload.userId ?? null,
  });
  if (error) throw error;
}

export async function listCoilSimulations(componentItemId: string) {
  const { data, error } = await supabase
    .from("coil_simulations")
    .select("*")
    .eq("component_item_id", componentItemId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}
