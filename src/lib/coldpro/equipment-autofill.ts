import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TechnicalComponent } from "@/modules/coldpro/library/types";
import {
  getEquipmentReadiness,
  type EquipmentReadiness,
  type EquipmentTechnicalStatus,
} from "@/lib/coldpro/equipment-readiness";

type EquipmentProjectInsert = Database["public"]["Tables"]["equipment_projects"]["Insert"];
type ComponentItemInsert = Database["public"]["Tables"]["component_items"]["Insert"];
type ComponentItemRow = Database["public"]["Tables"]["component_items"]["Row"];
type EvaporatorInsert = Database["public"]["Tables"]["evaporator_coil_models"]["Insert"];
type CondenserInsert = Database["public"]["Tables"]["condenser_coil_models"]["Insert"];
type EquipmentComponentRole = Database["public"]["Enums"]["equipment_component_role"];
type Json = Database["public"]["Tables"]["evaporator_coil_models"]["Insert"]["validation_report"];

type EvaporatorSeed = Partial<EvaporatorInsert> & {
  manufacturer?: string | null;
  description?: string | null;
};
type CondenserSeed = Partial<CondenserInsert> & {
  manufacturer?: string | null;
  description?: string | null;
};

export interface CatalogEquipmentSeed {
  code: string;
  commercialName: string;
  family?: string | null;
  equipmentKind?: EquipmentProjectInsert["equipment_kind"];
  application?: EquipmentProjectInsert["application"];
  refrigerant?: string | null;
  targetTemperature?: number | null;
  targetCapacity?: number | null;
  evaporator?: EvaporatorSeed | null;
  condenser?: CondenserSeed | null;
  compressorComponentId?: string | null;
  evaporatorFanComponentId?: string | null;
  condenserFanComponentId?: string | null;
  refrigerantComponentId?: string | null;
  createdBy?: string | null;
}

export interface AutoFillWarning {
  scope: string;
  message: string;
}

export interface AutoFillPreview {
  equipment: EquipmentProjectInsert;
  willCreate: {
    evaporatorItem: boolean;
    evaporatorModel: boolean;
    condenserItem: boolean;
    condenserModel: boolean;
    compressorLink: boolean;
    evaporatorFanLink: boolean;
    condenserFanLink: boolean;
    refrigerantLink: boolean;
  };
  warnings: AutoFillWarning[];
}

export interface AutoFillCommitResult {
  equipmentProjectId: string;
  warnings: AutoFillWarning[];
  readiness: EquipmentReadiness;
}

