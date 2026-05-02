import { EQUIPMENT_CATALOG_RAW } from "./equipmentCatalog.raw";
import type { CatalogEquipmentRow } from "./equipmentCatalog.types";

export function getEquipmentCatalog(): CatalogEquipmentRow[] {
  return EQUIPMENT_CATALOG_RAW;
}

export function getEquipmentById(id: string): CatalogEquipmentRow | undefined {
  return EQUIPMENT_CATALOG_RAW.find((item) => item.id === id);
}

export function getEquipmentByModel(modeloUnico: string): CatalogEquipmentRow | undefined {
  return EQUIPMENT_CATALOG_RAW.find((item) => item.modeloUnico === modeloUnico);
}
