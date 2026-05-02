type CompressorCatalogRow = {
  capacity_w?: number;
  power_w?: number;
  refrigerant?: string;
  te?: number;
  tc?: number;
};

export type CompressorSpec = {
  cooling_capacity_w: number;
  power_w: number;
  refrigerant: string | undefined;
  evap_temp_c: number;
  cond_temp_c: number;
};

export function toCompressorSpec(row: CompressorCatalogRow): CompressorSpec {
  return {
    cooling_capacity_w: row.capacity_w ?? 0,
    power_w: row.power_w ?? 0,
    refrigerant: row.refrigerant,
    evap_temp_c: row.te ?? -10,
    cond_temp_c: row.tc ?? 40,
  };
}
