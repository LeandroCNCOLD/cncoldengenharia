/**
 * Service / queries da Biblioteca Técnica Universal.
 * Camada fina sobre Supabase — toda lógica de mapeamento fica nos mappers.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  TechnicalComponent,
  TechnicalContext,
  TechnicalEntityType,
  TechnicalImportBatch,
  TechnicalMappedRecord,
  TechnicalRawRecord,
  TechnicalRecordStatus,
  TechnicalSource,
} from "@/modules/coldpro/library/types";
import { ENGINE_USABLE_CONTEXTS } from "@/modules/coldpro/library/types";
import { universalMapper } from "@/modules/coldpro/library/mappers/universalMapper";

/** Heurística: deriva o `source` canônico a partir do nome do fabricante. */
export function inferSourceFromManufacturer(
  manufacturer: string | null | undefined,
): TechnicalSource {
  const m = (manufacturer ?? "").toUpperCase();
  if (m.includes("BITZER")) return "BITZER";
  if (m.includes("DANFOSS")) return "DANFOSS";
  if (m.includes("TORIN")) return "TORIN";
  if (m.includes("UNILAB")) return "UNILAB";
  if (m.includes("VAPCYC")) return "VAPCYC";
  if (m.includes("CN") || m === "CN_INTERNAL") return "CN_INTERNAL";
  return "UNKNOWN";
}

export interface CountByStatus {
  raw_imported: number;
  mapped: number;
  needs_review: number;
  validated: number;
  approved: number;
  rejected: number;
  unmapped: number;
}

const EMPTY_COUNTS: CountByStatus = {
  raw_imported: 0,
  mapped: 0,
  needs_review: 0,
  validated: 0,
  approved: 0,
  rejected: 0,
  unmapped: 0,
};

