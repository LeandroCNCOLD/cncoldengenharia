import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * processUnmappedRawRecords
 * -------------------------
 * Lê technical_raw_records com status=raw_imported (não mapeados ainda) e
 * tenta produzir technical_mapped_records aplicando heurísticas por tipo de
 * arquivo / pasta. Idempotente: pula raw_record_ids que já têm um mapped.
 *
 * Foco do pipeline atual: formato VAPCYC catálogo (1 raw_record = 1 arquivo
 * CSV com {rows: [...coeficientes polinomiais]}). Cobre Bristol, Copeland,
 * Tecumseh, EBMPapst Fans e samples.
 */

const InputSchema = z.object({
  batchId: z.string().uuid().nullable().optional(),
  pageSize: z.number().int().positive().max(2000).optional(),
  maxPages: z.number().int().positive().max(200).optional(),
});

type Json = Record<string, unknown>;

interface RawRow {
  id: string;
  batch_id: string;
  source_file: string | null;
  source_table: string | null;
  raw_json: Json;
  detected_entity_type: string;
  detected_manufacturer: string | null;
}

interface MapperOutput {
  entity_type:
    | "compressor"
    | "fan"
    | "expansion_valve"
    | "refrigerant"
    | "fluid"
    | "controller"
    | "sensor"
    | "evaporator_coil"
    | "condenser_coil"
    | "accessory"
    | "unknown";
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  normalized_json: Json;
  confidence_score: number;
  validation_errors: string[];
  mapper_name: string;
}

/* ---------- helpers ---------- */

function stripExt(filename: string | null): string | null {
  if (!filename) return null;
  return filename.replace(/\.[^./\\]+$/, "");
}

function detectManufacturerFromPath(folder: string): string | null {
  const f = folder.toLowerCase();
  if (f.includes("bristol")) return "Bristol";
  if (f.includes("copeland")) return "Copeland";
  if (f.includes("tecumseh")) return "Tecumseh";
  if (f.includes("ebmpapst") || f.includes("ebm-papst") || f.includes("ebm_papst")) return "ebm-papst";
  if (f.includes("torin")) return "Torin";
  if (f.includes("danfoss")) return "Danfoss";
  if (f.includes("bitzer")) return "BITZER";
  return null;
}

function detectRefrigerantFromPath(p: string): string | null {
  const m = p.match(/R\d{2,4}[A-Za-z]?/);
  return m ? m[0].toUpperCase() : null;
}

function isFanPath(p: string): boolean {
  const s = p.toLowerCase();
  return s.includes("fan") || s.includes("vent") || s.includes("ebmpapst") || s.includes("ebm-papst");
}

function isCompressorPath(p: string): boolean {
  const s = p.toLowerCase();
  return s.includes("compressor") || s.includes("bristol") || s.includes("copeland") || s.includes("tecumseh");
}

function isClimatePath(p: string): boolean {
  const s = p.toLowerCase();
  return s.includes("tmy3") || s.includes("climate");
}

function isCorrelationsPath(p: string): boolean {
  return p.toLowerCase().includes("correlation");
}

function isTemplatePath(p: string): boolean {
  return p.toLowerCase().includes("template");
}

/**
 * Mapper para o formato canônico dos raw VAPCYC: {rows: [{ID, MFCoeffs,
 * CapCoeffs, PowCoeffs, AmpsCoeffs, ...}, ...]}.
 * Modelo é derivado do nome do arquivo; refrigerante e fabricante do path.
 */
