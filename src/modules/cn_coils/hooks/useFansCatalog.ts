/**
 * DESATIVADO. O catálogo de ventiladores agora é estático
 * (src/modules/cn_coils/data/fanCatalog.ts). Mantemos as interfaces
 * para não quebrar importadores legados; o hook retorna lista vazia.
 */

export interface FanOperatingPoint {
  query_airflow_m3h: number | null;
  query_pressure_pa: number | null;
  airflow_m3h: number | null;
  static_pressure_pa: number | null;
  power_w: number | null;
  efficiency_pct: number | null;
  rpm: number | null;
  sfp_class: string | null;
  sfp_value: number | null;
  sound_db: string | null;
}

export interface FanCatalogRow {
  id: string;
  manufacturer: string;
  article_number: string | null;
  type_key: string;
  series: string | null;
  fan_genre: "axial" | "centrifugal" | null;
  design: string | null;
  size_mm: number | null;
  motor: string | null;
  motor_family: string | null;
  motor_power_w: number | null;
  voltage_v: number | null;
  phases: number | null;
  frequency_hz: number | null;
  electrical: string | null;
  rpm: number | null;
  airflow_m3h: number | null;
  static_pressure_pa: number | null;
  power_w: number | null;
  efficiency_pct: number | null;
  sfp_class: string | null;
  sfp_value: number | null;
  sound_db: string | null;
  operating_points: FanOperatingPoint[];
}

export function useFansCatalog() {
  return {
    data: [] as FanCatalogRow[],
    loading: false,
    error: null as string | null,
  };
}
