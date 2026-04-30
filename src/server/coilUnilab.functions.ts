/**
 * Server functions para o formulário Unilab-style do Coil Simulator.
 *
 * - listCoilMaterials: dropdown de materiais (tubo/aleta).
 * - listCnCatalogModelsLite: lista leve de TODOS os modelos CN (cada linha é UM ponto).
 * - listCnCatalogPointsByModelo: lista todos os pontos da curva de um mesmo modelo.
 * - getCnCatalogPointByModelId: retorna 1 ponto + geometria (evap/cond) extraída do raw_json.
 * - findCnCatalogPointByCode: tenta casar equipment.code → modelo (exato + ilike fallback).
 *
 * O catálogo está numa tabela única (`cn_catalog_performance_curves`), onde:
 *   - 1 linha = 1 ponto operacional (curva_json) de um modelo
 *   - raw_json contém TODOS os campos do equipamento (geral_*, evaporador_*,
 *     condensador_*, curva_*) provenientes do CSV importado.
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
  curvaIndice: number | null;
};

export const listCnCatalogModelsLite = createServerFn({ method: "GET" }).handler(
  async (): Promise<CnCatalogModelLite[]> => {
    const { data, error } = await supabaseAdmin
      .from("cn_catalog_performance_curves")
      .select("id,modelo,refrigerante,linha,hp,total_pontos,curva_indice")
      .order("modelo", { ascending: true })
      .order("curva_indice", { ascending: true })
      .limit(5000);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      modelo: r.modelo as string,
      refrigerante: (r.refrigerante as string | null) ?? null,
      linha: (r.linha as string | null) ?? null,
      hp: (r.hp as string | null) ?? null,
      totalPontos: (r.total_pontos as number | null) ?? null,
      curvaIndice: (r.curva_indice as number | null) ?? null,
    }));
  },
);

/** Geometria parseada do raw_json para evaporador/condensador. */
export type CnCatalogGeometry = {
  tubesPerRow: number | null;
  rows: number | null;
  coilLengthMm: number | null;
  circuits: number | null;
  finPitchMm: number | null;
  tubeOdMm: number | null;
  tubeWallMm: number | null;
  tubePitchMm: number | null;
  rowPitchMm: number | null;
  finThicknessMm: number | null;
  skippedTubes: number | null;
  airflowM3h: number | null;
};

export type CnCatalogPoint = {
  id: string;
  modelo: string;
  refrigerante: string | null;
  curvaIndice: number | null;
  totalPontos: number | null;
  capacityKcalh: number | null;
  capacityW: number | null;
  tempEvapC: number | null;
  tempCondC: number | null;
  superheatK: number | null;
  subcoolingK: number | null;
  airflowM3h: number | null;
  /** Umidade relativa interna (% câmara), do ponto da curva. */
  rhInPct: number | null;
  /** Geometria do evaporador inferida do raw_json. */
  evaporatorGeometry: CnCatalogGeometry;
  /** Geometria do condensador inferida do raw_json. */
  condenserGeometry: CnCatalogGeometry;
  /** Resumo serializável do raw_json (apenas chaves escalar/string). */
  raw: Record<string, string | number | boolean | null>;
};

const POINT_KEYS = {
  tempEvap: "TEMPERATURA DE EVAPORAÇÃO  (°C)",
  tempCond: "TEMPERATURA DE CONDENSAÇÃO  (°C)",
  capacityKcalh: "CAPACIDADE FRIGORÍFICA DO COMPRESSOR (Kcal/h)",
  superheatTotal: "SUPERAQUECIMENTO TOTAL (K)",
  subcooling: "SUBRESFRIAMENTO (K)",
  airflow: "VAZÃO VENTILADOR EVAPORADOR (m³/h)",
  rhIn: "UMIDADE INTERNA (%)",
} as const;

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parseia strings tipo "2X16 - 4 CIRCUITOS - ESPAÇAMENTO 5,00 mm - 600 mm"
 * (formato comum do "MODELO EVAPORADOR" / "condensador_condenser_model").
 */
