import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type {
  CompressorSpec,
  CondenserSpec,
  FanSpec,
  ProgressiveCoilInput,
  ReheatCoilSizingInput,
} from "@/modules/coldpro_v2";
import { catalogToCompressorSpec } from "./compressorAdapter";
import { catalogToCondenserSpec } from "./condenserAdapter";
import { catalogToEvaporatorFanSpec, catalogToCondenserFanSpec } from "./fanAdapter";
import { catalogToEvaporatorInput } from "./evaporatorAdapter";
import { catalogToReheatCoilInput } from "./reheatCoilCatalogAdapter";

export interface SelectedCatalogComponents {
  compressor?: CatalogEquipmentRow;
  condenser?: CatalogEquipmentRow;
  evaporator?: CatalogEquipmentRow;
  reheat_coil?: CatalogEquipmentRow;
}

export interface CatalogMotorComponents {
  compressor?: CompressorSpec;
  condenser?: CondenserSpec;
  evaporator?: { progressive_input: ProgressiveCoilInput };
  reheat_coil?: ReheatCoilSizingInput;
  evaporator_fan?: FanSpec;
  condenser_fan?: FanSpec;
  warnings: string[];
}

export function buildMotorComponentsFromCatalog(
  selected: SelectedCatalogComponents,
): CatalogMotorComponents {
  const result: CatalogMotorComponents = { warnings: [] };

  if (selected.compressor) {
    try {
      result.compressor = catalogToCompressorSpec(selected.compressor);
      result.evaporator_fan = catalogToEvaporatorFanSpec(selected.compressor);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[CatalogAdapter] Compressor inválido:", msg);
      result.warnings.push(msg);
    }
  }

  if (selected.condenser) {
    try {
      result.condenser = catalogToCondenserSpec(selected.condenser);
      result.condenser_fan = catalogToCondenserFanSpec(selected.condenser);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[CatalogAdapter] Condensador inválido:", msg);
      result.warnings.push(msg);
    }
  }

  if (selected.evaporator) {
    const ev = catalogToEvaporatorInput(selected.evaporator);
    if (ev.input) {
      result.evaporator = { progressive_input: ev.input };
    }
    result.warnings.push(...ev.warnings);
  }

  if (selected.reheat_coil) {
    const rh = catalogToReheatCoilInput(selected.reheat_coil);
    if (rh.input) {
      result.reheat_coil = rh.input;
    }
    result.warnings.push(...rh.warnings);
  }

  return result;
}
