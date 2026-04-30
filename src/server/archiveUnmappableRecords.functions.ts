import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * archiveUnmappableRawRecords
 * ---------------------------
 * Marca como `archived` todos os technical_raw_records que ficaram com
 * status `unmapped` (nenhum mapper reconheceu o formato). Esses registros
 * saem das telas principais, mas permanecem no banco para auditoria.
 *
 * Critério (acordado com o usuário):
 *   status IN ('unmapped','raw_imported') AND não existe mapped_record com
 *   approved_component_id (i.e. nada foi promovido para a biblioteca).
 *
 * Idempotente — pode ser chamado em loop. Retorna quantos foram arquivados.
 */

const InputSchema = z.object({
  pageSize: z.number().int().positive().max(2000).optional(),
  maxPages: z.number().int().positive().max(200).optional(),
});

export const archiveUnmappableRawRecords = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    const pageSize = Math.min(data.pageSize ?? 500, 2000);
    const maxPages = data.maxPages ?? 50;

    let archived = 0;
    let pages = 0;

    for (let page = 0; page < maxPages; page++) {
      const { data: rows, error } = await supabaseAdmin
        .from("technical_raw_records")
        .select("id")
        .eq("status", "unmapped")
        .order("id", { ascending: true })
        .limit(pageSize);

      if (error) throw new Error(`fetch unmapped: ${error.message}`);
      if (!rows || rows.length === 0) break;
      pages++;

      const ids = rows.map((r) => r.id);
      // Em chunks para evitar URL muito longa
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { error: upErr } = await supabaseAdmin
          .from("technical_raw_records")
          .update({ status: "archived" as never })
          .in("id", slice);
        if (upErr) throw new Error(`archive: ${upErr.message}`);
        archived += slice.length;
      }

      if (rows.length < pageSize) break;
    }

    return { archived, pages, ms: Date.now() - t0 };
  });

/**
 * unarchiveRawRecords — restaura registros arquivados para `raw_imported`,
 * permitindo nova tentativa de mapeamento (útil quando um novo mapper é
 * adicionado).
 */
export const unarchiveRawRecords = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ pageSize: z.number().int().positive().max(2000).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const pageSize = Math.min(data.pageSize ?? 1000, 2000);
    let restored = 0;
    for (let page = 0; page < 50; page++) {
      const { data: rows, error } = await supabaseAdmin
        .from("technical_raw_records")
        .select("id")
        .eq("status", "archived" as never)
        .limit(pageSize);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      const { error: upErr } = await supabaseAdmin
        .from("technical_raw_records")
        .update({ status: "raw_imported", notes: null })
        .in("id", ids);
      if (upErr) throw new Error(upErr.message);
      restored += ids.length;
      if (rows.length < pageSize) break;
    }
    return { restored };
  });
