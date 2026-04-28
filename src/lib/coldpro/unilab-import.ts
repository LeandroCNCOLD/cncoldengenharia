/**
 * Pipeline de importação Unilab → modelo técnico.
 * - Detecta tipo (evap/cond)
 * - Roda parser correto
 * - Calcula derivados (DT nominal, sensible ratio, área frontal)
 * - Valida campos mínimos
 * - Marca origem ("unilab") por campo (field_sources)
 * - Não aprova automaticamente: define imported / needs_review / validated
 */
import type { UnilabEvaporatorFields } from "@/modules/coldpro/unilab/unilabEvaporatorParser";
import type { UnilabCondenserFields } from "@/modules/coldpro/unilab/unilabCondenserParser";

export type FieldSource = "unilab" | "manual" | "calculated";

export interface ValidationIssue {
  field?: string;
  level: "error" | "warning";
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
  missingRequired: string[];
  computed: Record<string, number>;
  checkedAt: string;
}

// ---- Mapeamentos parser key → coluna no DB ----

export const EVAP_FIELD_MAP: Record<string, keyof UnilabEvaporatorFields> = {
  nominal_capacity_w: "totalCapacityW",
  nominal_sensible_w: "sensibleCapacityW",
  nominal_latent_w: "latentCapacityW",
  sensible_ratio: "sensibleRatio",
  water_production_kgh: "waterProductionKgh",
  surface_area_m2: "surfaceAreaM2",
  global_coeff_w: "globalCoeffW",
  delta_h_log_kjkg: "deltaHLogKjkg",
  fin_material: "finMaterial",
  tube_material: "tubeMaterial",
  fin_thickness_mm: "finThicknessMm",
  internal_volume_l: "internalVolumeL",
  atm_pressure_bar: "atmPressureBar",
  altitude_m: "altitudeM",
  nominal_airflow_m3h: "airflowM3h",
  nominal_air_mass_flow_kgh: "airMassFlowKgh",
  face_velocity_ms: "frontalVelocityMs",
  air_density_in_kg_m3: "airDensityInKgM3",
  nominal_air_temp_in_c: "airTempInC",
  rh_in_pct: "rhInPct",
  spec_hum_in_g_kg: "specHumInGkg",
  enthalpy_in_kjkg: "enthalpyInKjkg",
  nominal_air_temp_out_c: "airTempOutC",
  rh_out_pct: "rhOutPct",
  spec_hum_out_g_kg: "specHumOutGkg",
  enthalpy_out_kjkg: "enthalpyOutKjkg",
  air_pressure_drop_pa: "airPressureDropPa",
  refrigerant_mass_flow_kgh: "refrigerantMassFlowKgh",
  mass_velocity_kg_m2s: "massVelocityKgM2s",
  vapour_velocity_ms: "vapourVelocityMs",
  liquid_velocity_ms: "liquidVelocityMs",
  subcooling_k: "subcoolingK",
  superheat_k: "superheatK",
  nominal_evap_temp_c: "evapTempC",
  refrigerant_pressure_drop_kpa: "refrigerantPressureDropKpa",
  manifold_pressure_drop_kpa: "manifoldPressureDropKpa",
  total_ref_pressure_drop_kpa: "totalRefPressureDropKpa",
  circuits: "circuits",
  tubes_per_row: "tubesPerRow",
  rows: "rows",
  fin_pitch_mm: "finPitchMm",
  length_mm: "lengthMm",
  tube_shape: "tubeShape",
  tube_od_mm: "tubeOdMm",
  tube_id_mm: "tubeIdMm",
  refrigerant: "refrigerant",
  description: "description",
};

