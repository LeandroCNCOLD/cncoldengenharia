// Service de carregamento e consulta do catálogo de geometrias UNILAB.
// Lê /public/data/catalogs/coilGeometries.json (gerado a partir do dataset UNILAB)
// e expõe um modelo enriquecido com os campos físicos exigidos pela tela.
//
// Regras:
// - Sem mocks. Sem fallback silencioso. Erros são propagados ao consumidor.
// - Não recalcula nada termodinâmico. Apenas leitura, filtragem e enriquecimento.
// - Cache em módulo (singleton in-memory) para evitar refetch quando vários
//   componentes pedirem a lista na mesma sessão.

import type { CoilGeometryCatalogItem } from "../types/unilab.types";

/** Tipos de serpentina aceitos no filtro da UI (pt-BR). */
export const TIPO_SERPENTINA_VALUES = [
  "Condensação",
  "Expansão Direta",
  "Evaporador Bomba",
  "Resfriamento",
  "Aquecimento",
  "Vapor",
] as const;

export type TipoSerpentina = (typeof TIPO_SERPENTINA_VALUES)[number];

/** Mapeia coil_type (catálogo UNILAB, em inglês) → tipo_serpentina (UI pt-BR). */
const COIL_TYPE_TO_TIPO_SERPENTINA: Record<string, TipoSerpentina> = {
  condensation: "Condensação",
  direct_expansion: "Expansão Direta",
  flooded_evaporator: "Evaporador Bomba",
  cooling: "Resfriamento",
  heating: "Aquecimento",
  vapor: "Vapor",
};

/** Forma da aleta — código numérico do UNILAB (`fin_type`) → rótulo legível. */
const FIN_TYPE_LABEL: Record<number, string> = {
  1: "Lisa",
  2: "Ondulada",
  3: "Persianada",
};

/** Tipo de bateria — código numérico (`tube_type`) → rótulo legível. */
const TUBE_TYPE_LABEL: Record<number, string> = {
  1: "Lisa",
  2: "Ranhurada",
  3: "Microaletada",
};

/**
 * Modelo extendido carregado pela tela do simulador.
 * Inclui os campos físicos (em pt-BR para casar com a especificação) derivados
 * a partir do `raw` do JSON do catálogo.
 */
export interface CoilGeometryItem extends CoilGeometryCatalogItem {
  tipo_serpentina: TipoSerpentina | null;
  descricao: string;
  codigo: string;
  // Campos físicos preenchidos a partir da geometria (pt-BR conforme spec)
  passo_fileiras_mm: number | null;
  passo_tubos_mm: number | null;
  diametro_externo_tubo_mm: number | null;
  diametro_interno_tubo_mm: number | null;
  espessura_tubo_mm: number | null;
  espessura_aleta_mm: number | null;
  forma_aleta: string | null;
  tipo_bateria: string | null;
  fator_correcao_aleta: number | null;
  fator_atrito_ar: number | null;
  razao_superficies_internas: number | null;
  tubo_liso: boolean | null;
  certificacao_ahri: boolean | null;
  certificacao_eurovent: boolean | null;
}

interface RawGeometryEntry {
  id: string;
  name: string;
  tubePitchTransverseMm?: number;
  tubePitchLongitudinalMm?: number;
  tubeOuterDiameterMm?: number;
  tubeInnerDiameterMm?: number;
  defaultRows?: number;
  defaultCircuits?: number;
  uBaseWm2K?: number;
  raw: Record<string, unknown>;
}

const CATALOG_URL = "/data/catalogs/coilGeometries.json";

let cache: CoilGeometryItem[] | null = null;
let inflight: Promise<CoilGeometryItem[]> | null = null;

/**
 * Lê um campo numérico do raw. Aceita number; retorna null para null/undefined/string vazia.
 * Lança erro se o valor existir mas não for numérico (evita corromper a UI).
 */
function readNum(raw: Record<string, unknown>, key: string): number | null {
  const v = raw[key];
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readBool(raw: Record<string, unknown>, key: string): boolean | null {
  const v = raw[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(s)) return true;
    if (["false", "0", "nao", "não", "no"].includes(s)) return false;
  }
  return null;
}

function readStr(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key];
  if (v === null || v === undefined) return null;
  return String(v);
}