function isFilled(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function hasEvaporatorData(seed: CatalogEquipmentSeed) {
  const evap = seed.evaporator;
  return Boolean(
    evap &&
    (isFilled(evap.nominal_capacity_w) ||
      isFilled(evap.nominal_evap_temp_c) ||
      isFilled(evap.nominal_airflow_m3h) ||
      isFilled(evap.rows) ||
      isFilled(evap.tubes_per_row)),
  );
}

function hasCondenserData(seed: CatalogEquipmentSeed) {
  const cond = seed.condenser;
  return Boolean(
    cond &&
    (isFilled(cond.nominal_capacity_w) ||
      isFilled(cond.nominal_cond_temp_c) ||
      isFilled(cond.nominal_airflow_m3h) ||
      isFilled(cond.rows) ||
      isFilled(cond.tubes_per_row)),
  );
}

function componentStatusFor(hasData: boolean): ComponentItemInsert["status"] {
  return (hasData ? "imported" : "needs_mapping") as ComponentItemInsert["status"];
}

function warningsJson(warnings: AutoFillWarning[]): Json {
  return warnings.map((warning) => ({
    scope: warning.scope,
    message: warning.message,
  })) as Json;
}

function stripComponentMetadata<T extends { manufacturer?: unknown }>(seed: T | null | undefined) {
  if (!seed) return {};
  const { manufacturer: _manufacturer, ...rest } = seed;
  return rest;
}

export function previewAutoFillFromCnCatalog(seed: CatalogEquipmentSeed): AutoFillPreview {
  const warnings: AutoFillWarning[] = [];
  const evaporatorHasData = hasEvaporatorData(seed);
  const condenserHasData = hasCondenserData(seed);

  if (!evaporatorHasData) {
    warnings.push({
      scope: "evaporator",
      message: "Catálogo sem dados suficientes de evaporador; será criado item needs_mapping.",
    });
  }
  if (!condenserHasData) {
    warnings.push({
      scope: "condenser",
      message: "Catálogo sem dados suficientes de condensador; será criado item needs_mapping.",
    });
  }
  if (!seed.compressorComponentId) {
    warnings.push({ scope: "compressor", message: "Sem compressor sugerido no catálogo." });
  }
  if (!seed.evaporatorFanComponentId) {
    warnings.push({ scope: "fan_evaporator", message: "Sem ventilador de evaporador sugerido." });
  }
  if (!seed.condenserFanComponentId) {
    warnings.push({ scope: "fan_condenser", message: "Sem ventilador de condensador sugerido." });
  }
  if (!seed.refrigerant && !seed.refrigerantComponentId) {
    warnings.push({ scope: "refrigerant", message: "Sem fluido refrigerante no catálogo." });
  }

  return {
    equipment: {
      code: seed.code,
      commercial_name: seed.commercialName,
      family: seed.family ?? null,
      equipment_kind: seed.equipmentKind ?? "outro",
      application: seed.application ?? "outro",
      refrigerant: seed.refrigerant ?? null,
      target_temperature: seed.targetTemperature ?? null,
      target_capacity: seed.targetCapacity ?? null,
      status: "autofilled" as EquipmentProjectInsert["status"],
      created_by: seed.createdBy ?? null,
      notes: warnings.length
        ? `AutoFill CN com pendências: ${warnings.map((w) => `${w.scope}: ${w.message}`).join("; ")}`
        : "AutoFill CN completo.",
    },
    willCreate: {
      evaporatorItem: true,
      evaporatorModel: evaporatorHasData,
      condenserItem: true,
      condenserModel: condenserHasData,
      compressorLink: Boolean(seed.compressorComponentId),
      evaporatorFanLink: Boolean(seed.evaporatorFanComponentId),
      condenserFanLink: Boolean(seed.condenserFanComponentId),
      refrigerantLink: Boolean(seed.refrigerantComponentId),
    },
    warnings,
  };
}

async function insertComponent(input: ComponentItemInsert): Promise<ComponentItemRow> {
  const { data, error } = await supabase.from("component_items").insert(input).select("*").single();
  if (error) throw new Error(`component_items: ${error.message}`);
  return data;
}

async function linkTechnicalComponent(input: {
  equipmentProjectId: string;
  technicalComponentId?: string | null;
  role: EquipmentComponentRole;
  warnings: AutoFillWarning[];
}) {
  if (!input.technicalComponentId) return;
  const { error } = await supabase.from("equipment_component_links").insert({
    equipment_project_id: input.equipmentProjectId,
    technical_component_id: input.technicalComponentId,
    role: input.role,
    quantity: 1,
  });
  if (error) {
    input.warnings.push({ scope: input.role, message: `Falha ao criar vínculo: ${error.message}` });
  }
}

async function findRefrigerantComponent(refrigerant?: string | null): Promise<string | null> {
  if (!refrigerant) return null;
  const normalized = refrigerant.replace("-", "").toUpperCase();
  const { data } = await supabase
    .from("technical_components")
    .select("id, code, model")
    .in("entity_type", ["refrigerant", "fluid"])
    .in("status", ["approved", "validated"])
    .limit(100);
  const match = (data as TechnicalComponent[] | null)?.find((c) => {
    const code = (c.code ?? c.model ?? "").replace("-", "").toUpperCase();
    return code === normalized;
  });
  return match?.id ?? null;
}

async function updateEquipmentStatus(equipmentProjectId: string, status: EquipmentTechnicalStatus) {
  const { error } = await supabase
    .from("equipment_projects")
    .update({
      status: status as Database["public"]["Tables"]["equipment_projects"]["Update"]["status"],
    })
    .eq("id", equipmentProjectId);
  if (error) {
    // Older databases may not have the new enum labels yet; readiness still reports correctly.
    console.warn(`[ColdPro AutoFill] status ${status} not persisted: ${error.message}`);
  }
}

export async function commitAutoFillFromCnCatalog(
  seed: CatalogEquipmentSeed,
): Promise<AutoFillCommitResult> {
  const preview = previewAutoFillFromCnCatalog(seed);
  const warnings = [...preview.warnings];

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment_projects")
    .insert(preview.equipment)
    .select("*")
    .single();
  if (equipmentError) throw new Error(`equipment_projects: ${equipmentError.message}`);

  const equipmentProjectId = equipment.id;
  const evaporatorItem = await insertComponent({
    equipment_project_id: equipmentProjectId,
    kind: "evaporador",
    manufacturer: seed.evaporator?.manufacturer ?? "CN",
    model: seed.evaporator?.description ?? seed.code,
    code: seed.code,
    description: seed.evaporator?.description ?? null,
    status: componentStatusFor(hasEvaporatorData(seed)),
    raw_fields: (seed.evaporator ?? {}) as never,
    created_by: seed.createdBy ?? null,
  });
  const condenserItem = await insertComponent({
    equipment_project_id: equipmentProjectId,
    kind: "condensador",
    manufacturer: seed.condenser?.manufacturer ?? "CN",
    model: seed.condenser?.description ?? seed.code,
    code: seed.code,
    description: seed.condenser?.description ?? null,
    status: componentStatusFor(hasCondenserData(seed)),
    raw_fields: (seed.condenser ?? {}) as never,
    created_by: seed.createdBy ?? null,
  });

  if (hasEvaporatorData(seed)) {
    const evaporatorPayload = stripComponentMetadata(seed.evaporator) as EvaporatorInsert;
    const { error } = await supabase.from("evaporator_coil_models").insert({
      ...evaporatorPayload,
      component_item_id: evaporatorItem.id,
      missing_fields: [] as never,
      validation_report: { autofill: true, warnings: warningsJson(warnings) } as never,
      approval_status: "mapped",
    });
    if (error) warnings.push({ scope: "evaporator", message: error.message });
  }

  if (hasCondenserData(seed)) {
    const condenserPayload = stripComponentMetadata(seed.condenser) as CondenserInsert;
    const { error } = await supabase.from("condenser_coil_models").insert({
      ...condenserPayload,
      component_item_id: condenserItem.id,
      missing_fields: [] as never,
      validation_report: { autofill: true, warnings: warningsJson(warnings) } as never,
      approval_status: "mapped",
    });
    if (error) warnings.push({ scope: "condenser", message: error.message });
  }

  const refrigerantComponentId =
    seed.refrigerantComponentId ?? (await findRefrigerantComponent(seed.refrigerant));
  if (seed.refrigerant && !refrigerantComponentId) {
    warnings.push({
      scope: "refrigerant",
      message: `Fluido ${seed.refrigerant} não encontrado na Biblioteca Técnica.`,
    });
  }

  await linkTechnicalComponent({
    equipmentProjectId,
    technicalComponentId: seed.compressorComponentId,
    role: "compressor",
    warnings,
  });
  await linkTechnicalComponent({
    equipmentProjectId,
    technicalComponentId: seed.evaporatorFanComponentId,
    role: "fan_evaporator",
    warnings,
  });
  await linkTechnicalComponent({
    equipmentProjectId,
    technicalComponentId: seed.condenserFanComponentId,
    role: "fan_condenser",
    warnings,
  });
  await linkTechnicalComponent({
    equipmentProjectId,
    technicalComponentId: refrigerantComponentId,
    role: "fluid",
    warnings,
  });

  const readiness = await getEquipmentReadiness(equipmentProjectId);
  await updateEquipmentStatus(equipmentProjectId, readiness.status);

  console.info("[ColdPro AutoFill]", {
    equipmentProjectId,
    readiness,
    warnings,
  });

  return { equipmentProjectId, warnings, readiness };
}

export async function createEquipmentFromCatalog(
  seed: CatalogEquipmentSeed,
): Promise<AutoFillCommitResult> {
  return commitAutoFillFromCnCatalog(seed);
}
