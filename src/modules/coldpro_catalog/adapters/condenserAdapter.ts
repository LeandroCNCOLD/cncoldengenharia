import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { CondenserSpec } from "@/modules/coldpro_v2";

const KCALH_TO_W = 1.163;

export function catalogToCondenserSpec(row: CatalogEquipmentRow): CondenserSpec {
  const rejectionKcalH =
    row.calorRejeitadoKcalH ?? row.capacidadeFrigorificaKcalH ?? row.capacidadeCompressorKcalH;

  if (!rejectionKcalH) {
    throw new Error(`Condensador sem calor rejeitado: ${row.id}`);
  }

  return {
    heat_rejection_capacity_w: rejectionKcalH * KCALH_TO_W,
    max_cond_temp_c: row.tempCondensacaoC ?? 55,
  } satisfies CondenserSpec;
}
