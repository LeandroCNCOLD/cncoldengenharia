// Camada de negócio para o módulo Upload Técnico (produto + grupo + categoria + versão).

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FileGroup = Database["public"]["Enums"]["technical_file_group"];
export type TechnicalCategory = Database["public"]["Enums"]["technical_file_category"];
export type TechnicalFileStatus = Database["public"]["Enums"]["technical_file_status"];

export const FILE_GROUPS: { value: FileGroup; label: string }[] = [
  { value: "evaporador", label: "Evaporador" },
  { value: "condensador", label: "Condensador" },
  { value: "compressor", label: "Compressor" },
  { value: "laudos", label: "Laudos" },
  { value: "planilhas", label: "Planilhas" },
  { value: "curvas", label: "Curvas" },
  { value: "imagens", label: "Imagens" },
  { value: "documentos", label: "Documentos" },
  { value: "outros", label: "Outros" },
];

export const TECHNICAL_CATEGORIES: { value: TechnicalCategory; label: string }[] = [
  { value: "ficha_tecnica", label: "Ficha técnica" },
  { value: "laudo_teste", label: "Laudo de teste" },
  { value: "planilha_calculo", label: "Planilha de cálculo" },
  { value: "curva_compressor", label: "Curva de compressor" },
  { value: "catalogo_fornecedor", label: "Catálogo do fornecedor" },
  { value: "desenho_tecnico", label: "Desenho técnico" },
  { value: "imagem", label: "Imagem" },
  { value: "outro", label: "Outro" },
];

export const FILE_STATUS_LABELS: Record<TechnicalFileStatus, string> = {
  uploaded: "Enviado",
  processing: "Processando",
  parsed: "Extraído",
  validated: "Validado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  archived: "Arquivado",
};

const BUCKET = "component-files";

export class TechnicalUploadError extends Error {}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function extensionOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type UploadTechnicalFileInput = {
  productId: string;
  fileGroup: FileGroup;
  technicalCategory: TechnicalCategory;
  description?: string;
  notes?: string;
  file: File;
  userId: string;
};

export async function uploadTechnicalFile(input: UploadTechnicalFileInput) {
  const { productId, fileGroup, technicalCategory, description, notes, file, userId } = input;

  // Produto + slug
  const { data: product, error: prodErr } = await supabase
    .from("technical_products")
    .select("id, slug")
    .eq("id", productId)
    .single();
  if (prodErr || !product) throw new TechnicalUploadError("Produto técnico não encontrado.");

  const ext = extensionOf(file.name);
  if (!ext) throw new TechnicalUploadError("Arquivo sem extensão reconhecida.");

  // Hash anti-duplicidade dentro do mesmo produto/grupo/categoria
  const file_hash = await sha256Hex(file);
  const { data: dup } = await supabase
    .from("technical_files")
    .select("id, version_label")
    .eq("product_id", productId)
    .eq("file_group", fileGroup)
    .eq("technical_category", technicalCategory)
    .eq("file_hash", file_hash)
    .maybeSingle();
  if (dup) {
    throw new TechnicalUploadError(
      `Arquivo idêntico já existe nesta categoria (${dup.version_label}).`,
    );
  }

  // Cálculo da próxima versão
  const { data: last } = await supabase
    .from("technical_files")
    .select("version_number")
    .eq("product_id", productId)
    .eq("file_group", fileGroup)
    .eq("technical_category", technicalCategory)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (last?.version_number ?? 0) + 1;
  const versionLabel = `v${String(nextVersion).padStart(3, "0")}`;

  // Caminho padronizado
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `products/${product.slug}/${fileGroup}/${technicalCategory}/${versionLabel}/${safeName}`;

  // Upload
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) throw new TechnicalUploadError(`Falha no upload: ${upErr.message}`);

  const { data: inserted, error: insErr } = await supabase
    .from("technical_files")
    .insert({
      product_id: productId,
      file_group: fileGroup,
      technical_category: technicalCategory,
      description: description ?? null,
      notes: notes ?? null,
      original_filename: file.name,
      file_extension: ext,
      mime_type: file.type || null,
      storage_path: storagePath,
      version_number: nextVersion,
      version_label: versionLabel,
      file_hash,
      file_size: file.size,
      status: "uploaded" as TechnicalFileStatus,
      is_current_version: true,
      uploaded_by: userId,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new TechnicalUploadError(`Falha ao registrar: ${insErr?.message ?? ""}`);
  }

  await supabase.from("technical_file_versions").insert({
    file_id: inserted.id,
    product_id: productId,
    version_number: nextVersion,
    version_label: versionLabel,
    action: "uploaded",
    payload: { filename: file.name, size: file.size, hash: file_hash },
    user_id: userId,
  });

  return { id: inserted.id, versionLabel, storagePath };
}

