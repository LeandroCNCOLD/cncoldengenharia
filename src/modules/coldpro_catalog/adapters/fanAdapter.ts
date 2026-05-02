import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { FanSpec } from "@/modules/coldpro_v2";

export function catalogToEvaporatorFanSpec(row: CatalogEquipmentRow): FanSpec | undefined {
  if (!row.vazaoArEvaporadorM3H) return undefined;
  return {
    airflow_m3_h: row.vazaoArEvaporadorM3H,
    available_static_pressure_pa: 30,
  } satisfies FanSpec;
}

export function catalogToCondenserFanSpec(row: CatalogEquipmentRow): FanSpec | undefined {
  if (!row.vazaoArCondensadorM3H) return undefined;
  return {
    airflow_m3_h: row.vazaoArCondensadorM3H,
    available_static_pressure_pa: 20,
  } satisfies FanSpec;
}
