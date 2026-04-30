import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * approveAllMappedRecords
 * -----------------------
 * Promove em massa technical_mapped_records (status = 'mapped' ou 'needs_review'
 * com confidence > 0) para technical_components. Sobrescreve duplicatas por
 * (manufacturer, model, code, entity_type).
 *
 * Idempotente — pode ser chamado em loop até esvaziar a fila.
 */

const InputSchema = z.object({
  pageSize: z.number().int().positive().max(500).optional(),
  maxPages: z.number().int().positive().max(200).optional(),
  /** Se true, aprova também needs_review (desde que confidence > 0). */
  includeNeedsReview: z.boolean().optional(),
});

type Json = Record<string, unknown>;

interface MappedRow {
  id: string;
  batch_id: string;
  raw_record_id: string | null;
  entity_type: string;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  normalized_json: Json;
  confidence_score: number;
  mapping_status: string;
}

async function withRetry<T>(label: string, fn: () => PromiseLike<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/permission denied|violates|invalid input syntax/i.test(msg)) throw e;
      const delay = 500 * Math.pow(2, i);
      console.warn(`[approveMapped] ${label} attempt ${i + 1}: ${msg.slice(0, 200)} — retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function dedupeKey(m: MappedRow): string {
  return [
    (m.manufacturer ?? "").toLowerCase().trim(),
    (m.model ?? "").toLowerCase().trim(),
    (m.code ?? "").toLowerCase().trim(),
    m.entity_type,
  ].join("|");
}

export const approveAllMappedRecords = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    const pageSize = Math.min(data.pageSize ?? 200, 500);
    const maxPages = data.maxPages ?? 5;
    const includeNeedsReview = data.includeNeedsReview ?? false;

    const summary = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped_no_model: 0,
      skipped_zero_confidence: 0,
      errors: 0,
      pages: 0,
      ms: 0,
    };

    const statuses = includeNeedsReview ? ["mapped", "needs_review"] : ["mapped"];

    for (let page = 0; page < maxPages; page++) {
      const { data: rows, error } = await withRetry("fetch mapped", () =>
        supabaseAdmin
          .from("technical_mapped_records")
          .select("id, batch_id, raw_record_id, entity_type, manufacturer, model, code, normalized_json, confidence_score, mapping_status")
          .in("mapping_status", statuses)
          .is("approved_component_id", null)
          .gt("confidence_score", 0)
          .order("id", { ascending: true })
          .limit(pageSize),
      );
      if (error) throw new Error(`fetch mapped: ${error.message}`);
      if (!rows || rows.length === 0) break;
      summary.pages++;

      // Dedupe dentro da própria página (último vence — ordem por id)
      const byKey = new Map<string, MappedRow>();
      const orderedKeys: string[] = [];
      for (const r of rows as MappedRow[]) {
        if (!r.model && !r.code) {
          summary.skipped_no_model++;
          continue;
        }
        if (r.confidence_score <= 0) {
          summary.skipped_zero_confidence++;
          continue;
        }
        const k = dedupeKey(r);
        if (!byKey.has(k)) orderedKeys.push(k);
        byKey.set(k, r); // sobrescreve com o mais recente
      }

      // Upsert em technical_components — busca existentes e decide insert vs update
      for (const key of orderedKeys) {
        const m = byKey.get(key);
        if (!m) continue;
        summary.processed++;

        try {
          // Busca existente por (manufacturer, model, code, entity_type)
          let existingQuery = supabaseAdmin
            .from("technical_components")
            .select("id")
            .eq("entity_type", m.entity_type as never);
          existingQuery = m.manufacturer
            ? existingQuery.eq("manufacturer", m.manufacturer)
            : existingQuery.is("manufacturer", null);
          existingQuery = m.model
            ? existingQuery.eq("model", m.model)
            : existingQuery.is("model", null);
          existingQuery = m.code
            ? existingQuery.eq("code", m.code)
            : existingQuery.is("code", null);

          const { data: existing } = await existingQuery.maybeSingle();

          let componentId: string | null = null;
          const now = new Date().toISOString();

          if (existing?.id) {
            const { error: upErr } = await supabaseAdmin
              .from("technical_components")
              .update({
                normalized_json: m.normalized_json,
                source_batch_id: m.batch_id,
                source_raw_id: m.raw_record_id,
                source_mapped_id: m.id,
                status: "approved",
                approved_at: now,
                updated_at: now,
              })
              .eq("id", existing.id);
            if (upErr) throw upErr;
            componentId = existing.id;
            summary.updated++;
          } else {
            const { data: ins, error: insErr } = await supabaseAdmin
              .from("technical_components")
              .insert({
                entity_type: m.entity_type as never,
                manufacturer: m.manufacturer,
                model: m.model,
                code: m.code,
                normalized_json: m.normalized_json,
                source_batch_id: m.batch_id,
                source_raw_id: m.raw_record_id,
                source_mapped_id: m.id,
                status: "approved",
                approved_at: now,
                context: "reference",
              })
              .select("id")
              .single();
            if (insErr) throw insErr;
            componentId = ins?.id ?? null;
            summary.created++;
          }

          // Marca mapped como aprovado
          if (componentId) {
            await supabaseAdmin
              .from("technical_mapped_records")
              .update({
                approved_component_id: componentId,
                mapping_status: "approved",
                reviewed_at: now,
              })
              .eq("id", m.id);
          }
        } catch (e) {
          summary.errors++;
          console.error(`[approveMapped] failed for ${m.id}:`, e instanceof Error ? e.message : e);
        }
      }

      if (rows.length < pageSize) break;
    }

    summary.ms = Date.now() - t0;
    return summary;
  });