/** Conta registros raw na biblioteca (todos os batches). */
export async function countRawRecords(): Promise<number> {
  const { count } = await supabase
    .from("technical_raw_records")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** Conta registros mapped/needs_review/validated/approved/rejected/unmapped. */
export async function countMappedByStatus(): Promise<CountByStatus> {
  const { data, error } = await supabase
    .from("technical_mapped_records")
    .select("mapping_status");
  if (error || !data) return { ...EMPTY_COUNTS };
  const out: CountByStatus = { ...EMPTY_COUNTS };
  for (const row of data) {
    const s = row.mapping_status as TechnicalRecordStatus;
    if (s in out) out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

/**
 * Conta componentes finais aprovados na biblioteca universal.
 * Por padrão, conta apenas o que o motor usa (`cn_standard` + `validated`).
 * Para a contagem geral, passe `includeAllContexts: true`.
 */
export async function countApprovedComponents(
  byEntity?: TechnicalEntityType,
  opts: { includeAllContexts?: boolean } = {},
) {
  let q = supabase
    .from("technical_components")
    .select("id", { count: "exact", head: true })
    .in("status", ["validated", "approved"]);
  if (byEntity) q = q.eq("entity_type", byEntity);
  if (!opts.includeAllContexts) {
    q = q.in("context", ENGINE_USABLE_CONTEXTS as unknown as string[]);
  }
  const { count } = await q;
  return count ?? 0;
}

/** Detecta se há raw sem mapping correspondente (mostra aviso no Banco Técnico). */
export async function countUnmappedRaw(): Promise<number> {
  const { count } = await supabase
    .from("technical_raw_records")
    .select("id", { count: "exact", head: true })
    .in("status", ["raw_imported", "unmapped"]);
  return count ?? 0;
}

export async function listRecentBatches(limit = 20): Promise<TechnicalImportBatch[]> {
  const { data } = await supabase
    .from("technical_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TechnicalImportBatch[];
}

export async function listMappedForReview(limit = 200): Promise<TechnicalMappedRecord[]> {
  const { data } = await supabase
    .from("technical_mapped_records")
    .select("*")
    .in("mapping_status", ["mapped", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TechnicalMappedRecord[];
}

export async function getRawRecord(id: string): Promise<TechnicalRawRecord | null> {
  const { data } = await supabase
    .from("technical_raw_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as TechnicalRawRecord | null) ?? null;
}

/** Aprovação manual: cria/atualiza technical_components a partir de um mapped. */
export async function approveMapped(
  mapped: TechnicalMappedRecord,
  reviewerUserId: string | null,
): Promise<{ ok: boolean; error?: string; componentId?: string }> {
  const insert = {
    entity_type: mapped.entity_type,
    manufacturer: mapped.manufacturer,
    model: mapped.model,
    code: mapped.code,
    status: "approved" as const,
    source_batch_id: mapped.batch_id,
    source_raw_id: mapped.raw_record_id,
    source_mapped_id: mapped.id,
    normalized_json: mapped.normalized_json as never,
    approved_by: reviewerUserId,
    approved_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("technical_components")
    .insert([insert])
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert falhou" };

  const { error: upErr } = await supabase
    .from("technical_mapped_records")
    .update({
      mapping_status: "approved",
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      approved_component_id: data.id,
    })
    .eq("id", mapped.id);
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, componentId: data.id };
}

/** Aprova vários mapped records em sequência. Retorna contagem de sucesso/erro. */
export async function approveMappedBulk(
  mappedList: TechnicalMappedRecord[],
  reviewerUserId: string | null,
): Promise<{ ok: number; failed: number; errors: string[] }> {
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  // Sequencial (volume modesto + evita exceder rate limits do PostgREST).
  for (const m of mappedList) {
    const res = await approveMapped(m, reviewerUserId);
    if (res.ok) ok += 1;
    else {
      failed += 1;
      if (res.error && errors.length < 5) errors.push(res.error);
    }
  }
  return { ok, failed, errors };
}

/** Rejeita vários mapped records em uma única chamada. */
export async function rejectMappedBulk(
  mappedIds: string[],
  reviewerUserId: string | null,
  reason: string,
): Promise<void> {
  if (mappedIds.length === 0) return;
  await supabase
    .from("technical_mapped_records")
    .update({
      mapping_status: "rejected",
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      validation_errors_json: [{ rejected_reason: reason }] as never,
    })
    .in("id", mappedIds);
}

export async function rejectMapped(
  mappedId: string,
  reviewerUserId: string | null,
  reason: string,
): Promise<void> {
  await supabase
    .from("technical_mapped_records")
    .update({
      mapping_status: "rejected",
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      validation_errors_json: [{ rejected_reason: reason }] as never,
    })
    .eq("id", mappedId);
}

/** Re-roda o universalMapper sobre um raw e atualiza/insere mapped. */
export async function remapRaw(
  raw: TechnicalRawRecord,
): Promise<TechnicalMappedRecord | null> {
  const result = universalMapper.map({
    raw: raw.raw_json,
    sourceFile: raw.source_file,
    sourceTable: raw.source_table,
    hintManufacturer: raw.detected_manufacturer,
    hintEntityType: raw.detected_entity_type,
  });

  const mappingStatus: TechnicalRecordStatus = result.errors.length
    ? "needs_review"
    : "mapped";
  const payload = {
    batch_id: raw.batch_id,
    raw_record_id: raw.id,
    entity_type: result.entityType,
    manufacturer: result.manufacturer,
    model: result.model,
    code: result.code,
    normalized_json: result.normalized as never,
    confidence_score: result.confidence,
    mapping_status: mappingStatus,
    validation_errors_json: (result.errors.length
      ? result.errors.map((e) => ({ message: e }))
      : []) as never,
    mapper_name: result.mapperName,
  };

  const { data } = await supabase
    .from("technical_mapped_records")
    .insert([payload])
    .select("*")
    .single();
  return (data as TechnicalMappedRecord | null) ?? null;
}
