// ColdPro V2 — Serviço de Catálogo de Compressores (lazy loading)
// Total: 12251 modelos | Copeland: 11756 | Bitzer: 495
// NÃO modificar coldpro_v2/ | NÃO criar API REST

import type {
  CompressorCatalogRow,
  CompressorIndexRow,
  CompressorCatalogFilter,
  CompressorManufacturer,
} from './compressorCatalog.types';

// ─── Cache em memória ─────────────────────────────────────────────
let indexCache: CompressorIndexRow[] | null = null;
const detailCache: Map<string, CompressorCatalogRow> = new Map();
const manufacturerCache: Map<CompressorManufacturer, CompressorCatalogRow[]> = new Map();

// ─── Carregamento lazy ────────────────────────────────────────────

/** Carrega o índice leve (id, model, application, refrigerant, hp, capacity) */
export async function loadCompressorIndex(): Promise<CompressorIndexRow[]> {
  if (indexCache) return indexCache;
  const res = await fetch('/data/compressors/index.json');
  if (!res.ok) throw new Error(`Falha ao carregar índice de compressores: ${res.status}`);
  indexCache = await res.json() as CompressorIndexRow[];
  return indexCache;
}

/** Carrega todos os registros completos de um fabricante */
export async function loadManufacturerData(
  manufacturer: CompressorManufacturer
): Promise<CompressorCatalogRow[]> {
  if (manufacturerCache.has(manufacturer)) return manufacturerCache.get(manufacturer)!;
  const file = manufacturer.toLowerCase();
  const res = await fetch(`/data/compressors/${file}.json`);
  if (!res.ok) throw new Error(`Falha ao carregar dados de ${manufacturer}: ${res.status}`);
  const data = await res.json() as CompressorCatalogRow[];
  manufacturerCache.set(manufacturer, data);
  data.forEach(r => detailCache.set(r.id, r));
  return data;
}

/** Busca registro completo por ID (carrega fabricante se necessário) */
export async function getCompressorById(id: string): Promise<CompressorCatalogRow | null> {
  if (detailCache.has(id)) return detailCache.get(id)!;
  const manufacturer = id.startsWith('COPELAND_') ? 'Copeland'
    : id.startsWith('BITZER_') ? 'Bitzer'
    : null;
  if (!manufacturer) return null;
  const data = await loadManufacturerData(manufacturer as CompressorManufacturer);
  return data.find(r => r.id === id) ?? null;
}

/**
 * Carrega o spec completo de um compressor pelo id, expondo opcionalmente
 * os coeficientes polinomiais nativos BITZER quando disponíveis no catálogo.
 */
export async function loadCompressorSpec(id: string): Promise<
  | (CompressorCatalogRow & {
      bitzerNative?: {
        displacement_m3h: number;
        coeff_lambda: number[];
        coeff_current: number[];
        coeff_specific_power: number[];
        rpm: number;
      };
    })
  | null
> {
  const row = await getCompressorById(id);
  if (!row) return null;
  const raw = row as CompressorCatalogRow & {
    bitzer_native?: Record<string, unknown>;
    bitzerNative?: Record<string, unknown>;
  };
  const native = raw.bitzerNative ?? raw.bitzer_native;
  if (
    native &&
    Array.isArray(native.coeff_lambda) &&
    Array.isArray(native.coeff_current) &&
    Array.isArray(native.coeff_specific_power)
  ) {
    return {
      ...row,
      bitzerNative: {
        displacement_m3h: Number(native.displacement_m3h ?? row.nominal_displacement_cm3 ?? 0),
        coeff_lambda: (native.coeff_lambda as number[]).map(Number),
        coeff_current: (native.coeff_current as number[]).map(Number),
        coeff_specific_power: (native.coeff_specific_power as number[]).map(Number),
        rpm: Number(native.rpm ?? row.nominal_rpm ?? 0),
      },
    };
  }
  return row;
}

// ─── Filtros ──────────────────────────────────────────────────────

/** Filtra o índice leve (rápido, sem carregar dados completos) */
export async function filterCompressors(
  filter: CompressorCatalogFilter
): Promise<CompressorIndexRow[]> {
  const index = await loadCompressorIndex();
  return index.filter(r => {
    if (filter.manufacturer && r.manufacturer !== filter.manufacturer) return false;
    if (filter.application && r.application !== filter.application) return false;
    if (filter.refrigerant && !r.all_refrigerants.includes(filter.refrigerant)) return false;
    if (filter.frequencyHz && r.frequency_hz !== filter.frequencyHz) return false;
    if (filter.minCapacityW != null && (r.nominal_cooling_capacity_w ?? 0) < filter.minCapacityW) return false;
    if (filter.maxCapacityW != null && (r.nominal_cooling_capacity_w ?? Infinity) > filter.maxCapacityW) return false;
    if (filter.minHp != null && (r.nominal_hp ?? 0) < filter.minHp) return false;
    if (filter.maxHp != null && (r.nominal_hp ?? Infinity) > filter.maxHp) return false;
    if (filter.searchText) {
      const q = filter.searchText.toLowerCase();
      if (!r.model.toLowerCase().includes(q) && !r.manufacturer.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ─── Conversão para CompressorSpec do motor ───────────────────────

/**
 * Converte um CompressorCatalogRow para CompressorSpec do motor ColdPro V2.
 * Permite sobrescrever temperaturas de operação (ex: condições reais do projeto).
 */
export function toCompressorSpec(
  row: CompressorCatalogRow,
  overrides?: {
    evap_temp_c?: number;
    cond_temp_c?: number;
    refrigerant?: string;
  }
) {
  return {
    cooling_capacity_w: row.nominal_cooling_capacity_w ?? 0,
    power_w: row.nominal_power_w ?? 0,
    refrigerant: overrides?.refrigerant ?? row.refrigerant,
    evap_temp_c: overrides?.evap_temp_c ?? row.nominal_evap_temp_c ?? -10,
    cond_temp_c: overrides?.cond_temp_c ?? row.nominal_cond_temp_c ?? 40,
  };
}

// ─── Estatísticas do catálogo ─────────────────────────────────────

export async function getCompressorCatalogStats() {
  const index = await loadCompressorIndex();
  const byManufacturer = index.reduce((acc, r) => {
    acc[r.manufacturer] = (acc[r.manufacturer] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byApplication = index.reduce((acc, r) => {
    acc[r.application] = (acc[r.application] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byRefrigerant = index.reduce((acc, r) => {
    acc[r.refrigerant] = (acc[r.refrigerant] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return {
    total: index.length,
    byManufacturer,
    byApplication,
    byRefrigerant,
  };
}