function parseGeometryString(str: string | null | undefined): {
  rows: number | null;
  tubesPerRow: number | null;
  circuits: number | null;
  finPitchMm: number | null;
  coilLengthMm: number | null;
} {
  if (!str || typeof str !== "string") {
    return { rows: null, tubesPerRow: null, circuits: null, finPitchMm: null, coilLengthMm: null };
  }
  const s = str.toUpperCase().replace(/,/g, ".");
  let rows: number | null = null;
  let tubesPerRow: number | null = null;
  // "2X16" ou "2 X 16" ou "3x18"
  const dim = s.match(/(\d+)\s*X\s*(\d+)/);
  if (dim) {
    rows = Number(dim[1]);
    tubesPerRow = Number(dim[2]);
  }
  const cir = s.match(/(\d+)\s*CIRCUITO/);
  const circuits = cir ? Number(cir[1]) : null;
  const fin = s.match(/ESPA[CÇ]AMENTO\s*([\d.]+)/);
  const finPitchMm = fin ? Number(fin[1]) : null;
  // último número seguido de "MM" é o comprimento do aletado
  const len = s.match(/(\d+(?:\.\d+)?)\s*MM\s*$/);
  const coilLengthMm = len ? Number(len[1]) : null;
  return { rows, tubesPerRow, circuits, finPitchMm, coilLengthMm };
}

function extractGeometry(
  raw: Record<string, unknown>,
  side: "evaporador" | "condensador",
): CnCatalogGeometry {
  const k = (suffix: string) => raw[`${side}_${suffix}`];
  // Strings que carregam dimensões compactas
  const modelStr =
    side === "evaporador"
      ? (raw["evaporador_evaporator_model"] as string | undefined) ??
        (raw["MODELO EVAPORADOR"] as string | undefined) ??
        // pode estar dentro de curva_raw (string JSON)
        tryGetFromCurvaRaw(raw, "MODELO EVAPORADOR")
      : (raw["condensador_condenser_model"] as string | undefined) ??
        (raw["MODELO CONDENSADOR"] as string | undefined) ??
        tryGetFromCurvaRaw(raw, "MODELO CONDENSADOR");

  const parsed = parseGeometryString(modelStr ?? null);

  const tubesPerRow = toNum(k("tubes_per_row")) ?? parsed.tubesPerRow;
  const rows = toNum(k("rows")) ?? parsed.rows;
  // length_m → mm; ou já vem em mm
  const lenMm =
    toNum(k("tube_length_mm")) ??
    (toNum(k("tube_length_m")) != null ? (toNum(k("tube_length_m")) as number) * 1000 : null) ??
    parsed.coilLengthMm;
  const circuits = toNum(k("circuits")) ?? parsed.circuits;
  const finPitchMm = toNum(k("fin_spacing_mm")) ?? parsed.finPitchMm;
  const tubeOdMm = toNum(k("tube_outer_diameter_mm")) ?? toNum(k("tube_diameter_mm"));
  const tubeWallMm = toNum(k("tube_wall_thickness_mm")) ?? toNum(k("tube_thickness_mm"));
  const tubePitchMm = toNum(k("tube_pitch_mm"));
  const rowPitchMm = toNum(k("row_pitch_mm"));
  const finThicknessMm = toNum(k("fin_thickness_mm"));
  const skippedTubes = toNum(k("unused_tubes"));
  const airflowM3h = toNum(k("airflow_m3_h"));

  return {
    tubesPerRow,
    rows,
    coilLengthMm: lenMm,
    circuits,
    finPitchMm,
    tubeOdMm,
    tubeWallMm,
    tubePitchMm,
    rowPitchMm,
    finThicknessMm,
    skippedTubes,
    airflowM3h,
  };
}