function mapVapcycCatalog(raw: RawRow): MapperOutput | null {
  const rj = raw.raw_json ?? {};
  const rows = (rj as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const folder = raw.source_table?.split("/")[0] ?? raw.source_file ?? "";
  const manufacturer = detectManufacturerFromPath(folder);
  const refrigerant = detectRefrigerantFromPath(raw.source_table ?? "") ?? detectRefrigerantFromPath(folder);

  const isFan = isFanPath(folder) || isFanPath(raw.source_file ?? "");
  const entity_type: MapperOutput["entity_type"] = isFan ? "fan" : "compressor";

  const model = stripExt(raw.source_file ?? null);
  if (!model) return null;

  const sample = (rows[0] ?? {}) as Json;
  const hasCompressorCoeffs =
    "MFCoeffs" in sample || "CapCoeffs" in sample || "PowCoeffs" in sample || "AmpsCoeffs" in sample;
  const hasFanCoeffs = "FanFlowCoeffs" in sample || "FanPowerCoeffs" in sample || "FanPressureCoeffs" in sample;

  const errors: string[] = [];
  if (entity_type === "compressor" && !hasCompressorCoeffs) {
    errors.push("Sem coeficientes de compressor (MF/Cap/Pow/Amps).");
  }
  if (entity_type === "fan" && !hasFanCoeffs && !hasCompressorCoeffs) {
    // alguns fans usam outro layout; deixamos como warning, não erro fatal
  }

  // Confiança maior quando temos fabricante e coeficientes; menor para samples/templates
  let confidence = 0.5;
  if (manufacturer) confidence += 0.15;
  if (hasCompressorCoeffs || hasFanCoeffs) confidence += 0.1;
  if (folder.toLowerCase().includes("sample")) confidence -= 0.15;
  if (folder.toLowerCase().includes("template")) confidence -= 0.25;
  confidence = Math.max(0.05, Math.min(0.95, confidence));

  return {
    entity_type,
    manufacturer,
    model,
    code: model,
    normalized_json: {
      model,
      manufacturer,
      refrigerant,
      source_folder: folder,
      source_file: raw.source_file,
      coefficients_count: rows.length,
      coefficients_sample: rows.slice(0, 3),
      // deixamos os rows completos no raw — não duplicamos aqui pra economizar bytes
    },
    confidence_score: confidence,
    validation_errors: errors,
    mapper_name: "vapcyc-catalog",
  };
}

function mapClimate(raw: RawRow): MapperOutput {
  const folder = raw.source_table?.split("/")[0] ?? "";
  const code = stripExt(raw.source_file ?? null);
  return {
    entity_type: "unknown",
    manufacturer: null,
    model: code,
    code,
    normalized_json: {
      kind: "climate_data",
      source_folder: folder,
      source_file: raw.source_file,
    },
    confidence_score: 0.2,
    validation_errors: ["Climate data — não é componente técnico; sem mapping para entity."],
    mapper_name: "climate-tmy3",
  };
}

function mapCorrelations(raw: RawRow): MapperOutput {
  const code = stripExt(raw.source_file ?? null);
  return {
    entity_type: "unknown",
    manufacturer: null,
    model: code,
    code,
    normalized_json: {
      kind: "coil_correlation",
      source_file: raw.source_file,
    },
    confidence_score: 0.3,
    validation_errors: ["Correlation reference — review manualmente antes de aprovar."],
    mapper_name: "correlations-ref",
  };
}

function mapTemplate(raw: RawRow): MapperOutput {
  const code = stripExt(raw.source_file ?? null);
  return {
    entity_type: "unknown",
    manufacturer: null,
    model: code,
    code,
    normalized_json: { kind: "template", source_file: raw.source_file },
    confidence_score: 0.1,
    validation_errors: ["Arquivo template — não representa componente real."],
    mapper_name: "template-skip",
  };
}

/**
 * Pipeline de detecção: tenta o mapper VAPCYC primeiro, depois fallbacks por
 * pasta. Retorna null se nada se aplicou (continua unmapped).
 */
function dispatchMapper(raw: RawRow): MapperOutput | null {
  const path = `${raw.source_table ?? ""} ${raw.source_file ?? ""}`;

  // 1) Catálogo VAPCYC (formato {rows:[...]})
  const vap = mapVapcycCatalog(raw);
  if (vap) return vap;

  // 2) Fallbacks por pasta
  if (isClimatePath(path)) return mapClimate(raw);
  if (isCorrelationsPath(path)) return mapCorrelations(raw);
  if (isTemplatePath(path)) return mapTemplate(raw);

  // Nada reconhecido
  return null;
}

/* ---------- main ---------- */

// Retry helper: tolera blips transitórios do Supabase/Cloudflare (521/522/timeouts).
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // Não tenta de novo se for erro lógico claro (sintaxe SQL, RLS, etc.)
      if (/permission denied|violates|duplicate key|invalid input syntax/i.test(msg)) throw e;
      const delay = 500 * Math.pow(2, i); // 0.5s, 1s, 2s, 4s
      console.warn(`[processRaw] ${label} attempt ${i + 1} failed: ${msg.slice(0, 200)} — retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const processUnmappedRawRecords = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    const pageSize = data.pageSize ?? 500;
    const maxPages = data.maxPages ?? 50;

    const summary = {
      processed: 0,
      mapped: 0,
      skipped_already_mapped: 0,
      unmapped: 0,
      pages: 0,
      errors_by_kind: {} as Record<string, number>,
      mappers_used: {} as Record<string, number>,
      ms: 0,
    };

    for (let page = 0; page < maxPages; page++) {
      let q = supabaseAdmin
        .from("technical_raw_records")
        .select("id, batch_id, source_file, source_table, raw_json, detected_entity_type, detected_manufacturer, status")
        .eq("status", "raw_imported")
        .order("created_at", { ascending: true })
        .limit(pageSize);
      if (data.batchId) q = q.eq("batch_id", data.batchId);

      const { data: rows, error } = await withRetry("fetch raw", () => q);
      if (error) throw new Error(`fetch raw: ${error.message}`);
      if (!rows || rows.length === 0) break;
      summary.pages++;

      // Idempotência: descobre quais raw_record_ids já têm mapped (em chunks
      // para não estourar o tamanho da URL no PostgREST).
      const ids = rows.map((r) => r.id);
      const alreadyMapped = new Set<string>();
      const CHUNK = 100;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data: existing, error: exErr } = await withRetry("fetch existing", () =>
          supabaseAdmin
            .from("technical_mapped_records")
            .select("raw_record_id")
            .in("raw_record_id", slice),
        );
        if (exErr) throw new Error(`fetch existing: ${exErr.message}`);
        for (const r of existing ?? []) {
          if (r.raw_record_id) alreadyMapped.add(r.raw_record_id as string);
        }
      }

      const toInsertMapped: Array<Record<string, unknown>> = [];
      const updates: { id: string; status: "mapped" | "unmapped"; notes: string | null }[] = [];

      for (const raw of rows as RawRow[]) {
        summary.processed++;
        if (alreadyMapped.has(raw.id)) {
          summary.skipped_already_mapped++;
          // Marca como mapped para sair da fila
          updates.push({ id: raw.id, status: "mapped", notes: null });
          continue;
        }

        let mapped: MapperOutput | null = null;
        try {
          mapped = dispatchMapper(raw);
        } catch (e) {
          mapped = null;
          summary.errors_by_kind["dispatch_exception"] =
            (summary.errors_by_kind["dispatch_exception"] ?? 0) + 1;
        }

        if (!mapped) {
          summary.unmapped++;
          summary.errors_by_kind["no_mapper_match"] =
            (summary.errors_by_kind["no_mapper_match"] ?? 0) + 1;
          updates.push({
            id: raw.id,
            status: "unmapped",
            notes: "Nenhum mapper reconheceu este registro (formato não suportado).",
          });
          continue;
        }

        toInsertMapped.push({
          batch_id: raw.batch_id,
          raw_record_id: raw.id,
          entity_type: mapped.entity_type,
          manufacturer: mapped.manufacturer,
          model: mapped.model,
          code: mapped.code,
          normalized_json: mapped.normalized_json,
          confidence_score: mapped.confidence_score,
          mapping_status: mapped.validation_errors.length > 0 ? "needs_review" : "mapped",
          validation_errors_json: mapped.validation_errors,
          mapper_name: mapped.mapper_name,
        });
        summary.mapped++;
        summary.mappers_used[mapped.mapper_name] =
          (summary.mappers_used[mapped.mapper_name] ?? 0) + 1;
        updates.push({ id: raw.id, status: "mapped", notes: null });
      }

      // Insert mapped em batches
      if (toInsertMapped.length > 0) {
        for (let i = 0; i < toInsertMapped.length; i += 200) {
          const slice = toInsertMapped.slice(i, i + 200);
          const { error: insErr } = await supabaseAdmin
            .from("technical_mapped_records")
            .insert(slice as never);
          if (insErr) {
            summary.errors_by_kind[`insert_mapped:${insErr.code ?? "unknown"}`] =
              (summary.errors_by_kind[`insert_mapped:${insErr.code ?? "unknown"}`] ?? 0) + slice.length;
          }
        }
      }

      // Atualiza raw status (em chunks por status para minimizar round-trips)
      const groupMapped = updates.filter((u) => u.status === "mapped").map((u) => u.id);
      const groupUnmapped = updates.filter((u) => u.status === "unmapped");

      for (let i = 0; i < groupMapped.length; i += 100) {
        const slice = groupMapped.slice(i, i + 100);
        const { error: upErr } = await supabaseAdmin
          .from("technical_raw_records")
          .update({ status: "mapped", notes: null })
          .in("id", slice);
        if (upErr) {
          summary.errors_by_kind[`update_raw_mapped:${upErr.code ?? "unknown"}`] =
            (summary.errors_by_kind[`update_raw_mapped:${upErr.code ?? "unknown"}`] ?? 0) + slice.length;
        }
      }

      // Para unmapped, notes pode variar — atualiza um por um (volume é pequeno)
      for (const u of groupUnmapped) {
        const { error: upErr } = await supabaseAdmin
          .from("technical_raw_records")
          .update({ status: "unmapped", notes: u.notes })
          .eq("id", u.id);
        if (upErr) {
          summary.errors_by_kind[`update_raw_unmapped:${upErr.code ?? "unknown"}`] =
            (summary.errors_by_kind[`update_raw_unmapped:${upErr.code ?? "unknown"}`] ?? 0) + 1;
        }
      }

      // Se a página retornou menos que pageSize, acabou
      if (rows.length < pageSize) break;
    }

    summary.ms = Date.now() - t0;
    return summary;
  });