function enrich(entry: RawGeometryEntry): CoilGeometryItem {
  const raw = entry.raw ?? {};
  const coilType = readStr(raw, "coil_type") ?? "";
  const tipo = COIL_TYPE_TO_TIPO_SERPENTINA[coilType] ?? null;
  const finType = readNum(raw, "fin_type");
  const tubeType = readNum(raw, "tube_type");

  // Coerções para o shape requerido pela base CoilGeometryCatalogItem.
  // Os valores "verdadeiros" vêm dos campos físicos pt-BR abaixo (podem ser null).
  const tubePitchTransverseMm =
    entry.tubePitchTransverseMm ?? readNum(raw, "tube_pitch_mm") ?? 0;
  const tubePitchLongitudinalMm =
    entry.tubePitchLongitudinalMm ?? readNum(raw, "row_pitch_mm") ?? 0;
  const tubeOuterDiameterMm =
    entry.tubeOuterDiameterMm ?? readNum(raw, "tube_od_mm") ?? 0;
  const tubeInnerDiameterMm =
    entry.tubeInnerDiameterMm ?? readNum(raw, "tube_id_mm") ?? undefined;

  return {
    ...entry,
    tubePitchTransverseMm,
    tubePitchLongitudinalMm,
    tubeOuterDiameterMm,
    tubeInnerDiameterMm,
    tipo_serpentina: tipo,
    descricao: readStr(raw, "description") ?? entry.name,
    codigo: readStr(raw, "code") ?? entry.id,

    passo_fileiras_mm: readNum(raw, "row_pitch_mm"),
    passo_tubos_mm: readNum(raw, "tube_pitch_mm"),
    diametro_externo_tubo_mm: readNum(raw, "tube_od_mm"),
    diametro_interno_tubo_mm: readNum(raw, "tube_id_mm"),
    espessura_tubo_mm: readNum(raw, "tube_wall_mm"),
    espessura_aleta_mm: readNum(raw, "fin_thickness_mm"),
    forma_aleta:
      finType !== null ? FIN_TYPE_LABEL[finType] ?? `Tipo ${finType}` : null,
    tipo_bateria:
      tubeType !== null ? TUBE_TYPE_LABEL[tubeType] ?? `Tipo ${tubeType}` : null,
    fator_correcao_aleta: readNum(raw, "fin_correction_factor"),
    fator_atrito_ar: readNum(raw, "air_friction_factor"),
    razao_superficies_internas: readNum(raw, "internal_surface_ratio"),
    tubo_liso: readBool(raw, "smooth_tube") ?? (tubeType === 1 ? true : null),
    certificacao_ahri: readBool(raw, "ahri_certified"),
    certificacao_eurovent: readBool(raw, "eurovent_certified"),
  };
}

/** Carrega (e cacheia) o catálogo completo de geometrias. */
export async function loadCoilGeometries(): Promise<CoilGeometryItem[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(CATALOG_URL, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(
        `Falha ao carregar coilGeometries.json (HTTP ${res.status}).`,
      );
    }
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error("Conteúdo inválido em coilGeometries.json: esperado array.");
    }
    const items = (raw as RawGeometryEntry[]).map(enrich);
    cache = items;
    return items;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Retorna a geometria pelo seu id (síncrono — exige catálogo já carregado). */
export function getCoilGeometryById(
  items: CoilGeometryItem[],
  id: string | undefined,
): CoilGeometryItem | undefined {
  if (!id) return undefined;
  return items.find((g) => g.id === id);
}

/**
 * Filtra geometrias por texto livre (id/descrição/código) e por tipo de serpentina.
 * Passe `tipo === undefined` para não filtrar por tipo.
 */
export function filterCoilGeometries(
  items: CoilGeometryItem[],
  search: string,
  tipo_serpentina?: TipoSerpentina,
): CoilGeometryItem[] {
  const q = search.trim().toLowerCase();
  return items.filter((g) => {
    if (tipo_serpentina && g.tipo_serpentina !== tipo_serpentina) return false;
    if (!q) return true;
    return (
      g.id.toLowerCase().includes(q) ||
      g.descricao.toLowerCase().includes(q) ||
      g.codigo.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q)
    );
  });
}

/** Lista os campos físicos que estão `null` na geometria (para diagnóstico). */
export function listMissingPhysicalFields(g: CoilGeometryItem): string[] {
  const checks: Array<[string, unknown]> = [
    ["passo_fileiras_mm", g.passo_fileiras_mm],
    ["passo_tubos_mm", g.passo_tubos_mm],
    ["diametro_externo_tubo_mm", g.diametro_externo_tubo_mm],
    ["diametro_interno_tubo_mm", g.diametro_interno_tubo_mm],
    ["espessura_tubo_mm", g.espessura_tubo_mm],
    ["espessura_aleta_mm", g.espessura_aleta_mm],
    ["forma_aleta", g.forma_aleta],
    ["tipo_bateria", g.tipo_bateria],
    ["fator_correcao_aleta", g.fator_correcao_aleta],
    ["fator_atrito_ar", g.fator_atrito_ar],
    ["razao_superficies_internas", g.razao_superficies_internas],
    ["tubo_liso", g.tubo_liso],
    ["certificacao_ahri", g.certificacao_ahri],
    ["certificacao_eurovent", g.certificacao_eurovent],
  ];
  return checks.filter(([, v]) => v === null || v === undefined).map(([k]) => k);
}
