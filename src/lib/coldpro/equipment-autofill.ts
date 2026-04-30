import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TechnicalComponent } from "@/modules/coldpro/library/types";
import {
  getEquipmentReadiness,
  type EquipmentReadiness,
  type EquipmentTechnicalStatus,
} from "@/lib/coldpro/equipment-readiness";
import {
  simulateDxCondenser,
  simulateDxEvaporator,
} from "@/modules/coldpro/adapters/thermalcalcAdapter";
import { saveCoilSimulatorRun } from "@/lib/coldpro/coil-simulations";
import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
} from "@/modules/coldpro/coil/coilSimulatorTypes";

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
  fin_spacing?: number | null;
  tube_outer_diameter?: number | null;
  tube_wall_thickness?: number | null;
  airflow_m3_h?: number | null;
  tube_length_m?: number | null;
  curva_refrigerant?: string | null;
  geral_refrigerante?: string | null;
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

const CONDENSER_REQUIRED_FIELDS = [
  "tubes_per_row",
  "rows",
  "circuits",
  "fin_spacing",
  "tube_outer_diameter",
  "tube_wall_thickness",
  "airflow_m3_h",
  "tube_length_m",
] as const;

function missingCondenserFields(model: CondenserSeed | null | undefined): string[] {
  if (!model) return [...CONDENSER_REQUIRED_FIELDS];
  const aliases: Record<(typeof CONDENSER_REQUIRED_FIELDS)[number], unknown> = {
    tubes_per_row: model.tubes_per_row,
    rows: model.rows,
    circuits: model.circuits,
    fin_spacing: model.fin_spacing ?? model.fin_pitch_mm,
    tube_outer_diameter: model.tube_outer_diameter ?? model.tube_od_mm,
    tube_wall_thickness:
      model.tube_wall_thickness ??
      (model.tube_od_mm != null && model.tube_id_mm != null
        ? (Number(model.tube_od_mm) - Number(model.tube_id_mm)) / 2
        : null),
    airflow_m3_h: model.airflow_m3_h ?? model.nominal_airflow_m3h,
    tube_length_m:
      model.tube_length_m ?? (model.length_mm != null ? Number(model.length_mm) / 1000 : null),
  };
  return CONDENSER_REQUIRED_FIELDS.filter((field) => !isFilled(aliases[field]));
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
  const {
    manufacturer: _manufacturer,
    fin_spacing: _finSpacing,
    tube_outer_diameter: _tubeOuterDiameter,
    tube_wall_thickness: _tubeWallThickness,
    airflow_m3_h: _airflowM3h,
    tube_length_m: _tubeLengthM,
    curva_refrigerant: _curvaRefrigerant,
    geral_refrigerante: _geralRefrigerante,
    ...rest
  } = seed as T & {
    fin_spacing?: unknown;
    tube_outer_diameter?: unknown;
    tube_wall_thickness?: unknown;
    airflow_m3_h?: unknown;
    tube_length_m?: unknown;
    curva_refrigerant?: unknown;
    geral_refrigerante?: unknown;
  };
  return rest;
}

