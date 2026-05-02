import type { CatalogEquipmentRow, CatalogFilter } from "../data/equipmentCatalog.types";

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filterCatalog(
  rows: CatalogEquipmentRow[],
  filter: CatalogFilter,
): CatalogEquipmentRow[] {
  return rows.filter((item) => {
    if (filter.search) {
      const search = normalize(filter.search);
      const searchable = normalize(
        [
          item.modelo,
          item.modeloUnico,
          item.modeloBaseReferencia,
          item.fabricante,
          item.compressorModelo,
          item.compressorCodigo,
          item.linha,
          item.designacaoHp,
          item.refrigerante,
        ].join(" "),
      );
      if (!searchable.includes(search)) return false;
    }

    if (filter.family && filter.family !== "all" && item.family !== filter.family) return false;
    if (filter.refrigerant && filter.refrigerant !== "all" && item.refrigerante !== filter.refrigerant)
      return false;
    if (filter.application && filter.application !== "all" && item.application !== filter.application)
      return false;
    if (filter.voltage && filter.voltage !== "all" && item.tensaoV !== filter.voltage) return false;
    if (filter.phases && filter.phases !== "all" && item.numeroFases !== filter.phases) return false;

    const capacity = item.capacidadeFrigorificaKcalH ?? item.capacidadeCompressorKcalH;
    if (
      typeof filter.minCapacityKcalH === "number" &&
      typeof capacity === "number" &&
      capacity < filter.minCapacityKcalH
    )
      return false;
    if (
      typeof filter.maxCapacityKcalH === "number" &&
      typeof capacity === "number" &&
      capacity > filter.maxCapacityKcalH
    )
      return false;

    return true;
  });
}