function tryGetFromCurvaRaw(
  raw: Record<string, unknown>,
  key: string,
): string | undefined {
  const cr = raw["curva_raw"];
  if (typeof cr !== "string") return undefined;
  try {
    const parsed = JSON.parse(cr) as Record<string, unknown>;
    const v = parsed[key];
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

function pointFromRow(row: {
  id: string;
  modelo: string;
  refrigerante: string | null;
  curva_indice: number | null;
  total_pontos: number | null;
  curva_json: unknown;
  raw_json: unknown;
}): CnCatalogPoint {
  const cj = row.curva_json as unknown;
  const objRaw: Record<string, unknown> = Array.isArray(cj)
    ? ((cj[0] as Record<string, unknown>) ?? {})
    : ((cj as Record<string, unknown>) ?? {});
  const num = (k: string): number | null => toNum(objRaw[k]);
  const kcal = num(POINT_KEYS.capacityKcalh);
  const raw = (row.raw_json as Record<string, unknown>) ?? {};

  return {
    id: row.id,
    modelo: row.modelo,
    refrigerante: row.refrigerante,
    curvaIndice: row.curva_indice,
    totalPontos: row.total_pontos,
    capacityKcalh: kcal,
    capacityW: kcal != null ? kcal * 1.163 : null,
    tempEvapC: num(POINT_KEYS.tempEvap),
    tempCondC: num(POINT_KEYS.tempCond),
    superheatK: num(POINT_KEYS.superheatTotal),
    subcoolingK: num(POINT_KEYS.subcooling),
    airflowM3h: num(POINT_KEYS.airflow),
    rhInPct: num(POINT_KEYS.rhIn),
    evaporatorGeometry: extractGeometry(raw, "evaporador"),
    condenserGeometry: extractGeometry(raw, "condensador"),
    raw,
  };
}

const POINT_SELECT =
  "id,modelo,refrigerante,curva_indice,total_pontos,curva_json,raw_json";

export const getCnCatalogPointByModelId = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ modelId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<CnCatalogPoint | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("cn_catalog_performance_curves")
      .select(POINT_SELECT)
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

    // 1) match exato (case-insensitive)
    for (const cand of candidates) {
      const { data: row } = await supabaseAdmin
        .from("cn_catalog_performance_curves")
        .select(POINT_SELECT)
        .ilike("modelo", cand)
        .order("curva_indice", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (row) return pointFromRow(row as never);
    }
    // 2) fallback parcial
    for (const cand of candidates) {
      const { data: row } = await supabaseAdmin
        .from("cn_catalog_performance_curves")
        .select(POINT_SELECT)
        .ilike("modelo", `%${cand}%`)
        .order("curva_indice", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (row) return pointFromRow(row as never);
    }
    return null;
  });

/** Lista todos os pontos da curva de um mesmo modelo, para o seletor "Ponto da curva CN". */
export const listCnCatalogPointsByModelo = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ modelo: z.string().min(1), refrigerante: z.string().optional() }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<
      Array<{
        id: string;
        curvaIndice: number | null;
        refrigerante: string | null;
        tempEvapC: number | null;
        tempCondC: number | null;
        capacityKcalh: number | null;
      }>
    > => {
      let q = supabaseAdmin
        .from("cn_catalog_performance_curves")
        .select("id,refrigerante,curva_indice,curva_json")
        .ilike("modelo", data.modelo)
        .order("curva_indice", { ascending: true, nullsFirst: false })
        .limit(200);
      if (data.refrigerante) q = q.eq("refrigerante", data.refrigerante);
      const { data: rows, error } = await q;
      if (error) throw error;
      return (rows ?? []).map((r) => {
        const cj = r.curva_json as unknown;
        const obj: Record<string, unknown> = Array.isArray(cj)
          ? ((cj[0] as Record<string, unknown>) ?? {})
          : ((cj as Record<string, unknown>) ?? {});
        const kcal = toNum(obj[POINT_KEYS.capacityKcalh]);
        return {
          id: r.id as string,
          curvaIndice: (r.curva_indice as number | null) ?? null,
          refrigerante: (r.refrigerante as string | null) ?? null,
          tempEvapC: toNum(obj[POINT_KEYS.tempEvap]),
          tempCondC: toNum(obj[POINT_KEYS.tempCond]),
          capacityKcalh: kcal,
        };
      });
    },
  );
