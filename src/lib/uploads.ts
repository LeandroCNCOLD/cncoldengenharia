// CN Cold Engineering — Helpers de upload, remoção e recálculo de status.
import { supabase } from "@/integrations/supabase/client";
import {
  EXPECTED_FILE_KINDS,
  computeComponentStatus,
  type ComponentType,
  type FileKind,
} from "@/lib/component-schema";

const BUCKET = "component-files";

/** Tipos de arquivo aceitos por tipo de componente (regras desta fase). */
export const ALLOWED_KINDS_BY_TYPE: Record<ComponentType, FileKind[]> = {
  compressor: ["csv"],
  evaporador: ["pdf", "xls"],
  condensador: ["pdf", "xls"],
};

/** atributo accept="..." pronto pra usar em <input type=file> */
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

/** Faz o upload, registra o arquivo, registra histórico e recalcula o status. */
export async function uploadComponentFile(params: {
  componentId: string;
  componentType: ComponentType;
  file: File;
  userId: string;
}): Promise<void> {
  const { componentId, componentType, file, userId } = params;

  const kind = detectFileKind(file.name);
  if (!kind) {
    throw new UploadValidationError(
      "Extensão não reconhecida. Use CSV, PDF, XLS ou XLSX.",
    );
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

  const { error: insErr } = await supabase.from("component_files").insert({
    component_id: componentId,
    file_name: file.name,
    storage_path: path,
    file_kind: kind,
    size_bytes: file.size,
    uploaded_by: userId,
    processing_status: "pendente",
  });
  if (insErr) {
    // tenta limpar o objeto pra não deixar lixo
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`Falha ao registrar arquivo: ${insErr.message}`);
  }

  await supabase.from("component_history").insert({
    component_id: componentId,
    user_id: userId,
    action: "file_uploaded",
    payload: { file_name: file.name, kind },
  });

  await recomputeComponentStatus(componentId);
}

/** Remove arquivo do storage e da tabela; recalcula status. */
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
    supabase.from("components").select("type").eq("id", componentId).single(),
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
  const next = computeComponentStatus(
    comp.type as ComponentType,
    (files ?? []) as { file_kind: FileKind; processing_status: "pendente" | "processando" | "processado" | "erro" }[],
    (cdata?.fields ?? {}) as Record<string, unknown>,
  );

  await supabase.from("components").update({ status: next }).eq("id", componentId);
}
