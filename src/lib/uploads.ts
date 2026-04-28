// CN Cold Engineering — Helpers de upload, parsing, merge, remoção e status.
import { supabase } from "@/integrations/supabase/client";
import {
  EXPECTED_FILE_KINDS,
  computeComponentStatus,
  type ComponentType,
  type FileKind,
  type FileProcessingStatus,
} from "@/lib/component-schema";
import { parseComponentFile } from "@/lib/parsers";
import { computeReadiness, valuesEqual, type FieldConflict } from "@/lib/component-readiness";

const BUCKET = "component-files";

export const ALLOWED_KINDS_BY_TYPE: Record<ComponentType, FileKind[]> = {
  compressor: ["csv"],
  evaporador: ["pdf", "xls"],
  condensador: ["pdf", "xls"],
};

export function acceptAttrFor(type: ComponentType): string {
  const map: Record<FileKind, string> = {
    csv: ".csv,text/csv",
    pdf: ".pdf,application/pdf",
    xls: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return ALLOWED_KINDS_BY_TYPE[type].map((k) => map[k]).join(",");
}

export function detectFileKind(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "xls";
  return null;
}

export class UploadValidationError extends Error {}

/** Faz upload, registra o arquivo, tenta extrair dados, mescla e recalcula status. */
export async function uploadComponentFile(params: {
  componentId: string;
  componentType: ComponentType;
  file: File;
  userId: string;
}): Promise<void> {
  const { componentId, componentType, file, userId } = params;

  const kind = detectFileKind(file.name);
  if (!kind) {
    throw new UploadValidationError("Extensão não reconhecida. Use CSV, PDF, XLS ou XLSX.");
  }
  const allowed = ALLOWED_KINDS_BY_TYPE[componentType];
  if (!allowed.includes(kind)) {
    throw new UploadValidationError(
      `Para ${componentType}, somente ${allowed.map((k) => k.toUpperCase()).join(" ou ")} são aceitos.`,
    );
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${componentId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

  const { data: inserted, error: insErr } = await supabase
    .from("component_files")
    .insert({
      component_id: componentId,
      file_name: file.name,
      storage_path: path,
      file_kind: kind,
      size_bytes: file.size,
      uploaded_by: userId,
      processing_status: "processando" as FileProcessingStatus,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`Falha ao registrar arquivo: ${insErr?.message ?? "desconhecido"}`);
  }
  const fileId = inserted.id as string;

  // Tenta parsear (cliente)
  let parseError: string | null = null;
  let needsManual = false;
  try {
    const outcome = await parseComponentFile(file, kind, componentType);
    needsManual = outcome.needsManualReview;
    if (Object.keys(outcome.fields).length > 0) {
      await mergeExtractedFields(componentId, fileId, outcome.fields, userId);
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : "Erro ao processar arquivo.";
  }

  const finalStatus: FileProcessingStatus = parseError
    ? "erro"
    : needsManual
      ? "pendente"
      : "processado";

  await supabase
    .from("component_files")
    .update({
      processing_status: finalStatus,
      processed_at: new Date().toISOString(),
      error_message: parseError,
    })
    .eq("id", fileId);

  await supabase.from("component_history").insert({
    component_id: componentId,
    user_id: userId,
    action: "file_uploaded",
    payload: { file_name: file.name, kind, status: finalStatus },
  });

  await recomputeComponentStatus(componentId);
}

/** Mescla campos extraídos no component_data, detectando conflitos. */
async function mergeExtractedFields(
  componentId: string,
  fileId: string,
  newFields: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const { data: current } = await supabase
    .from("component_data")
    .select("fields, field_sources")
    .eq("component_id", componentId)
    .maybeSingle();

  const fields = { ...((current?.fields as Record<string, unknown>) ?? {}) };
  const sources = { ...((current?.field_sources as Record<string, string>) ?? {}) };

  // Conflitos atuais do componente
  const { data: comp } = await supabase
    .from("components")
    .select("conflicts")
    .eq("id", componentId)
    .single();
  const conflicts: FieldConflict[] = (comp?.conflicts as unknown as FieldConflict[]) ?? [];
  const conflictMap = new Map(conflicts.map((c) => [c.key, c]));

  const fileSourceKey = `file:${fileId}`;

  for (const [key, value] of Object.entries(newFields)) {
    if (value == null || value === "") continue;
    const existing = fields[key];
    const existingSrc = sources[key];

    if (existing === undefined || existing === null || existing === "") {
      fields[key] = value;
      sources[key] = fileSourceKey;
      continue;
    }
    if (existingSrc === "manual") {
      // edição manual prevalece — não sobrescreve, mas registra divergência se diferente
      if (!valuesEqual(existing, value)) {
        const c = conflictMap.get(key) ?? { key, values: [{ source: "manual", value: existing }] };
        if (!c.values.some((v) => v.source === fileSourceKey)) {
          c.values.push({ source: fileSourceKey, value });
        }
        conflictMap.set(key, c);
      }
      continue;
    }
    // existente vem de arquivo — se igual, ignora; se diferente, conflito
    if (!valuesEqual(existing, value)) {
      const c = conflictMap.get(key) ?? {
        key,
        values: [{ source: existingSrc ?? "arquivo", value: existing }],
      };
      if (!c.values.some((v) => v.source === fileSourceKey)) {
        c.values.push({ source: fileSourceKey, value });
      }
      conflictMap.set(key, c);
    }
  }

  await supabase
    .from("component_data")
    .upsert(
      {
        component_id: componentId,
        fields,
        field_sources: sources,
        updated_by: userId,
      },
      { onConflict: "component_id" },
    );

  await supabase
    .from("components")
    .update({ conflicts: Array.from(conflictMap.values()) })
    .eq("id", componentId);
}

/** Atualiza um campo manualmente (sobrescreve qualquer valor de arquivo). */
export async function setFieldManual(params: {
  componentId: string;
  key: string;
  value: unknown;
  userId: string;
}): Promise<void> {
  const { componentId, key, value, userId } = params;
  const { data: current } = await supabase
    .from("component_data")
    .select("fields, field_sources")
    .eq("component_id", componentId)
    .maybeSingle();

  const fields = { ...((current?.fields as Record<string, unknown>) ?? {}) };
  const sources = { ...((current?.field_sources as Record<string, string>) ?? {}) };

  if (value === null || value === "" || value === undefined) {
    delete fields[key];
    delete sources[key];
  } else {
    fields[key] = value;
    sources[key] = "manual";
  }

  await supabase
    .from("component_data")
    .upsert(
      {
        component_id: componentId,
        fields,
        field_sources: sources,
        updated_by: userId,
      },
      { onConflict: "component_id" },
    );

  // Resolve qualquer conflito desse campo (escolha manual prevalece)
  await resolveConflictKey(componentId, key);

  await supabase.from("component_history").insert({
    component_id: componentId,
    user_id: userId,
    action: "field_edited",
    payload: { key, value },
  });

  await recomputeComponentStatus(componentId);
}

/** Resolve um conflito escolhendo um valor específico de uma origem. */
export async function resolveConflict(params: {
  componentId: string;
  key: string;
  chosenValue: unknown;
  chosenSource: string;
  userId: string;
}): Promise<void> {
  const { componentId, key, chosenValue, chosenSource, userId } = params;
  const { data: current } = await supabase
    .from("component_data")
    .select("fields, field_sources")
    .eq("component_id", componentId)
    .maybeSingle();

  const fields = { ...((current?.fields as Record<string, unknown>) ?? {}) };
  const sources = { ...((current?.field_sources as Record<string, string>) ?? {}) };

  fields[key] = chosenValue;
  sources[key] = chosenSource;

  await supabase
    .from("component_data")
    .upsert(
      {
        component_id: componentId,
        fields,
        field_sources: sources,
        updated_by: userId,
      },
      { onConflict: "component_id" },
    );

  await resolveConflictKey(componentId, key);

  await supabase.from("component_history").insert({
    component_id: componentId,
    user_id: userId,
    action: "conflict_resolved",
    payload: { key, chosen: chosenSource },
  });

  await recomputeComponentStatus(componentId);
}

async function resolveConflictKey(componentId: string, key: string): Promise<void> {
  const { data: comp } = await supabase
    .from("components")
    .select("conflicts")
    .eq("id", componentId)
    .single();
  const conflicts: FieldConflict[] = (comp?.conflicts as unknown as FieldConflict[]) ?? [];
  const next = conflicts.filter((c) => c.key !== key);
  await supabase.from("components").update({ conflicts: next }).eq("id", componentId);
}

/** Remove arquivo do storage, da tabela e limpa origens vinculadas. */
export async function removeComponentFile(params: {
  fileId: string;
  storagePath: string;
  componentId: string;
  userId: string;
  fileName: string;
}): Promise<void> {
  const { fileId, storagePath, componentId, userId, fileName } = params;

  const { error: delObjErr } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (delObjErr) throw new Error(`Falha ao remover do storage: ${delObjErr.message}`);

  const { error: delRowErr } = await supabase
    .from("component_files")
    .delete()
    .eq("id", fileId);
  if (delRowErr) throw new Error(`Falha ao remover registro: ${delRowErr.message}`);

  // Remove campos cuja origem era esse arquivo
  const fileSrc = `file:${fileId}`;
  const { data: current } = await supabase
    .from("component_data")
    .select("fields, field_sources")
    .eq("component_id", componentId)
    .maybeSingle();
  if (current) {
    const fields = { ...((current.fields as Record<string, unknown>) ?? {}) };
    const sources = { ...((current.field_sources as Record<string, string>) ?? {}) };
    let changed = false;
    for (const [k, src] of Object.entries(sources)) {
      if (src === fileSrc) {
        delete fields[k];
        delete sources[k];
        changed = true;
      }
    }
    if (changed) {
      await supabase
        .from("component_data")
        .upsert(
          { component_id: componentId, fields, field_sources: sources, updated_by: userId },
          { onConflict: "component_id" },
        );
    }
  }

  // Limpa conflitos referenciando esse arquivo
  const { data: comp } = await supabase
    .from("components")
    .select("conflicts")
    .eq("id", componentId)
    .single();
  if (comp?.conflicts) {
    const conflicts: FieldConflict[] = comp.conflicts as unknown as FieldConflict[];
    const cleaned = conflicts
      .map((c) => ({ ...c, values: c.values.filter((v) => v.source !== fileSrc) }))
      .filter((c) => c.values.length >= 2);
    await supabase.from("components").update({ conflicts: cleaned }).eq("id", componentId);
  }

  await supabase.from("component_history").insert({
    component_id: componentId,
    user_id: userId,
    action: "file_removed",
    payload: { file_name: fileName },
  });

  await recomputeComponentStatus(componentId);
}

/** Lê arquivos + dados extraídos e atualiza components.status. */
export async function recomputeComponentStatus(componentId: string): Promise<void> {
  const [{ data: comp }, { data: files }, { data: cdata }] = await Promise.all([
    supabase.from("components").select("type, conflicts").eq("id", componentId).single(),
    supabase
      .from("component_files")
      .select("file_kind, processing_status")
      .eq("component_id", componentId),
    supabase
      .from("component_data")
      .select("fields")
      .eq("component_id", componentId)
      .maybeSingle(),
  ]);

  if (!comp) return;
  const type = comp.type as ComponentType;
  const fields = (cdata?.fields ?? {}) as Record<string, unknown>;
  const conflicts = (comp.conflicts ?? []) as unknown as FieldConflict[];

  let next = computeComponentStatus(
    type,
    (files ?? []) as { file_kind: FileKind; processing_status: FileProcessingStatus }[],
    fields,
  );

  // Bloqueia "pronto" se houver conflitos não resolvidos
  if (next === "pronto") {
    const r = computeReadiness(type, fields, conflicts);
    if (!r.ready) next = "incompleto";
  }

  await supabase.from("components").update({ status: next }).eq("id", componentId);
}

// Re-export para conveniência
export { EXPECTED_FILE_KINDS };
