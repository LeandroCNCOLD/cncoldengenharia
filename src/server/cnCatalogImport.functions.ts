/**
 * Importer do CSV catalogo-coldpro-2026-04-30.csv para a tabela
 * cn_catalog_performance_curves.
 *
 * Recebe as linhas já parseadas no client (via catalog-csv-parser) e
 * faz upsert em lotes via supabaseAdmin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PointRowSchema = z.object({
  modelo: z.string().min(1).max(200),
  linha: z.string().max(200).nullable().optional(),
  hp: z.string().max(50).nullable().optional(),
  gabinete: z.string().max(100).nullable().optional(),
  tipo: z.string().max(100).nullable().optional(),
  refrigerante: z.string().max(100).nullable().optional(),
  curva_indice: z.number().int().nullable().optional(),
  total_pontos: z.number().int().nullable().optional(),
  curva_json: z.unknown().optional(),
  corrente_estimada: z.number().nullable().optional(),
  corrente_partida: z.number().nullable().optional(),
  carga_fluido: z.number().nullable().optional(),
  origem: z.string().max(200).nullable().optional(),
  raw_json: z.record(z.string(), z.string()).optional(),
});

const InputSchema = z.object({
  rows: z.array(PointRowSchema).min(1).max(2000),
  replaceAll: z.boolean().optional().default(false),
});

export const importCnCatalogCurves = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.replaceAll) {
      // limpa para reimportar do zero
      const { error: delErr } = await supabaseAdmin
        .from("cn_catalog_performance_curves")
        .delete()
        .not("id", "is", null);
      if (delErr) throw new Error(`Falha ao limpar tabela: ${delErr.message}`);
    }

    const CHUNK = 200;
    let inserted = 0;
    for (let i = 0; i < data.rows.length; i += CHUNK) {
      const slice = data.rows.slice(i, i + CHUNK).map((r) => ({
        modelo: r.modelo,
        linha: r.linha ?? null,
        hp: r.hp ?? null,
        gabinete: r.gabinete ?? null,
        tipo: r.tipo ?? null,
        refrigerante: r.refrigerante ?? null,
        curva_indice: r.curva_indice ?? null,
        total_pontos: r.total_pontos ?? null,
        curva_json: r.curva_json ?? [],
        corrente_estimada: r.corrente_estimada ?? null,
        corrente_partida: r.corrente_partida ?? null,
        carga_fluido: r.carga_fluido ?? null,
        origem: r.origem ?? null,
        raw_json: r.raw_json ?? {},
      }));
      const { error } = await supabaseAdmin
        .from("cn_catalog_performance_curves")
        .insert(slice as never);
      if (error) throw new Error(`Erro inserindo lote ${i}: ${error.message}`);
      inserted += slice.length;
    }

    return { inserted, total: data.rows.length };
  });
