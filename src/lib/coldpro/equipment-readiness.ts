import { supabase } from "@/integrations/supabase/client";
import type { EquipmentComponentRole } from "@/lib/coldpro/equipment-component-links";

export interface EquipmentReadiness {
  equipmentProjectId: string;
  technicalStatus: EquipmentTechnicalStatus;
  status: EquipmentTechnicalStatus;
  hasEvaporator: boolean;
  hasCondenser: boolean;
  hasCompressor: boolean;
  hasEvapFan: boolean;
  hasCondFan: boolean;
  hasRefrigerant: boolean;
  canSimulateEvaporator: boolean;
  canSimulateCondenser: boolean;
  canSimulateSystem: boolean;
  missingFields: string[];
}

export type EquipmentTechnicalStatus =
  | "draft"
  | "autofilled"
  | "evap_ready"
  | "cond_ready"
  | "components_ready"
  | "simulation_ready"
  | "simulated"
  | "needs_review";

interface ComponentItem {
  id: string;
  kind: string;
  status: string;
}

function hasUsableStatus(status: string | null | undefined) {
  return status === "validated" || status === "approved" || status === "simulated";
}

async function hasEvaporatorModel(componentId: string | undefined): Promise<boolean> {
  if (!componentId) return false;
  const { data } = await supabase
    .from("evaporator_coil_models")
    .select(
      "component_item_id, nominal_capacity_w, nominal_airflow_m3h, nominal_evap_temp_c, refrigerant",
    )
    .eq("component_item_id", componentId)
    .maybeSingle();
  return Boolean(
    data?.nominal_capacity_w &&
    data.nominal_airflow_m3h &&
    data.nominal_evap_temp_c != null &&
    data.refrigerant,
  );
}

async function hasCondenserModel(componentId: string | undefined): Promise<boolean> {
  if (!componentId) return false;
  const { data } = await supabase
    .from("condenser_coil_models")
    .select(
      "component_item_id, nominal_capacity_w, nominal_airflow_m3h, nominal_cond_temp_c, refrigerant",
    )
    .eq("component_item_id", componentId)
    .maybeSingle();
  return Boolean(
    data?.nominal_capacity_w &&
    data.nominal_airflow_m3h &&
    data.nominal_cond_temp_c != null &&
    data.refrigerant,
  );
}

export async function getEquipmentReadiness(
  equipmentProjectId: string,
): Promise<EquipmentReadiness> {
  const { data: items, error: itemError } = await supabase
    .from("component_items")
    .select("id, kind, status")
    .eq("equipment_project_id", equipmentProjectId);
  if (itemError) throw itemError;

  const { data: links, error: linkError } = await supabase
    .from("equipment_component_links")
    .select("role")
    .eq("equipment_project_id", equipmentProjectId);
  if (linkError) throw linkError;

  const componentItems = (items ?? []) as ComponentItem[];
  const roles = new Set((links ?? []).map((link) => link.role as EquipmentComponentRole));

  const evaporator = componentItems.find((item) => item.kind === "evaporador");
  const condenser = componentItems.find((item) => item.kind === "condensador");
  const hasEvaporator = Boolean(evaporator);
  const hasCondenser = Boolean(condenser);
  const hasCompressor = roles.has("compressor");
  const hasEvapFan = roles.has("fan_evaporator");
  const hasCondFan = roles.has("fan_condenser");
  const hasRefrigerant = roles.has("fluid");
  const canSimulateEvaporator =
    hasEvaporator &&
    hasUsableStatus(evaporator?.status) &&
    (await hasEvaporatorModel(evaporator?.id));
  const canSimulateCondenser =
    hasCondenser && hasUsableStatus(condenser?.status) && (await hasCondenserModel(condenser?.id));

  const missingFields: string[] = [];
  if (!hasEvaporator) missingFields.push("evaporator component_item");
  if (hasEvaporator && !canSimulateEvaporator) missingFields.push("evaporator_coil_model completo");
  if (!hasCondenser) missingFields.push("condenser component_item");
  if (hasCondenser && !canSimulateCondenser) missingFields.push("condenser_coil_model completo");
  if (!hasCompressor) missingFields.push("compressor sugerido");
  if (!hasEvapFan) missingFields.push("ventilador do evaporador");
  if (!hasCondFan) missingFields.push("ventilador do condensador");
  if (!hasRefrigerant) missingFields.push("fluido refrigerante");

  const technicalStatus = readinessStatus({
    equipmentProjectId,
    hasEvaporator,
    hasCondenser,
    hasCompressor,
    hasEvapFan,
    hasCondFan,
    hasRefrigerant,
    canSimulateEvaporator,
    canSimulateCondenser,
    canSimulateSystem:
      canSimulateEvaporator &&
      canSimulateCondenser &&
      hasCompressor &&
      hasEvapFan &&
      hasCondFan &&
      hasRefrigerant,
    missingFields,
  } as EquipmentReadiness);

  return {
    equipmentProjectId,
    technicalStatus,
    status: technicalStatus,
    hasEvaporator,
    hasCondenser,
    hasCompressor,
    hasEvapFan,
    hasCondFan,
    hasRefrigerant,
    canSimulateEvaporator,
    canSimulateCondenser,
    canSimulateSystem:
      canSimulateEvaporator &&
      canSimulateCondenser &&
      hasCompressor &&
      hasEvapFan &&
      hasCondFan &&
      hasRefrigerant,
    missingFields,
  };
}

export function readinessStatus(readiness: EquipmentReadiness): EquipmentTechnicalStatus {
  if (readiness.canSimulateSystem) return "simulation_ready";
  if (
    readiness.canSimulateEvaporator &&
    readiness.canSimulateCondenser &&
    readiness.hasCompressor &&
    readiness.hasEvapFan &&
    readiness.hasCondFan &&
    readiness.hasRefrigerant
  ) {
    return "components_ready";
  }
  if (readiness.canSimulateEvaporator && readiness.canSimulateCondenser) return "cond_ready";
  if (readiness.canSimulateEvaporator) return "evap_ready";
  if (readiness.hasEvaporator || readiness.hasCondenser) return "autofilled";
  return "needs_review";
}

export function logEquipmentReadiness(readiness: EquipmentReadiness) {
  console.info("[ColdPro readiness]", {
    equipmentProjectId: readiness.equipmentProjectId,
    status: readiness.technicalStatus,
    canSimulateEvaporator: readiness.canSimulateEvaporator,
    canSimulateCondenser: readiness.canSimulateCondenser,
    canSimulateSystem: readiness.canSimulateSystem,
    missingFields: readiness.missingFields,
  });
}
