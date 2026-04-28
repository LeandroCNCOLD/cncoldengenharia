// Camada de negócio para Pasta de Equipamento + Lote de Upload Técnico.
// Cada pasta = 1 equipamento. Cada upload múltiplo = 1 lote (versão técnica).

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "component-files";

export class EquipmentUploadError extends Error {}

export type EquipmentKind =
  | "unidade_condensadora"
  | "evaporador"
  | "condensador"
  | "compressor"
  | "rack"
  | "sistema_completo"
  | "outro";

export type EquipmentStatus = "active" | "draft" | "archived";

export type UploadBatchStatus =
  | "uploaded"
  | "processing"
  | "parsed"
  | "needs_review"
  | "approved"
  | "rejected"
  | "archived";

export const EQUIPMENT_KINDS: { value: EquipmentKind; label: string }[] = [
  { value: "unidade_condensadora", label: "Unidade Condensadora" },
  { value: "evaporador", label: "Evaporador" },
  { value: "condensador", label: "Condensador" },
  { value: "compressor", label: "Compressor" },
  { value: "rack", label: "Rack" },
  { value: "sistema_completo", label: "Sistema completo" },
  { value: "outro", label: "Outro" },
];

export const BATCH_STATUS_LABELS: Record<UploadBatchStatus, string> = {
  uploaded: "Enviado",
  processing: "Processando",
  parsed: "Extraído",
  needs_review: "Revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
  archived: "Arquivado",
};

export const ACCEPTED_EXTENSIONS = [
  "pdf",
  "xls",
  "xlsx",
  "csv",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
];

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Equipamentos ----------

export type CreateEquipmentInput = {
  name: string;
  internalCode?: string;
  family?: string;
  equipmentKind: EquipmentKind;
  defaultRefrigerant?: string;
  description?: string;
  userId: string;
};

export async function createEquipment(input: CreateEquipmentInput) {
  const baseSlug = slugify(input.internalCode || input.name);
  if (!baseSlug) throw new EquipmentUploadError("Nome inválido para gerar slug.");

  // Garante slug único
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const { data: existing } = await (supabase as any)
      .from("technical_equipments")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    n++;
    slug = `${baseSlug}-${n}`;
  }

  const { data, error } = await (supabase as any)
    .from("technical_equipments")
    .insert({
      name: input.name,
      internal_code: input.internalCode || null,
      slug,
      family: input.family || null,
      equipment_kind: input.equipmentKind,
      default_refrigerant: input.defaultRefrigerant || null,
      description: input.description || null,
      created_by: input.userId,
    })
    .select("*")
    .single();
  if (error) throw new EquipmentUploadError(error.message);
  return data;
}

