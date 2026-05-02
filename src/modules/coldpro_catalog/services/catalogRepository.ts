import {
  getEquipmentCatalog,
  getEquipmentById,
  getEquipmentByModel,
} from "../data/equipmentCatalog.index";
import type { CatalogEquipmentRow, EquipmentFamily } from "../data/equipmentCatalog.types";

export const catalogRepository = {
  list(): CatalogEquipmentRow[] {
    return getEquipmentCatalog();
  },
  getById(id: string): CatalogEquipmentRow | undefined {
    return getEquipmentById(id);
  },
  getByModel(modeloUnico: string): CatalogEquipmentRow | undefined {
    return getEquipmentByModel(modeloUnico);
  },
  listByFamily(family: EquipmentFamily): CatalogEquipmentRow[] {
    return getEquipmentCatalog().filter((item) => item.family === family);
  },
};