/** Processa um arquivo técnico: classifica, roteia parser e salva extração. */
export async function processTechnicalFile(fileVersionId: string, userId: string) {
  const { classifyFile, routeParser, logIngestion } = await import(
    "@/modules/coldpro/ingestion"
  );

  await supabase
    .from("technical_files")
    .update({ status: "processing" as TechnicalFileStatus })
    .eq("id", fileVersionId);

  const { data: file } = await supabase
    .from("technical_files")
    .select(
      "id, product_id, file_group, technical_category, original_filename, file_extension, mime_type, file_size, storage_path",
    )
    .eq("id", fileVersionId)
    .single();
  if (!file) throw new TechnicalUploadError("Arquivo não encontrado.");

  const t0 = performance.now();

  // Baixa o binário do storage
  const dl = await supabase.storage.from(BUCKET).download(file.storage_path);
  if (dl.error || !dl.data) {
    await supabase
      .from("technical_files")
      .update({ status: "failed" as TechnicalFileStatus })
      .eq("id", file.id);
    throw new TechnicalUploadError(`Falha ao baixar arquivo: ${dl.error?.message ?? ""}`);
  }
  const buffer = await dl.data.arrayBuffer();

  // Classificação por nome
  const initial = classifyFile({
    filename: file.original_filename,
    mimeType: file.mime_type,
    extension: file.file_extension,
    sizeBytes: file.file_size,
  });

  // Roteia parser (já combina base + técnico)
  const parsed = await routeParser(initial, buffer);

  // Reclassifica usando o rawText para refinar tipo técnico, se necessário
  const refined = classifyFile(
    {
      filename: file.original_filename,
      mimeType: file.mime_type,
      extension: file.file_extension,
      sizeBytes: file.file_size,
    },
    parsed.rawText,
  );

  const finalStatus: TechnicalFileStatus =
    parsed.errors.length && parsed.confidence < 0.3
      ? "rejected"
      : "uploaded";

  // Status técnico semântico que aparece no payload
  const semanticStatus =
    parsed.confidence >= 0.8
      ? "parsed"
      : parsed.confidence >= 0.5
        ? "needs_review"
        : "failed";

  await (supabase as any).from("technical_file_extractions").insert({
    file_id: file.id,
    product_id: file.product_id,
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

  // Mapeia o status para o enum permitido
  const dbStatus: TechnicalFileStatus =
    semanticStatus === "parsed" ? "parsed" : semanticStatus === "needs_review" ? "processing" : finalStatus;

  await supabase.from("technical_files").update({ status: dbStatus }).eq("id", file.id);

  const durationMs = Math.round(performance.now() - t0);
  logIngestion("processed", {
    fileId: file.id,
    filename: file.original_filename,
    parser: parsed.parserUsed,
    durationMs,
    fieldsFound: Object.keys(parsed.extractedFields).length,
    warnings: parsed.warnings,
    errors: parsed.errors,
  });

  await (supabase as any).from("technical_file_versions").insert({
    file_id: file.id,
    product_id: file.product_id,
    version_number: 0,
    version_label: "—",
    action: "processed",
    payload: { parser: parsed.parserUsed, confidence: parsed.confidence, semanticStatus },
    user_id: userId,
  });
}

export async function setTechnicalFileStatus(
  fileId: string,
  status: TechnicalFileStatus,
  userId: string,
) {
  await supabase.from("technical_files").update({ status }).eq("id", fileId);
  await supabase.from("technical_file_versions").insert({
    file_id: fileId,
    product_id:
      (await supabase.from("technical_files").select("product_id").eq("id", fileId).single()).data
        ?.product_id ?? "",
    version_number: 0,
    version_label: "—",
    action: `status:${status}`,
    payload: { status },
    user_id: userId,
  });
}

export async function approveTechnicalFile(fileId: string, userId: string) {
  const { data: file, error } = await supabase
    .from("technical_files")
    .select("id, product_id, file_group, technical_category, version_label")
    .eq("id", fileId)
    .single();
  if (error || !file) throw new TechnicalUploadError("Arquivo não encontrado.");

  const { data: extraction } = await supabase
    .from("technical_file_extractions")
    .select("extracted_fields")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await (supabase as any).from("technical_catalog_snapshots").insert({
    product_id: file.product_id,
    file_id: file.id,
    file_group: file.file_group,
    technical_category: file.technical_category,
    version_label: file.version_label,
    payload: extraction?.extracted_fields ?? {},
    approved_by: userId,
  });

  await setTechnicalFileStatus(fileId, "approved", userId);
}

export async function getTechnicalFileSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error || !data?.signedUrl) throw new TechnicalUploadError("Não foi possível gerar URL.");
  return data.signedUrl;
}
