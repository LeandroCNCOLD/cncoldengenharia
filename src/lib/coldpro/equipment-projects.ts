import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EquipmentProject = Database["public"]["Tables"]["equipment_projects"]["Row"];
export type EquipmentProjectInsert = Database["public"]["Tables"]["equipment_projects"]["Insert"];
export type EquipmentProjectUpdate = Database["public"]["Tables"]["equipment_projects"]["Update"];

const EQUIPMENT_PROJECT_LIST_COLUMNS =
  "id, code, commercial_name, equipment_kind, application, family, refrigerant, status, target_capacity, target_temperature, updated_at, created_at, created_by";

export async function listEquipmentProjects(limit = 100) {
  const { data, error } = await supabase
    .from("equipment_projects")
    .select(EQUIPMENT_PROJECT_LIST_COLUMNS)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as EquipmentProject[];
}

export async function getEquipmentProject(id: string) {
  const { data, error } = await supabase
    .from("equipment_projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createEquipmentProject(input: EquipmentProjectInsert) {
  const { data, error } = await supabase.from("equipment_projects").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateEquipmentProject(id: string, patch: EquipmentProjectUpdate) {
  const { data, error } = await supabase
    .from("equipment_projects")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveEquipmentProject(id: string) {
  return updateEquipmentProject(id, { status: "archived" });
}

export async function deleteEquipmentProject(id: string) {
  const { error } = await supabase.from("equipment_projects").delete().eq("id", id);
  if (error) throw error;
}
