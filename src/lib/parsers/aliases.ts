// CN Cold Engineering — Dicionário de aliases por tipo de componente.
// Mapeia variações comuns de cabeçalhos (PT/EN, abreviações) para o schema interno.
import type { ComponentType } from "@/lib/component-schema";

type AliasMap = Record<string, string[]>;

const COMMON: AliasMap = {
  modelo: ["modelo", "model", "model_name", "modelname", "pn", "part_number", "partnumber", "ref", "referencia"],
  fabricante: ["fabricante", "manufacturer", "marca", "brand", "make"],
  fluido: ["fluido", "fluid", "refrigerante", "refrigerant", "gas"],
  descricao: ["descricao", "descrição", "description", "desc", "modelo", "model"],
  capacidade_nominal: [
    "capacidade_nominal", "capacidade", "capacity", "nominal_capacity",
    "kw", "kw_nom", "potencia", "power",
  ],
  vazao_ar: ["vazao_ar", "vazão_ar", "air_flow", "airflow", "m3h", "m3_h", "vazao"],
  observacoes: ["observacoes", "observações", "notes", "obs", "remarks"],
  queda_pressao: ["queda_pressao", "queda_pressão", "pressure_drop", "dp", "delta_p"],
};

const COMPRESSOR_ALIASES: AliasMap = {
  ...COMMON,
  coeficientes: ["coeficientes", "coefficients", "ahri540", "ahri_540", "coef"],
  faixa_operacional: [
    "faixa_operacional", "operating_range", "envelope", "operating_envelope",
    "te_min", "te_max", "tc_min", "tc_max",
  ],
};

const EVAP_ALIASES: AliasMap = {
  ...COMMON,
  temp_evaporacao_ref: [
    "temp_evaporacao_ref", "temp_evap", "te_ref", "evaporating_temp", "te",
    "saturated_evap_temp",
  ],
  temp_entrada_ar: [
    "temp_entrada_ar", "air_in_temp", "ti_ar", "tin", "entering_air_temp", "tair_in",
  ],
  geometria_minima: ["geometria_minima", "geometry", "geom", "fin_spacing", "rows"],
};

const COND_ALIASES: AliasMap = {
  ...COMMON,
  temp_condensacao_ref: [
    "temp_condensacao_ref", "temp_cond", "tc_ref", "condensing_temp", "tc",
    "saturated_cond_temp",
  ],
  temp_entrada_ar: [
    "temp_entrada_ar", "air_in_temp", "ti_ar", "tin", "entering_air_temp", "tair_in",
  ],
  geometria_minima: ["geometria_minima", "geometry", "geom", "fin_spacing", "rows"],
};

export const ALIASES_BY_TYPE: Record<ComponentType, AliasMap> = {
  compressor: COMPRESSOR_ALIASES,
  evaporador: EVAP_ALIASES,
  condensador: COND_ALIASES,
};

/** Normaliza uma string para comparação: minúscula, sem acentos, sem pontuação. */
export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Dada uma chave bruta (header), tenta resolver para uma chave interna do schema. */
export function resolveFieldKey(
  type: ComponentType,
  rawHeader: string,
): string | null {
  const norm = normalizeKey(rawHeader);
  const map = ALIASES_BY_TYPE[type];
  for (const internalKey of Object.keys(map)) {
    if (map[internalKey].some((alias) => normalizeKey(alias) === norm)) {
      return internalKey;
    }
  }
  return null;
}
