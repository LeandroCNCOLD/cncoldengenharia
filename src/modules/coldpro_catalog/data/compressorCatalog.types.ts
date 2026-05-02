// ColdPro V2 — Tipos do Catálogo de Compressores
// Gerado automaticamente — NÃO editar manualmente

export type CompressorApplication = 'LT' | 'MT' | 'HT';
export type CompressorManufacturer = 'Copeland' | 'Bitzer' | 'Danfoss' | 'Dorin';

/** Registro completo de um compressor no catálogo */
export interface CompressorCatalogRow {
  id: string;
  model: string;
  manufacturer: CompressorManufacturer;
  /** Refrigerante primário (mais comum para este modelo) */
  refrigerant: string;
  /** Todos os refrigerantes compatíveis com este modelo */
  all_refrigerants: string[];
  application: CompressorApplication;
  compressor_type?: string | null;
  series?: string | null;
  series_code?: string | null;
  voltage?: string | null;
  frequency_hz?: number;
  phase?: string;
  nominal_hp?: number | null;
  /** Capacidade frigorífica nominal em Watts */
  nominal_cooling_capacity_w: number | null;
  /** Potência elétrica nominal em Watts */
  nominal_power_w: number | null;
  /** Temperatura de evaporação das condições de referência (°C) */
  nominal_evap_temp_c?: number | null;
  /** Temperatura de condensação das condições de referência (°C) */
  nominal_cond_temp_c?: number | null;
  min_evap_temp_c?: number | null;
  max_evap_temp_c?: number | null;
  min_cond_temp_c?: number | null;
  max_cond_temp_c?: number | null;
  nominal_displacement_cm3?: number | null;
  nominal_rpm?: number | null;
  cylinders?: number | null;
}

/** Registro leve do índice (para busca e filtros rápidos) */
export interface CompressorIndexRow {
  id: string;
  model: string;
  manufacturer: CompressorManufacturer;
  application: CompressorApplication;
  refrigerant: string;
  all_refrigerants: string[];
  compressor_type?: string | null;
  nominal_hp?: number | null;
  nominal_cooling_capacity_w: number | null;
  nominal_power_w: number | null;
  frequency_hz?: number;
  voltage?: string | null;
}

/** Filtros para busca no catálogo */
export interface CompressorCatalogFilter {
  manufacturer?: CompressorManufacturer;
  application?: CompressorApplication;
  refrigerant?: string;
  minCapacityW?: number;
  maxCapacityW?: number;
  minHp?: number;
  maxHp?: number;
  frequencyHz?: number;
  searchText?: string;
}
