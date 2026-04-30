/**
 * Service layer para `equipment_component_links`: vínculo entre um equipamento
 * ColdPro e componentes da Biblioteca Técnica (compressor, ventiladores,
 * válvula, fluido, etc.).
 *
 * Camada fina sobre Supabase — sem lógica de cálculo.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TechnicalComponent } from "@/modules/coldpro/library/types";

export type EquipmentComponentRole =
  | "evaporator"
  | "condenser"
  | "compressor"
  | "fan_evaporator"
  | "fan_condenser"
  | "valve"
  | "fluid"
  | "other";

export const EQUIPMENT_COMPONENT_ROLE_LABELS: Record<EquipmentComponentRole, string> = {
  evaporator: "Evaporador",
  condenser: "Condensador",
  compressor: "Compressor",
  fan_evaporator: "Ventilador (evaporador)",
  fan_condenser: "Ventilador (condensador)",
  valve: "Válvula",
  fluid: "Fluido refrigerante",
  other: "Outro",
};

export interface EquipmentComponentLink {
  id: string;
  equipment_project_id: string;
  technical_component_id: string;
  role: EquipmentComponentRole;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface EquipmentComponentLinkExpanded extends EquipmentComponentLink {
  component: TechnicalComponent | null;
}

export async function listEquipmentComponentLinks(
  equipmentProjectId: string,
): Promise<EquipmentComponentLinkExpanded[]> {
  const { data: links, error } = await supabase
    .from("equipment_component_links")
    .select("*")
    .eq("equipment_project_id", equipmentProjectId)
    .order("role", { ascending: true });
  if (error) throw new Error(error.message);
  if (!links || links.length === 0) return [];

  const componentIds = Array.from(
    new Set(links.map((l) => l.technical_component_id).filter(Boolean)),
  );
  const { data: components } = await supabase
    .from("technical_components")
    .select("*")
    .in("id", componentIds);

  const byId = new Map<string, TechnicalComponent>();
  for (const c of (components ?? []) as TechnicalComponent[]) byId.set(c.id, c);

  return (links as EquipmentComponentLink[]).map((l) => ({
    ...l,
    component: byId.get(l.technical_component_id) ?? null,
  }));
}

export async function addEquipmentComponentLink(input: {
  equipmentProjectId: string;
  technicalComponentId: string;
  role: EquipmentComponentRole;
  quantity?: number;
  notes?: string;
}): Promise<EquipmentComponentLink> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("equipment_component_links")
    .insert([
      {
        equipment_project_id: input.equipmentProjectId,
        technical_component_id: input.technicalComponentId,
        role: input.role,
        quantity: input.quantity ?? 1,
        notes: input.notes ?? null,
        created_by: userData.user?.id ?? null,
      },
    ])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as EquipmentComponentLink;
}

export async function removeEquipmentComponentLink(linkId: string): Promise<void> {
  const { error } = await supabase.from("equipment_component_links").delete().eq("id", linkId);
  if (error) throw new Error(error.message);
}
