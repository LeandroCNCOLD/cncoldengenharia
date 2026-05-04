import { supabase } from "@/integrations/supabase/client";

export const LIBRARY_ENTITIES = [
  "projects",
  "evaporators",
  "condensers",
  "compressors",
  "fans",
  "refrigerants",
  "cycle_simulations",
] as const;

export type EntityKey = (typeof LIBRARY_ENTITIES)[number];

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "json";
  width?: "full" | "half";
}

export interface EntityConfig {
  key: EntityKey;
  label: string;
  table: string;
  listColumns: { key: string; label: string }[];
  fields: FieldDef[];
}

export const ENTITY_CONFIG: Record<EntityKey, EntityConfig> = {
  projects: {
    key: "projects",
    label: "Projetos",
    table: "projects",
    listColumns: [
      { key: "name", label: "Nome" },
      { key: "client", label: "Cliente" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Nome do projeto", type: "text", width: "full" },
      { key: "client", label: "Cliente", type: "text", width: "half" },
      { key: "status", label: "Status", type: "text", width: "half" },
      { key: "description", label: "Descrição", type: "textarea", width: "full" },
    ],
  },
  evaporators: {
    key: "evaporators",
    label: "Evaporadores",
    table: "evaporators",
    listColumns: [
      { key: "name", label: "Nome" },
      { key: "model", label: "Modelo" },
      { key: "refrigerant", label: "Fluido" },
      { key: "capacity_w", label: "Capacidade (W)" },
    ],
    fields: [
      { key: "name", label: "Nome", type: "text", width: "full" },
      { key: "model", label: "Modelo", type: "text", width: "half" },
      { key: "refrigerant", label: "Fluido refrigerante", type: "text", width: "half" },
      { key: "capacity_w", label: "Capacidade (W)", type: "number", width: "half" },
      { key: "evap_temp_c", label: "T. evaporação (°C)", type: "number", width: "half" },
      { key: "superheat_k", label: "Superaquecimento (K)", type: "number", width: "half" },
      { key: "air_flow_m3h", label: "Vazão de ar (m³/h)", type: "number", width: "half" },
      { key: "air_inlet_temp_c", label: "T. entrada ar (°C)", type: "number", width: "half" },
      { key: "air_inlet_rh", label: "UR entrada (%)", type: "number", width: "half" },
      { key: "notes", label: "Notas", type: "textarea", width: "full" },
    ],
  },
  condensers: {
    key: "condensers",
    label: "Condensadores",
    table: "condensers",
    listColumns: [
      { key: "name", label: "Nome" },
      { key: "model", label: "Modelo" },
      { key: "type", label: "Tipo" },
      { key: "capacity_w", label: "Capacidade (W)" },
    ],
    fields: [
      { key: "name", label: "Nome", type: "text", width: "full" },
      { key: "model", label: "Modelo", type: "text", width: "half" },
      { key: "type", label: "Tipo (ar/água)", type: "text", width: "half" },
      { key: "refrigerant", label: "Fluido", type: "text", width: "half" },
      { key: "capacity_w", label: "Capacidade (W)", type: "number", width: "half" },
      { key: "cond_temp_c", label: "T. condensação (°C)", type: "number", width: "half" },
      { key: "subcooling_k", label: "Subresfriamento (K)", type: "number", width: "half" },
      { key: "air_flow_m3h", label: "Vazão de ar (m³/h)", type: "number", width: "half" },
      { key: "ambient_temp_c", label: "T. ambiente (°C)", type: "number", width: "half" },
      { key: "notes", label: "Notas", type: "textarea", width: "full" },
    ],
  },
  compressors: {
    key: "compressors",
    label: "Compressores",
    table: "compressors",
    listColumns: [
      { key: "name", label: "Nome" },
      { key: "manufacturer", label: "Fabricante" },
      { key: "model", label: "Modelo" },
      { key: "refrigerant", label: "Fluido" },
      { key: "capacity_w", label: "Capacidade (W)" },
    ],
    fields: [
      { key: "name", label: "Nome", type: "text", width: "full" },
      { key: "manufacturer", label: "Fabricante", type: "text", width: "half" },
      { key: "model", label: "Modelo", type: "text", width: "half" },
      { key: "refrigerant", label: "Fluido", type: "text", width: "half" },
      { key: "evap_temp_c", label: "T. evap (°C)", type: "number", width: "half" },
      { key: "cond_temp_c", label: "T. cond (°C)", type: "number", width: "half" },
      { key: "capacity_w", label: "Capacidade (W)", type: "number", width: "half" },
      { key: "power_kw", label: "Potência (kW)", type: "number", width: "half" },
      { key: "cop", label: "COP", type: "number", width: "half" },
      { key: "notes", label: "Notas", type: "textarea", width: "full" },
    ],
  },
  fans: {
    key: "fans",
    label: "Ventiladores",
    table: "fans",
    listColumns: [
      { key: "name", label: "Nome" },
      { key: "manufacturer", label: "Fabricante" },
      { key: "model", label: "Modelo" },
      { key: "type", label: "Tipo" },
      { key: "air_flow_m3h", label: "Vazão (m³/h)" },
    ],
    fields: [
      { key: "name", label: "Nome", type: "text", width: "full" },
      { key: "manufacturer", label: "Fabricante", type: "text", width: "half" },
      { key: "model", label: "Modelo", type: "text", width: "half" },
      { key: "type", label: "Tipo (axial/centrífugo)", type: "text", width: "half" },
      { key: "diameter_mm", label: "Diâmetro (mm)", type: "number", width: "half" },
      { key: "air_flow_m3h", label: "Vazão (m³/h)", type: "number", width: "half" },
      { key: "static_pressure_pa", label: "Pressão estática (Pa)", type: "number", width: "half" },
      { key: "power_w", label: "Potência (W)", type: "number", width: "half" },
      { key: "voltage_v", label: "Tensão (V)", type: "number", width: "half" },
      { key: "notes", label: "Notas", type: "textarea", width: "full" },
    ],
  },
  refrigerants: {
    key: "refrigerants",
    label: "Fluidos refrigerantes",
    table: "refrigerants",
    listColumns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Nome" },
      { key: "family", label: "Família" },
      { key: "gwp", label: "GWP" },
      { key: "classification", label: "Classe seg." },
    ],
    fields: [
      { key: "code", label: "Código (ex: R-410A)", type: "text", width: "half" },
      { key: "name", label: "Nome", type: "text", width: "half" },
      { key: "family", label: "Família (HFC/HFO/...)", type: "text", width: "half" },
      { key: "classification", label: "Classificação (A1/A2L/...)", type: "text", width: "half" },
      { key: "gwp", label: "GWP", type: "number", width: "half" },
      { key: "odp", label: "ODP", type: "number", width: "half" },
      { key: "notes", label: "Notas", type: "textarea", width: "full" },
    ],
  },
  cycle_simulations: {
    key: "cycle_simulations",
    label: "Simulações de ciclo",
    table: "cycle_simulations",
    listColumns: [
      { key: "name", label: "Nome" },
      { key: "refrigerant", label: "Fluido" },
      { key: "capacity_w", label: "Capacidade (W)" },
      { key: "cop", label: "COP" },
    ],
    fields: [
      { key: "name", label: "Nome", type: "text", width: "full" },
      { key: "refrigerant", label: "Fluido", type: "text", width: "half" },
      { key: "evap_temp_c", label: "T. evap (°C)", type: "number", width: "half" },
      { key: "cond_temp_c", label: "T. cond (°C)", type: "number", width: "half" },
      { key: "capacity_w", label: "Capacidade (W)", type: "number", width: "half" },
      { key: "cop", label: "COP", type: "number", width: "half" },
      { key: "notes", label: "Notas", type: "textarea", width: "full" },
    ],
  },
};

// Generic CRUD using the browser supabase client (RLS applies)
export async function listItems(entity: EntityKey) {
  const { data, error } = await supabase
    .from(entity)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getItem(entity: EntityKey, id: string) {
  const { data, error } = await supabase.from(entity).select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createItem(entity: EntityKey, payload: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  const created_by = auth.user?.id;
  if (!created_by) throw new Error("Usuário não autenticado");
  const { data, error } = await supabase
    .from(entity)
    .insert({ ...payload, created_by })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(
  entity: EntityKey,
  id: string,
  payload: Record<string, unknown>,
) {
  const { created_by: _ignored, id: _id, ...rest } = payload as Record<string, unknown>;
  void _ignored;
  void _id;
  const { data, error } = await supabase
    .from(entity)
    .update(rest)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(entity: EntityKey, id: string) {
  const { error } = await supabase.from(entity).delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateItem(entity: EntityKey, id: string) {
  const item = await getItem(entity, id);
  const copy: Record<string, unknown> = { ...item };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.created_by;
  if (typeof copy.name === "string") copy.name = `${copy.name} (cópia)`;
  if (typeof copy.code === "string") copy.code = `${copy.code}-COPY`;
  return createItem(entity, copy);
}