export const COND_FIELD_MAP: Record<string, keyof UnilabCondenserFields> = {
  nominal_capacity_w: "totalCapacityW",
  global_coeff_w: "globalCoeffW",
  delta_t_log_k: "deltaTLogK",
  surface_area_m2: "surfaceAreaM2",
  internal_volume_l: "internalVolumeL",
  fin_material: "finMaterial",
  tube_material: "tubeMaterial",
  fin_thickness_mm: "finThicknessMm",
  atm_pressure_bar: "atmPressureBar",
  altitude_m: "altitudeM",
  nominal_airflow_m3h: "airflowM3h",
  air_mass_flow_kgh: "airMassFlowKgh",
  face_velocity_ms: "frontalVelocityMs",
  air_density_in_kg_m3: "airDensityInKgM3",
  nominal_air_temp_in_c: "airTempInC",
  rh_in_pct: "rhInPct",
  spec_hum_in_g_kg: "specHumInGkg",
  enthalpy_in_kjkg: "enthalpyInKjkg",
  nominal_air_temp_out_c: "airTempOutC",
  rh_out_pct: "rhOutPct",
  spec_hum_out_g_kg: "specHumOutGkg",
  enthalpy_out_kjkg: "enthalpyOutKjkg",
  air_pressure_drop_pa: "airPressureDropPa",
  refrigerant_mass_flow_kgh: "refrigerantMassFlowKgh",
  mass_velocity_kg_m2s: "massVelocityKgM2s",
  vapour_velocity_ms: "vapourVelocityMs",
  liquid_velocity_ms: "liquidVelocityMs",
  subcooling_k: "subcoolingK",
  desuperheat_k: "desuperheatK",
  nominal_cond_temp_c: "condTempC",
  refrigerant_pressure_drop_kpa: "refrigerantPressureDropKpa",
  manifold_pressure_drop_kpa: "manifoldPressureDropKpa",
  total_ref_pressure_drop_kpa: "totalRefPressureDropKpa",
  circuits: "circuits",
  tubes_per_row: "tubesPerRow",
  rows: "rows",
  fin_pitch_mm: "finPitchMm",
  length_mm: "lengthMm",
  tube_shape: "tubeShape",
  tube_od_mm: "tubeOdMm",
  tube_id_mm: "tubeIdMm",
  refrigerant: "refrigerant",
  description: "description",
};

const EVAP_REQUIRED = [
  "nominal_capacity_w",
  "nominal_air_temp_in_c",
  "nominal_evap_temp_c",
  "nominal_airflow_m3h",
  "refrigerant",
  "tubes_per_row",
  "rows",
  "circuits",
  "length_mm",
  "fin_pitch_mm",
  "tube_od_mm",
];

const COND_REQUIRED = [
  "nominal_capacity_w",
  "nominal_air_temp_in_c",
  "nominal_cond_temp_c",
  "nominal_airflow_m3h",
  "refrigerant",
  "tubes_per_row",
  "rows",
  "circuits",
  "length_mm",
  "fin_pitch_mm",
  "tube_od_mm",
];

interface MapResult {
  patch: Record<string, unknown>;
  sources: Record<string, FieldSource>;
}

function applyMap<F>(
  fields: F,
  map: Record<string, keyof F & string>,
  existingOverrides: Record<string, boolean>,
  existingRow: Record<string, unknown> | null,
): MapResult {
  const patch: Record<string, unknown> = {};
  const sources: Record<string, FieldSource> = {};
  for (const [col, key] of Object.entries(map)) {
    if (existingOverrides[col]) {
      // preserva o que o usuário editou manualmente
      if (existingRow && existingRow[col] != null) {
        patch[col] = existingRow[col];
        sources[col] = "manual";
      }
      continue;
    }
    const v = (fields as Record<string, unknown>)[key];
    if (v != null && v !== "") {
      patch[col] = v;
      sources[col] = "unilab";
    }
  }
  return { patch, sources };
}

export interface BuildEvaporatorPatchInput {
  fields: UnilabEvaporatorFields;
  existingRow: Record<string, unknown> | null;
}

