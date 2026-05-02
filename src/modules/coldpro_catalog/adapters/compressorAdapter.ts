import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { CompressorSpec } from "@/modules/coldpro_v2";

const KCALH_TO_W = 1.163;

export function catalogToCompressorSpec(row: CatalogEquipmentRow): CompressorSpec {
  const capacityKcalH = row.capacidadeCompressorKcalH ?? row.capacidadeFrigorificaKcalH;

  if (!capacityKcalH) {
    throw new Error(`Compressor sem capacidade frigorífica: ${row.id}`);
  }

  return {
    cooling_capacity_w: capacityKcalH * KCALH_TO_W,
    power_w: (row.potenciaCompressorKw ?? row.potenciaEletricaKw ?? 1.0) * 1000,
    refrigerant: row.refrigerante === "unknown" ? "R404A" : row.refrigerante,
    evap_temp_c: row.tempEvaporacaoC ?? -10,
    cond_temp_c: row.tempCondensacaoC ?? 40,
  } satisfies CompressorSpec;
}
