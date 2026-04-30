/**
 * Server functions para o formulário Unilab-style do Coil Simulator:
 *  - listCoilMaterials: dropdown de materiais (tubo/aleta) da tabela coil_materials
 *  - listCnCatalogModelsLite: lista leve de modelos CN para o seletor manual
 *  - getCnCatalogPoint: busca o ponto operacional mais próximo (TempEvap/TempCond) numa
 *    curva CN do modelo escolhido — ou via match por code do equipamento.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CoilMaterialRow = {
  id: string;
  name: string;
  category: "tube" | "fin" | "both";
  thermal_conductivity_w_mk: number;
};

export const listCoilMaterials = createServerFn({ method: "GET" }).handler(
  async (): Promise<CoilMaterialRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("coil_materials")
      .select("id,name,category,thermal_conductivity_w_mk")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CoilMaterialRow[];
  },
);

export type CnCatalogModelLite = {
  id: string;
  modelo: string;
  refrigerante: string | null;
  linha: string | null;
  hp: string | null;
  totalPontos: number | null;
};

export const listCnCatalogModelsLite = createServerFn({ method: "GET" }).handler(
  async (): Promise<CnCatalogModelLite[]> => {
    const { data, error } = await supabaseAdmin
      .from("cn_catalog_performance_curves")
      .select("id,modelo,refrigerante,linha,hp,total_pontos")
      .order("modelo", { ascending: true })
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      modelo: r.modelo as string,
      refrigerante: (r.refrigerante as string | null) ?? null,
      linha: (r.linha as string | null) ?? null,
      hp: (r.hp as string | null) ?? null,
      totalPontos: (r.total_pontos as number | null) ?? null,
    }));
  },
);

export type CnCatalogPoint = {
  modelo: string;
  refrigerante: string | null;
  capacityKcalh: number | null;
  capacityW: number | null;
  tempEvapC: number | null;
  tempCondC: number | null;
  superheatK: number | null;
  subcoolingK: number | null;
  airflowM3h: number | null;
  raw: Record<string, unknown>;
};

const POINT_KEYS = {
  tempEvap: "TEMPERATURA DE EVAPORAÇÃO  (°C)",
  tempCond: "TEMPERATURA DE CONDENSAÇÃO  (°C)",
  capacityKcalh: "CAPACIDADE FRIGORÍFICA DO COMPRESSOR (Kcal/h)",
  superheatTotal: "SUPERAQUECIMENTO TOTAL (K)",
  subcooling: "SUBRESFRIAMENTO (K)",
  airflow: "VAZÃO VENTILADOR EVAPORADOR (m³/h)",
} as const;

function pointFromRow(row: {
  modelo: string;
  refrigerante: string | null;
  curva_json: unknown;
}): CnCatalogPoint {
  const cj = row.curva_json as Record<string, unknown>;
  // curva_json no banco é OBJETO único (não array) representando o ponto nominal.
  const obj: Record<string, unknown> = Array.isArray(cj) ? ((cj[0] as Record<string, unknown>) ?? {}) : (cj ?? {});
  const num = (k: string): number | null => {
    const v = obj[k];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const kcal = num(POINT_KEYS.capacityKcalh);
  return {
    modelo: row.modelo,
    refrigerante: row.refrigerante,
    capacityKcalh: kcal,
    capacityW: kcal != null ? kcal * 1.163 : null,
    tempEvapC: num(POINT_KEYS.tempEvap),
    tempCondC: num(POINT_KEYS.tempCond),
    superheatK: num(POINT_KEYS.superheatTotal),
    subcoolingK: num(POINT_KEYS.subcooling),
    airflowM3h: num(POINT_KEYS.airflow),
    raw: obj,
  };
}

export const getCnCatalogPointByModelId = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ modelId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<CnCatalogPoint | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("cn_catalog_performance_curves")
      .select("modelo,refrigerante,curva_json")
      .eq("id", data.modelId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return pointFromRow(row as never);
  });

export const findCnCatalogPointByCode = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        code: z.string().min(1).optional(),
        commercialName: z.string().min(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CnCatalogPoint | null> => {
    const candidates = [data.code, data.commercialName].filter(Boolean) as string[];
    if (candidates.length === 0) return null;
    for (const cand of candidates) {
      const { data: row } = await supabaseAdmin
        .from("cn_catalog_performance_curves")
        .select("modelo,refrigerante,curva_json")
        .ilike("modelo", cand)
        .limit(1)
        .maybeSingle();
      if (row) return pointFromRow(row as never);
    }
    // fallback: busca parcial
    for (const cand of candidates) {
      const { data: row } = await supabaseAdmin
        .from("cn_catalog_performance_curves")
        .select("modelo,refrigerante,curva_json")
        .ilike("modelo", `%${cand}%`)
        .limit(1)
        .maybeSingle();
      if (row) return pointFromRow(row as never);
    }
    return null;
  });
