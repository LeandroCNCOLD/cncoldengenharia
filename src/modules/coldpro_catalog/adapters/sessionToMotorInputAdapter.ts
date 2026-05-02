import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { CompressorSpec, CondenserSpec, FanSpec } from "@/modules/coldpro_v2";
import { catalogToCompressorSpec } from "./compressorAdapter";
import { catalogToCondenserSpec } from "./condenserAdapter";
import { catalogToEvaporatorFanSpec, catalogToCondenserFanSpec } from "./fanAdapter";

export interface SelectedCatalogComponents {
  compressor?: CatalogEquipmentRow;
  condenser?: CatalogEquipmentRow;
}

export interface CatalogMotorComponents {
  compressor?: CompressorSpec;
  condenser?: CondenserSpec;
  evaporator_fan?: FanSpec;
  condenser_fan?: FanSpec;
}

export function buildMotorComponentsFromCatalog(
  selected: SelectedCatalogComponents,
): CatalogMotorComponents {
  const result: CatalogMotorComponents = {};

  if (selected.compressor) {
    try {
      result.compressor = catalogToCompressorSpec(selected.compressor);
      result.evaporator_fan = catalogToEvaporatorFanSpec(selected.compressor);
    } catch (e) {
      console.warn("[CatalogAdapter] Compressor inválido:", e);
    }
  }

  if (selected.condenser) {
    try {
      result.condenser = catalogToCondenserSpec(selected.condenser);
      result.condenser_fan = catalogToCondenserFanSpec(selected.condenser);
    } catch (e) {
      console.warn("[CatalogAdapter] Condensador inválido:", e);
    }
  }

  return result;
}