export async function listEquipments() {
  const { data, error } = await (supabase as any)
    .from("technical_equipments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new EquipmentUploadError(error.message);
  return data ?? [];
}

export async function getEquipment(equipmentId: string) {
  const { data, error } = await (supabase as any)
    .from("technical_equipments")
    .select("*")
    .eq("id", equipmentId)
    .single();
  if (error) throw new EquipmentUploadError(error.message);
  return data;
}

// ---------- Lotes + arquivos ----------

export async function listBatches(equipmentId: string) {
  const { data, error } = await (supabase as any)
    .from("technical_upload_batches")
    .select("*")
    .eq("equipment_id", equipmentId)
    .order("batch_number", { ascending: false });
  if (error) throw new EquipmentUploadError(error.message);
  return data ?? [];
}

export async function listFilesByBatch(batchId: string) {
  const { data, error } = await (supabase as any)
    .from("technical_files")
    .select("*")
    .eq("upload_batch_id", batchId)
    .order("uploaded_at", { ascending: true });
  if (error) throw new EquipmentUploadError(error.message);
  return data ?? [];
}

export async function listFilesByEquipment(equipmentId: string) {
  const { data, error } = await (supabase as any)
    .from("technical_files")
    .select("*")
    .eq("equipment_id", equipmentId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new EquipmentUploadError(error.message);
  return data ?? [];
}

async function nextBatchNumber(equipmentId: string) {
  const { data } = await (supabase as any)
    .from("technical_upload_batches")
    .select("batch_number")
    .eq("equipment_id", equipmentId)
    .order("batch_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.batch_number as number) ?? 0) + 1;
}

export type UploadBatchInput = {
  equipmentId: string;
  files: File[];
  notes?: string;
  userId: string;
  onProgress?: (done: number, total: number, currentName: string) => void;
};

export async function uploadEquipmentBatch(input: UploadBatchInput) {
  const { equipmentId, files, notes, userId, onProgress } = input;
  if (!files.length) throw new EquipmentUploadError("Selecione ao menos um arquivo.");

  const eq = await getEquipment(equipmentId);
  const batchNumber = await nextBatchNumber(equipmentId);
  const batchLabel = `v${String(batchNumber).padStart(3, "0")}`;

  // Cria o lote
  const { data: batch, error: bErr } = await (supabase as any)
    .from("technical_upload_batches")
    .insert({
      equipment_id: equipmentId,
      batch_number: batchNumber,
      batch_label: batchLabel,
      notes: notes || null,
      uploaded_by: userId,
      status: "uploaded" as UploadBatchStatus,
    })
    .select("*")
    .single();
  if (bErr || !batch) throw new EquipmentUploadError(bErr?.message ?? "Falha ao criar lote.");

  let done = 0;
  const inserted: any[] = [];
  for (const file of files) {
    onProgress?.(done, files.length, file.name);
    const ext = extOf(file.name);
    if (!ext || !ACCEPTED_EXTENSIONS.includes(ext)) {
      done++;
      continue;
    }
    const hash = await sha256Hex(file);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `equipment/${eq.slug}/raw/${batchLabel}/${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) {
      done++;
      continue;
    }

    const { data: row } = await (supabase as any)
      .from("technical_files")
      .insert({
        equipment_id: equipmentId,
        upload_batch_id: batch.id,
        original_filename: file.name,
        file_extension: ext,
        mime_type: file.type || null,
        storage_path: storagePath,
        version_number: batchNumber,
        version_label: batchLabel,
        file_hash: hash,
        file_size: file.size,
        status: "uploaded",
        is_current_version: true,
        uploaded_by: userId,
      })
      .select("*")
      .single();
    if (row) inserted.push(row);
    done++;
    onProgress?.(done, files.length, file.name);
  }

  return { batch, files: inserted };
}

// ---------- Processamento da pasta ----------

export async function processBatch(batchId: string, userId: string) {
  const files = await listFilesByBatch(batchId);
  await (supabase as any)
    .from("technical_upload_batches")
    .update({ status: "processing" as UploadBatchStatus })
    .eq("id", batchId);

  const { classifyFile, routeParser } = await import("@/modules/coldpro/ingestion");

  const results: any[] = [];
  for (const file of files) {
    try {
      await (supabase as any)
        .from("technical_files")
        .update({ status: "processing" })
        .eq("id", file.id);

      const dl = await supabase.storage.from(BUCKET).download(file.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "download falhou");
      const buffer = await dl.data.arrayBuffer();

      const initial = classifyFile({
        filename: file.original_filename,
        mimeType: file.mime_type,
        extension: file.file_extension,
        sizeBytes: file.file_size,
      });
      const parsed = await routeParser(initial, buffer);
      const refined = classifyFile(
        {
          filename: file.original_filename,
          mimeType: file.mime_type,
          extension: file.file_extension,
          sizeBytes: file.file_size,
        },
        parsed.rawText,
      );

      const semanticStatus =
        parsed.confidence >= 0.8
          ? "parsed"
          : parsed.confidence >= 0.5
            ? "needs_review"
            : "failed";

      await (supabase as any).from("technical_file_extractions").insert({
        file_id: file.id,
        product_id: file.product_id ?? null,
        parser: parsed.parserUsed,
        extracted_fields: {
          classification: refined,
          semanticStatus,
          parserVersion: parsed.parserVersion,
          confidence: parsed.confidence,
          fields: parsed.extractedFields,
          structuredPreview:
            typeof parsed.structuredData === "object" && parsed.structuredData
              ? JSON.parse(JSON.stringify(parsed.structuredData).slice(0, 5000))
              : null,
        },
        warnings: parsed.warnings,
        raw_preview: parsed.rawText.slice(0, 4000) || null,
        success: parsed.errors.length === 0,
        created_by: userId,
      });

      const dbStatus =
        semanticStatus === "parsed"
          ? "parsed"
          : semanticStatus === "needs_review"
            ? "processing"
            : "rejected";

      await (supabase as any)
        .from("technical_files")
        .update({
          status: dbStatus,
          detected_file_type: refined.fileType ?? null,
          detected_technical_type: refined.technicalType ?? null,
        })
        .eq("id", file.id);

      results.push({ fileId: file.id, semanticStatus, fields: parsed.extractedFields });
    } catch (e: any) {
      await (supabase as any)
        .from("technical_files")
        .update({ status: "rejected" })
        .eq("id", file.id);
      results.push({ fileId: file.id, error: e?.message });
    }
  }

  // Decide status do lote: needs_review se algum precisa revisão / parsed se ok
  const anyReview = results.some((r) => r.semanticStatus === "needs_review" || r.error);
  const allParsed = results.every((r) => r.semanticStatus === "parsed");
  const newStatus: UploadBatchStatus = allParsed
    ? "parsed"
    : anyReview
      ? "needs_review"
      : "processing";

  await (supabase as any)
    .from("technical_upload_batches")
    .update({ status: newStatus })
    .eq("id", batchId);

  return { results, status: newStatus };
}

// ---------- Pré-catálogo + conflitos ----------

type FieldSource = { fileId: string; filename: string; value: any };

export type PreCatalog = {
  equipmentId: string;
  equipmentName: string;
  evaporatorData: Record<string, any>;
  condenserData: Record<string, any>;
  compressorData: Record<string, any>;
  documents: { fileId: string; filename: string; type: string | null }[];
  missingFields: string[];
  conflicts: { field: string; sources: FieldSource[] }[];
  confidenceScore: number;
};

const REQUIRED_FIELDS = ["capacity_w", "refrigerant", "t_evap_nominal_c", "t_cond_nominal_c"];

export async function buildPreCatalog(equipmentId: string): Promise<PreCatalog> {
  const eq = await getEquipment(equipmentId);
  const files = await listFilesByEquipment(equipmentId);

  const fileIds = files.map((f: any) => f.id);
  if (!fileIds.length) {
    return {
      equipmentId,
      equipmentName: eq.name,
      evaporatorData: {},
      condenserData: {},
      compressorData: {},
      documents: [],
      missingFields: REQUIRED_FIELDS,
      conflicts: [],
      confidenceScore: 0,
    };
  }

  const { data: extractions } = await (supabase as any)
    .from("technical_file_extractions")
    .select("file_id, extracted_fields")
    .in("file_id", fileIds);

  const fileById = new Map(files.map((f: any) => [f.id, f]));

  // Agrupa campos por categoria com fontes para detectar conflito
  const byTech: Record<string, Map<string, FieldSource[]>> = {
    evaporador: new Map(),
    condensador: new Map(),
    compressor: new Map(),
  };

  let confSum = 0;
  let confCount = 0;

  for (const ex of extractions ?? []) {
    const f: any = fileById.get(ex.file_id);
    if (!f) continue;
    const ef = (ex.extracted_fields ?? {}) as any;
    const tech: string = ef?.classification?.technicalType ?? "outro";
    const fields = (ef?.fields ?? {}) as Record<string, any>;
    if (typeof ef?.confidence === "number") {
      confSum += ef.confidence;
      confCount++;
    }
    const target = byTech[tech as keyof typeof byTech];
    if (!target) continue;
    for (const [k, v] of Object.entries(fields)) {
      if (v == null || v === "") continue;
      if (!target.has(k)) target.set(k, []);
      target.get(k)!.push({ fileId: f.id, filename: f.original_filename, value: v });
    }
  }

  const conflicts: PreCatalog["conflicts"] = [];
  const flatten = (m: Map<string, FieldSource[]>) => {
    const out: Record<string, any> = {};
    for (const [field, sources] of m.entries()) {
      const distinct = Array.from(new Set(sources.map((s) => JSON.stringify(s.value))));
      if (distinct.length > 1) {
        conflicts.push({ field, sources });
      }
      out[field] = sources[0].value;
    }
    return out;
  };

  const evaporatorData = flatten(byTech.evaporador);
  const condenserData = flatten(byTech.condensador);
  const compressorData = flatten(byTech.compressor);

  const merged = { ...evaporatorData, ...condenserData, ...compressorData };
  const missingFields = REQUIRED_FIELDS.filter((k) => merged[k] == null);

  return {
    equipmentId,
    equipmentName: eq.name,
    evaporatorData,
    condenserData,
    compressorData,
    documents: files.map((f: any) => ({
      fileId: f.id,
      filename: f.original_filename,
      type: f.detected_technical_type ?? null,
    })),
    missingFields,
    conflicts,
    confidenceScore: confCount ? confSum / confCount : 0,
  };
}

// ---------- Aprovar / Rejeitar lote ----------

export async function approveBatch(batchId: string, userId: string) {
  const { data: batch } = await (supabase as any)
    .from("technical_upload_batches")
    .select("*")
    .eq("id", batchId)
    .single();
  if (!batch) throw new EquipmentUploadError("Lote não encontrado.");

  const pre = await buildPreCatalog(batch.equipment_id);
  if (pre.conflicts.length) {
    throw new EquipmentUploadError(
      `Existem ${pre.conflicts.length} conflito(s) que precisam de revisão antes da aprovação.`,
    );
  }

  await (supabase as any)
    .from("technical_upload_batches")
    .update({ status: "approved" as UploadBatchStatus })
    .eq("id", batchId);

  // Snapshot do catálogo
  await (supabase as any).from("technical_catalog_snapshots").insert({
    product_id: batch.equipment_id, // reutilizamos o campo como referência
    file_id: null,
    file_group: "outros",
    technical_category: "outro",
    version_label: batch.batch_label,
    payload: pre,
    approved_by: userId,
  });
}

export async function rejectBatch(batchId: string) {
  await (supabase as any)
    .from("technical_upload_batches")
    .update({ status: "rejected" as UploadBatchStatus })
    .eq("id", batchId);
}

export async function getSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error || !data?.signedUrl) throw new EquipmentUploadError("URL não disponível.");
  return data.signedUrl;
}
