// Serviço de geometrias customizadas (overrides) persistidas no Lovable Cloud.
// Permite criar, editar e excluir geometrias além das do catálogo JSON.
//
// Modelo:
// - base_id != null  → override (substitui a geometria do JSON na exibição)
// - base_id == null  → geometria nova criada pelo usuário
// - deleted = true   → tombstone (esconde uma geometria do JSON)

import { supabase } from "@/integrations/supabase/client";
import type { CoilGeometryItem, TipoSerpentina } from "./coilGeometryCatalogService";

export interface GeometryOverrideRow {
  id: string;
  base_id: string | null;
  codigo: string;
  descricao: string;
  name: string;
  tipo_serpentina: string | null;
  raw: Record<string, unknown>;
  deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeometryEditableFields {
  codigo: string;
  descricao: string;
  name: string;
  tipo_serpentina: TipoSerpentina | null;
  // Tubo
  diametro_externo_tubo_mm: number | null;
  diametro_interno_tubo_mm: number | null;
  espessura_tubo_mm: number | null;
  passo_tubos_mm: number | null;
  passo_fileiras_mm: number | null;
  // Aleta
  espessura_aleta_mm: number | null;
  forma_aleta: string | null;
  fator_correcao_aleta: number | null;
  fator_atrito_ar: number | null;
  razao_superficies_internas: number | null;
  // Distribuidor
  defaultCircuits: number | null;
  // Outros
  defaultRows: number | null;
  uBaseWm2K: number | null;
}

const TIPO_TO_COIL_TYPE: Record<string, string> = {
  "Condensação": "condensation",
  "Expansão Direta": "direct_expansion",
  "Evaporador Bomba": "flooded_evaporator",
  "Resfriamento": "cooling",
  "Aquecimento": "heating",
  "Vapor": "vapor",
};

export function geometryToEditable(g: CoilGeometryItem): GeometryEditableFields {
  return {
    codigo: g.codigo,
    descricao: g.descricao,
    name: g.name,
    tipo_serpentina: g.tipo_serpentina,
    diametro_externo_tubo_mm: g.diametro_externo_tubo_mm,
    diametro_interno_tubo_mm: g.diametro_interno_tubo_mm,
    espessura_tubo_mm: g.espessura_tubo_mm,
    passo_tubos_mm: g.passo_tubos_mm,
    passo_fileiras_mm: g.passo_fileiras_mm,
    espessura_aleta_mm: g.espessura_aleta_mm,
    forma_aleta: g.forma_aleta,
    fator_correcao_aleta: g.fator_correcao_aleta,
    fator_atrito_ar: g.fator_atrito_ar,
    razao_superficies_internas: g.razao_superficies_internas,
    defaultCircuits: g.defaultCircuits ?? null,
    defaultRows: g.defaultRows ?? null,
    uBaseWm2K: g.uBaseWm2K ?? null,
  };
}

export function emptyEditable(): GeometryEditableFields {
  return {
    codigo: "",
    descricao: "",
    name: "",
    tipo_serpentina: null,
    diametro_externo_tubo_mm: null,
    diametro_interno_tubo_mm: null,
    espessura_tubo_mm: null,
    passo_tubos_mm: null,
    passo_fileiras_mm: null,
    espessura_aleta_mm: null,
    forma_aleta: null,
    fator_correcao_aleta: null,
    fator_atrito_ar: null,
    razao_superficies_internas: null,
    defaultCircuits: null,
    defaultRows: null,
    uBaseWm2K: null,
  };
}

function buildRaw(f: GeometryEditableFields): Record<string, unknown> {
  return {
    code: f.codigo,
    description: f.descricao,
    coil_type: f.tipo_serpentina ? TIPO_TO_COIL_TYPE[f.tipo_serpentina] : null,
    tube_od_mm: f.diametro_externo_tubo_mm,
    tube_id_mm: f.diametro_interno_tubo_mm,
    tube_wall_mm: f.espessura_tubo_mm,
    tube_pitch_mm: f.passo_tubos_mm,
    row_pitch_mm: f.passo_fileiras_mm,
    fin_thickness_mm: f.espessura_aleta_mm,
    fin_correction_factor: f.fator_correcao_aleta,
    air_friction_factor: f.fator_atrito_ar,
    internal_surface_ratio: f.razao_superficies_internas,
    u_base_w_m2k: f.uBaseWm2K,
    default_rows: f.defaultRows,
    default_circuits: f.defaultCircuits,
  };
}

export async function loadGeometryOverrides(): Promise<GeometryOverrideRow[]> {
  const { data, error } = await supabase
    .from("coil_geometry_overrides")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GeometryOverrideRow[];
}

export async function createGeometry(
  fields: GeometryEditableFields,
  userId: string,
  baseId: string | null = null,
): Promise<GeometryOverrideRow> {
  const { data, error } = await supabase
    .from("coil_geometry_overrides")
    .insert({
      base_id: baseId,
      codigo: fields.codigo,
      descricao: fields.descricao,
      name: fields.name || fields.descricao || fields.codigo,
      tipo_serpentina: fields.tipo_serpentina,
      raw: buildRaw(fields),
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as GeometryOverrideRow;
}

export async function updateGeometry(
  rowId: string,
  fields: GeometryEditableFields,
): Promise<GeometryOverrideRow> {
  const { data, error } = await supabase
    .from("coil_geometry_overrides")
    .update({
      codigo: fields.codigo,
      descricao: fields.descricao,
      name: fields.name || fields.descricao || fields.codigo,
      tipo_serpentina: fields.tipo_serpentina,
      raw: buildRaw(fields),
    })
    .eq("id", rowId)
    .select()
    .single();
  if (error) throw error;
  return data as GeometryOverrideRow;
}

export async function deleteGeometryOverride(rowId: string): Promise<void> {
  const { error } = await supabase
    .from("coil_geometry_overrides")
    .delete()
    .eq("id", rowId);
  if (error) throw error;
}

/** Cria um tombstone para esconder uma geometria do catálogo JSON (apenas admin). */
export async function tombstoneBaseGeometry(
  baseId: string,
  base: CoilGeometryItem,
  userId: string,
): Promise<GeometryOverrideRow> {
  const { data, error } = await supabase
    .from("coil_geometry_overrides")
    .insert({
      base_id: baseId,
      codigo: base.codigo,
      descricao: base.descricao,
      name: base.name,
      tipo_serpentina: base.tipo_serpentina,
      raw: {},
      deleted: true,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as GeometryOverrideRow;
}

/** Converte uma row de override em CoilGeometryItem (mesma forma do catálogo). */
export function overrideToGeometryItem(
  row: GeometryOverrideRow,
  baseGeometry?: CoilGeometryItem,
): CoilGeometryItem {
  const merged: CoilGeometryItem = {
    ...(baseGeometry ?? ({} as CoilGeometryItem)),
    id: row.base_id ?? `custom:${row.id}`,
    name: row.name,
    descricao: row.descricao,
    codigo: row.codigo,
    tipo_serpentina: (row.tipo_serpentina as TipoSerpentina | null) ?? null,
    raw: { ...(baseGeometry?.raw ?? {}), ...row.raw },
    tubePitchTransverseMm:
      (row.raw["tube_pitch_mm"] as number) ??
      baseGeometry?.tubePitchTransverseMm ??
      0,
    tubePitchLongitudinalMm:
      (row.raw["row_pitch_mm"] as number) ??
      baseGeometry?.tubePitchLongitudinalMm ??
      0,
    tubeOuterDiameterMm:
      (row.raw["tube_od_mm"] as number) ?? baseGeometry?.tubeOuterDiameterMm ?? 0,
    tubeInnerDiameterMm:
      (row.raw["tube_id_mm"] as number) ?? baseGeometry?.tubeInnerDiameterMm,
    defaultRows: (row.raw["default_rows"] as number) ?? baseGeometry?.defaultRows,
    defaultCircuits:
      (row.raw["default_circuits"] as number) ?? baseGeometry?.defaultCircuits,
    uBaseWm2K: (row.raw["u_base_w_m2k"] as number) ?? baseGeometry?.uBaseWm2K,
    passo_fileiras_mm:
      (row.raw["row_pitch_mm"] as number) ?? baseGeometry?.passo_fileiras_mm ?? null,
    passo_tubos_mm:
      (row.raw["tube_pitch_mm"] as number) ?? baseGeometry?.passo_tubos_mm ?? null,
    diametro_externo_tubo_mm:
      (row.raw["tube_od_mm"] as number) ??
      baseGeometry?.diametro_externo_tubo_mm ?? null,
    diametro_interno_tubo_mm:
      (row.raw["tube_id_mm"] as number) ??
      baseGeometry?.diametro_interno_tubo_mm ?? null,
    espessura_tubo_mm:
      (row.raw["tube_wall_mm"] as number) ??
      baseGeometry?.espessura_tubo_mm ?? null,
    espessura_aleta_mm:
      (row.raw["fin_thickness_mm"] as number) ??
      baseGeometry?.espessura_aleta_mm ?? null,
    forma_aleta: baseGeometry?.forma_aleta ?? null,
    tipo_bateria: baseGeometry?.tipo_bateria ?? null,
    fator_correcao_aleta:
      (row.raw["fin_correction_factor"] as number) ??
      baseGeometry?.fator_correcao_aleta ?? null,
    fator_atrito_ar:
      (row.raw["air_friction_factor"] as number) ??
      baseGeometry?.fator_atrito_ar ?? null,
    razao_superficies_internas:
      (row.raw["internal_surface_ratio"] as number) ??
      baseGeometry?.razao_superficies_internas ?? null,
    tubo_liso: baseGeometry?.tubo_liso ?? null,
    certificacao_ahri: baseGeometry?.certificacao_ahri ?? null,
    certificacao_eurovent: baseGeometry?.certificacao_eurovent ?? null,
  };
  return merged;
}

/** Mescla overrides com o catálogo base. Aplica tombstones e overrides. */
export function mergeWithOverrides(
  base: CoilGeometryItem[],
  overrides: GeometryOverrideRow[],
): CoilGeometryItem[] {
  const tombstones = new Set(
    overrides.filter((o) => o.deleted && o.base_id).map((o) => o.base_id!),
  );
  // Mais recente por base_id
  const overrideByBase = new Map<string, GeometryOverrideRow>();
  for (const o of overrides) {
    if (o.deleted) continue;
    if (!o.base_id) continue;
    const existing = overrideByBase.get(o.base_id);
    if (!existing || existing.updated_at < o.updated_at) {
      overrideByBase.set(o.base_id, o);
    }
  }

  const merged: CoilGeometryItem[] = [];
  for (const g of base) {
    if (tombstones.has(g.id)) continue;
    const ov = overrideByBase.get(g.id);
    merged.push(ov ? overrideToGeometryItem(ov, g) : g);
  }
  // Geometrias customizadas (sem base_id)
  for (const o of overrides) {
    if (o.deleted) continue;
    if (o.base_id) continue;
    merged.push(overrideToGeometryItem(o));
  }
  return merged;
}