function normalizeCondenserModel(model: CondenserSeed | null | undefined): CondenserInsert {
  const payload = stripComponentMetadata(model) as CondenserInsert;
  if (model?.fin_spacing != null && payload.fin_pitch_mm == null)
    payload.fin_pitch_mm = Number(model.fin_spacing);
  if (model?.tube_outer_diameter != null && payload.tube_od_mm == null) {
    payload.tube_od_mm = Number(model.tube_outer_diameter);
  }
  if (
    model?.tube_wall_thickness != null &&
    payload.tube_id_mm == null &&
    payload.tube_od_mm != null
  ) {
    payload.tube_id_mm = Number(payload.tube_od_mm) - 2 * Number(model.tube_wall_thickness);
  }
  if (model?.airflow_m3_h != null && payload.nominal_airflow_m3h == null) {
    payload.nominal_airflow_m3h = Number(model.airflow_m3_h);
  }
  if (model?.tube_length_m != null && payload.length_mm == null) {
    payload.length_mm = Number(model.tube_length_m) * 1000;
  }
  return payload;
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
  const refrigerantText =
    seed.refrigerant ?? seed.condenser?.curva_refrigerant ?? seed.condenser?.geral_refrigerante;
  if (!refrigerantText && !seed.refrigerantComponentId) {
    warnings.push({ scope: "refrigerant", message: "Sem fluido refrigerante no catálogo." });
  }

  return {
    equipment: {
      code: seed.code,
      commercial_name: seed.commercialName,
      family: seed.family ?? null,
      equipment_kind: seed.equipmentKind ?? "outro",
      application: seed.application ?? "outro",
      refrigerant: refrigerantText ?? null,
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

async function createPlaceholderRefrigerantComponent(
  refrigerant: string,
  warnings: AutoFillWarning[],
): Promise<string | null> {
  const { data, error } = await supabase
    .from("technical_components")
    .insert({
      entity_type: "refrigerant",
      manufacturer: "CN",
      model: refrigerant,
      code: refrigerant,
      status: "mapped",
      source: "CN_INTERNAL",
      context: "reference",
      normalized_json: {
        placeholder: true,
        reason: "created by ColdPro AutoFill because refrigerant was not mapped",
      } as never,
      notes: "Placeholder criado pelo AutoFill; mapear propriedades termofísicas antes de aprovar.",
    })
    .select("id")
    .single();
  if (error) {
    warnings.push({
      scope: "refrigerant",
      message: `Falha ao criar placeholder de fluido ${refrigerant}: ${error.message}`,
    });
    return null;
  }
  warnings.push({
    scope: "refrigerant",
    message: `Fluido ${refrigerant} criado como placeholder needs_mapping.`,
  });
  return data.id;
}

function condenserMissingFields(model: CondenserSeed | null | undefined): string[] {
  const checks: Array<[string, unknown]> = [
    ["tubes_per_row", model?.tubes_per_row],
    ["rows", model?.rows],
    ["circuits", model?.circuits],
    ["fin_spacing", model?.fin_spacing ?? model?.fin_pitch_mm],
    ["tube_outer_diameter", model?.tube_outer_diameter ?? model?.tube_od_mm],
    ["tube_wall_thickness", model?.tube_wall_thickness],
    ["airflow_m3_h", model?.airflow_m3_h ?? model?.nominal_airflow_m3h],
    [
      "tube_length_m",
      model?.tube_length_m ?? (model?.length_mm != null ? Number(model.length_mm) / 1000 : null),
    ],
  ];
  return checks.filter(([, value]) => !isFilled(value)).map(([field]) => field);
}

export async function createCondenserFromCatalog(input: {
  equipmentProjectId: string;
  seed: CatalogEquipmentSeed;
  warnings: AutoFillWarning[];
}): Promise<ComponentItemRow> {
  const missing = condenserMissingFields(input.seed.condenser);
  if (missing.length > 0) {
    input.warnings.push({
      scope: "condenser",
      message: `dados incompletos para condensador: ${missing.join(", ")}`,
    });
  }
  const condenserItem = await insertComponent({
    equipment_project_id: input.equipmentProjectId,
    kind: "condensador",
    manufacturer: input.seed.condenser?.manufacturer ?? "CN",
    model: input.seed.condenser?.description ?? input.seed.code,
    code: input.seed.code,
    description: input.seed.condenser?.description ?? null,
    status: (missing.length > 0
      ? "needs_mapping"
      : componentStatusFor(hasCondenserData(input.seed))) as ComponentItemInsert["status"],
    raw_fields: (input.seed.condenser ?? {}) as never,
    created_by: input.seed.createdBy ?? null,
  });

  const condenserPayload = stripComponentMetadata(input.seed.condenser) as CondenserInsert;
  const { error } = await supabase.from("condenser_coil_models").insert({
    ...condenserPayload,
    component_item_id: condenserItem.id,
    missing_fields: missing as never,
    validation_report: {
      autofill: true,
      warnings: warningsJson(input.warnings),
      missingFields: missing,
    } as never,
    approval_status: missing.length > 0 ? "needs_review" : "mapped",
  });
  if (error) input.warnings.push({ scope: "condenser", message: error.message });
  return condenserItem;
}

function n(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function buildEvaporatorInput(row: EvaporatorInsert): CoilSimulatorInput {
  return {
    mode: "verify",
    coilType: "evaporator",
    label: "AutoSim evaporador",
    geometry: {
      description: row.description ?? undefined,
      finType: "integral",
      tubeArrangement: "staggered",
      tubesPerRow: n(row.tubes_per_row),
      rows: n(row.rows),
      circuits: n(row.circuits),
      coilLengthMm: n(row.length_mm),
      finPitchMm: n(row.fin_pitch_mm),
      tubeOdMm: n(row.tube_od_mm),
      tubeIdMm: n(row.tube_id_mm),
      finThicknessMm: n(row.fin_thickness_mm),
      tubeMaterial: row.tube_material ?? undefined,
      finMaterial: row.fin_material ?? undefined,
    },
    air: {
      airflowM3h: n(row.nominal_airflow_m3h),
      airTempInC: n(row.nominal_air_temp_in_c),
      airTempOutC: n(row.nominal_air_temp_out_c),
      rhInPct: n(row.rh_in_pct),
      altitudeM: n(row.altitude_m),
      airDensityKgM3: n(row.air_density_in_kg_m3),
      airPressureDropPa: n(row.air_pressure_drop_pa),
    },
    refrigerant: {
      refrigerant: row.refrigerant ?? undefined,
      refTempC: n(row.nominal_evap_temp_c),
      massFlowKgs:
        row.refrigerant_mass_flow_kgh != null
          ? Number(row.refrigerant_mass_flow_kgh) / 3600
          : undefined,
      superheatK: n(row.superheat_k),
      subcoolingK: n(row.subcooling_k),
      refrigerantPressureDropKpa: n(row.refrigerant_pressure_drop_kpa),
    },
    nominal:
      row.nominal_capacity_w &&
      row.nominal_air_temp_in_c != null &&
      row.nominal_evap_temp_c != null &&
      row.nominal_airflow_m3h
        ? {
            capacityW: Number(row.nominal_capacity_w),
            airTempInC: Number(row.nominal_air_temp_in_c),
            refTempC: Number(row.nominal_evap_temp_c),
            airflowM3h: Number(row.nominal_airflow_m3h),
          }
        : undefined,
  };
}

function buildCondenserInput(row: CondenserInsert): CoilSimulatorInput {
  return {
    mode: "verify",
    coilType: "condenser",
    label: "AutoSim condensador",
    geometry: {
      description: row.description ?? undefined,
      finType: "integral",
      tubeArrangement: "staggered",
      tubesPerRow: n(row.tubes_per_row),
      rows: n(row.rows),
      circuits: n(row.circuits),
      coilLengthMm: n(row.length_mm),
      finPitchMm: n(row.fin_pitch_mm),
      tubeOdMm: n(row.tube_od_mm),
      tubeIdMm: n(row.tube_id_mm),
      finThicknessMm: n(row.fin_thickness_mm),
      tubeMaterial: row.tube_material ?? undefined,
      finMaterial: row.fin_material ?? undefined,
    },
    air: {
      airflowM3h: n(row.nominal_airflow_m3h),
      airTempInC: n(row.nominal_air_temp_in_c),
      airTempOutC: n(row.nominal_air_temp_out_c),
      rhInPct: n(row.rh_in_pct),
      altitudeM: n(row.altitude_m),
      airDensityKgM3: n(row.air_density_in_kg_m3),
      airPressureDropPa: n(row.air_pressure_drop_pa),
    },
    refrigerant: {
      refrigerant: row.refrigerant ?? undefined,
      refTempC: n(row.nominal_cond_temp_c),
      massFlowKgs:
        row.refrigerant_mass_flow_kgh != null
          ? Number(row.refrigerant_mass_flow_kgh) / 3600
          : undefined,
      subcoolingK: n(row.subcooling_k),
      refrigerantPressureDropKpa: n(row.refrigerant_pressure_drop_kpa),
    },
    nominal:
      row.nominal_capacity_w &&
      row.nominal_air_temp_in_c != null &&
      row.nominal_cond_temp_c != null &&
      row.nominal_airflow_m3h
        ? {
            capacityW: Number(row.nominal_capacity_w),
            airTempInC: Number(row.nominal_air_temp_in_c),
            refTempC: Number(row.nominal_cond_temp_c),
            airflowM3h: Number(row.nominal_airflow_m3h),
          }
        : undefined,
  };
}

export async function simulateEvaporatorFromEquipment(equipmentProjectId: string) {
  const { data: item } = await supabase
    .from("component_items")
    .select("id")
    .eq("equipment_project_id", equipmentProjectId)
    .eq("kind", "evaporador")
    .maybeSingle();
  if (!item) return null;
  const { data: row } = await supabase
    .from("evaporator_coil_models")
    .select("*")
    .eq("component_item_id", item.id)
    .maybeSingle();
  if (!row) return null;
  const input = buildEvaporatorInput(row as EvaporatorInsert);
  const result = simulateDxEvaporator(input);
  await saveCoilSimulatorRun({ equipmentProjectId, componentItemId: item.id, input, result });
  return result;
}

export async function simulateCondenserFromEquipment(equipmentProjectId: string) {
  const { data: item } = await supabase
    .from("component_items")
    .select("id")
    .eq("equipment_project_id", equipmentProjectId)
    .eq("kind", "condensador")
    .maybeSingle();
  if (!item) return null;
  const { data: row } = await supabase
    .from("condenser_coil_models")
    .select("*")
    .eq("component_item_id", item.id)
    .maybeSingle();
  if (!row) return null;
  const input = buildCondenserInput(row as CondenserInsert);
  const result = simulateDxCondenser(input);
  await saveCoilSimulatorRun({ equipmentProjectId, componentItemId: item.id, input, result });
  return result;
}

export async function autoSimulateCoilsIfReady(equipmentProjectId: string) {
  const readiness = await getEquipmentReadiness(equipmentProjectId);
  const evaporatorResult = readiness.canSimulateEvaporator
    ? await simulateEvaporatorFromEquipment(equipmentProjectId)
    : null;
  const condenserResult = readiness.canSimulateCondenser
    ? await simulateCondenserFromEquipment(equipmentProjectId)
    : null;
  console.info("[ColdPro AutoSim]", {
    equipmentProjectId,
    readiness,
    missingFields: readiness.missingFields,
    evaporatorResult,
    condenserResult,
  });
  return { readiness, evaporatorResult, condenserResult };
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

  await createCondenserFromCatalog({
    equipmentProjectId,
    seed,
    warnings,
  });

  const refrigerantText =
    seed.refrigerant ?? seed.condenser?.curva_refrigerant ?? seed.condenser?.geral_refrigerante;
  const refrigerantComponentId =
    seed.refrigerantComponentId ??
    (await findRefrigerantComponent(refrigerantText)) ??
    (refrigerantText
      ? await createPlaceholderRefrigerantComponent(refrigerantText, warnings)
      : null);

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
  const autoSimulation = await autoSimulateCoilsIfReady(equipmentProjectId);

  console.info("[ColdPro AutoFill]", {
    equipmentProjectId,
    readiness,
    autoSimulation,
    warnings,
  });

  return { equipmentProjectId, warnings, readiness };
}

export async function createEquipmentFromCatalog(
  seed: CatalogEquipmentSeed,
): Promise<AutoFillCommitResult> {
  return commitAutoFillFromCnCatalog(seed);
}