export function buildEvaporatorPatch({ fields, existingRow }: BuildEvaporatorPatchInput) {
  const overrides = ((existingRow?.manual_overrides as Record<string, boolean>) || {});
  const { patch, sources } = applyMap(fields, EVAP_FIELD_MAP, overrides, existingRow);

  // ---- Cálculos derivados ----
  const computed: Record<string, number> = {};
  const tIn = (patch.nominal_air_temp_in_c ?? existingRow?.nominal_air_temp_in_c) as number | undefined;
  const tEv = (patch.nominal_evap_temp_c ?? existingRow?.nominal_evap_temp_c) as number | undefined;
  if (tIn != null && tEv != null && !overrides.nominal_delta_t_k) {
    const dt = Number(tIn) - Number(tEv);
    patch.nominal_delta_t_k = dt;
    sources.nominal_delta_t_k = "calculated";
    computed.nominal_delta_t_k = dt;
  }

  const qt = (patch.nominal_capacity_w ?? existingRow?.nominal_capacity_w) as number | undefined;
  const qs = (patch.nominal_sensible_w ?? existingRow?.nominal_sensible_w) as number | undefined;
  if (patch.sensible_ratio == null && qt != null && qs != null && Number(qt) > 0 && !overrides.sensible_ratio) {
    const sr = Number(qs) / Number(qt);
    patch.sensible_ratio = sr;
    sources.sensible_ratio = "calculated";
    computed.sensible_ratio = sr;
  }

  // Área frontal estimada: comprimento × (tubos/fileira × passo dos tubos ~ 25mm default).
  // Sem o passo dos tubos, deixamos vazio.
  const lengthMm = (patch.length_mm ?? existingRow?.length_mm) as number | undefined;
  const tpr = (patch.tubes_per_row ?? existingRow?.tubes_per_row) as number | undefined;
  // Heurística: passo vertical típico Unilab = 25 mm (não temos no datasheet)
  if (lengthMm != null && tpr != null && !overrides.frontal_area_m2) {
    const PITCH_VERT_MM = 25;
    const frontalAreaM2 = (Number(lengthMm) / 1000) * ((Number(tpr) * PITCH_VERT_MM) / 1000);
    patch.frontal_area_m2 = frontalAreaM2;
    sources.frontal_area_m2 = "calculated";
    computed.frontal_area_m2 = frontalAreaM2;
  }

  // ---- Validação ----
  const issues: ValidationIssue[] = [];
  const missingRequired: string[] = [];
  for (const k of EVAP_REQUIRED) {
    const present = patch[k] != null || (existingRow && existingRow[k] != null);
    if (!present) {
      missingRequired.push(k);
      issues.push({ field: k, level: "error", message: `Campo obrigatório ausente: ${k}` });
    }
  }
  if (qt != null && Number(qt) <= 0)
    issues.push({ field: "nominal_capacity_w", level: "error", message: "Capacidade deve ser > 0" });
  const af = (patch.nominal_airflow_m3h ?? existingRow?.nominal_airflow_m3h) as number | undefined;
  if (af != null && Number(af) <= 0)
    issues.push({ field: "nominal_airflow_m3h", level: "error", message: "Vazão de ar deve ser > 0" });
  if (tIn != null && tEv != null && Number(tIn) <= Number(tEv))
    issues.push({
      level: "error",
      message: `T ar entrada (${tIn}°C) deve ser maior que T evaporação (${tEv}°C)`,
    });
  const c = (patch.circuits ?? existingRow?.circuits) as number | undefined;
  if (c != null && Number(c) <= 0)
    issues.push({ field: "circuits", level: "error", message: "Número de circuitos deve ser > 0" });
  const refr = (patch.refrigerant ?? existingRow?.refrigerant) as string | undefined;
  if (!refr) issues.push({ field: "refrigerant", level: "error", message: "Fluido refrigerante não identificado" });

  const ok = issues.filter((i) => i.level === "error").length === 0 && missingRequired.length === 0;

  const report: ValidationReport = {
    ok,
    issues,
    missingRequired,
    computed,
    checkedAt: new Date().toISOString(),
  };

  // mescla field_sources existentes
  const mergedSources = {
    ...((existingRow?.field_sources as Record<string, FieldSource>) || {}),
    ...sources,
  };

  patch.field_sources = mergedSources;
  patch.validation_report = report as unknown as Record<string, unknown>;

  return {
    patch,
    sources: mergedSources,
    report,
    nextStatus: ok ? ("validated" as const) : ("needs_review" as const),
  };
}

export interface BuildCondenserPatchInput {
  fields: UnilabCondenserFields;
  existingRow: Record<string, unknown> | null;
}

export function buildCondenserPatch({ fields, existingRow }: BuildCondenserPatchInput) {
  const overrides = ((existingRow?.manual_overrides as Record<string, boolean>) || {});
  const { patch, sources } = applyMap(fields, COND_FIELD_MAP, overrides, existingRow);

  const computed: Record<string, number> = {};
  const tIn = (patch.nominal_air_temp_in_c ?? existingRow?.nominal_air_temp_in_c) as number | undefined;
  const tCd = (patch.nominal_cond_temp_c ?? existingRow?.nominal_cond_temp_c) as number | undefined;
  // Para condensador o DT nominal típico = T_cond - T_ar_entrada
  if (tIn != null && tCd != null && !overrides.nominal_delta_t_k) {
    const dt = Number(tCd) - Number(tIn);
    (patch as Record<string, unknown>).nominal_delta_t_k = dt;
    sources.nominal_delta_t_k = "calculated";
    computed.nominal_delta_t_k = dt;
  }

  const lengthMm = (patch.length_mm ?? existingRow?.length_mm) as number | undefined;
  const tpr = (patch.tubes_per_row ?? existingRow?.tubes_per_row) as number | undefined;
  if (lengthMm != null && tpr != null && !overrides.frontal_area_m2) {
    const PITCH_VERT_MM = 25;
    const frontalAreaM2 = (Number(lengthMm) / 1000) * ((Number(tpr) * PITCH_VERT_MM) / 1000);
    patch.frontal_area_m2 = frontalAreaM2;
    sources.frontal_area_m2 = "calculated";
    computed.frontal_area_m2 = frontalAreaM2;
  }

  const issues: ValidationIssue[] = [];
  const missingRequired: string[] = [];
  for (const k of COND_REQUIRED) {
    const present = patch[k] != null || (existingRow && existingRow[k] != null);
    if (!present) {
      missingRequired.push(k);
      issues.push({ field: k, level: "error", message: `Campo obrigatório ausente: ${k}` });
    }
  }
  const qt = (patch.nominal_capacity_w ?? existingRow?.nominal_capacity_w) as number | undefined;
  if (qt != null && Number(qt) <= 0)
    issues.push({ field: "nominal_capacity_w", level: "error", message: "Capacidade deve ser > 0" });
  const af = (patch.nominal_airflow_m3h ?? existingRow?.nominal_airflow_m3h) as number | undefined;
  if (af != null && Number(af) <= 0)
    issues.push({ field: "nominal_airflow_m3h", level: "error", message: "Vazão de ar deve ser > 0" });
  if (tIn != null && tCd != null && Number(tCd) <= Number(tIn))
    issues.push({
      level: "error",
      message: `T condensação (${tCd}°C) deve ser maior que T ar entrada (${tIn}°C)`,
    });
  const c = (patch.circuits ?? existingRow?.circuits) as number | undefined;
  if (c != null && Number(c) <= 0)
    issues.push({ field: "circuits", level: "error", message: "Número de circuitos deve ser > 0" });
  const refr = (patch.refrigerant ?? existingRow?.refrigerant) as string | undefined;
  if (!refr) issues.push({ field: "refrigerant", level: "error", message: "Fluido refrigerante não identificado" });

  const ok = issues.filter((i) => i.level === "error").length === 0 && missingRequired.length === 0;

  const report: ValidationReport = {
    ok,
    issues,
    missingRequired,
    computed,
    checkedAt: new Date().toISOString(),
  };

  const mergedSources = {
    ...((existingRow?.field_sources as Record<string, FieldSource>) || {}),
    ...sources,
  };

  patch.field_sources = mergedSources;
  patch.validation_report = report as unknown as Record<string, unknown>;

  return {
    patch,
    sources: mergedSources,
    report,
    nextStatus: ok ? ("validated" as const) : ("needs_review" as const),
  };
}
