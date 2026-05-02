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
import { computeBlockCompleteness } from "../services/blockCompletenessService";

export interface SelectedCatalogComponents {
  compressor?: CatalogEquipmentRow;
  condenser?: CatalogEquipmentRow;
  evaporator?: CatalogEquipmentRow;
  reheat_coil?: CatalogEquipmentRow;
}

export interface CatalogPartialEnvelope {
  /** T_evap °C disponível mesmo quando o aletado do evaporador está incompleto. */
  evap_temp_c?: number;
  /** Vazão de ar do evaporador (m³/h) disponível mesmo sem geometria completa. */
  evap_airflow_m3_h?: number;
  /** T_cond °C disponível mesmo quando o aletado do condensador está incompleto. */
  cond_temp_c?: number;
  /** Vazão de ar do condensador (m³/h) disponível mesmo sem geometria completa. */
  cond_airflow_m3_h?: number;
}

export interface CatalogMotorComponents {
  compressor?: CompressorSpec;
  condenser?: CondenserSpec;
  evaporator?: { progressive_input: ProgressiveCoilInput };
  reheat_coil?: ReheatCoilSizingInput;
  evaporator_fan?: FanSpec;
  condenser_fan?: FanSpec;
  /** Dados básicos (T/vazão) levados quando o aletado correspondente está incompleto. */
  partial: CatalogPartialEnvelope;
  warnings: string[];
}

export function buildMotorComponentsFromCatalog(
  selected: SelectedCatalogComponents,
): CatalogMotorComponents {
  const result: CatalogMotorComponents = { warnings: [], partial: {} };

  if (selected.compressor) {
    const status = computeBlockCompleteness(selected.compressor);
    if (status.compressorCompleto) {
      try {
        result.compressor = catalogToCompressorSpec(selected.compressor);
        result.evaporator_fan = catalogToEvaporatorFanSpec(selected.compressor);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[CatalogAdapter] Compressor inválido:", msg);
        result.warnings.push(msg);
      }
    } else {
      result.warnings.push(
        `Compressor incompleto — não usado automaticamente. Faltam: ${status.byBlock.compressor.missing.join(", ")}.`,
      );
    }
  }

  if (selected.condenser) {
    const status = computeBlockCompleteness(selected.condenser);
    if (status.condensadorCompleto) {
      try {
        result.condenser = catalogToCondenserSpec(selected.condenser);
        result.condenser_fan = catalogToCondenserFanSpec(selected.condenser);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[CatalogAdapter] Condensador inválido:", msg);
        result.warnings.push(msg);
      }
    } else {
      // Bloco incompleto: leva apenas T/vazão disponíveis e avisa.
      if (selected.condenser.tempCondensacaoC !== undefined) {
        result.partial.cond_temp_c = selected.condenser.tempCondensacaoC;
      }
      if (selected.condenser.vazaoArCondensadorM3H !== undefined) {
        result.partial.cond_airflow_m3_h = selected.condenser.vazaoArCondensadorM3H;
      }
      result.warnings.push(
        `Condensador (aletado) incompleto — geometria não usada. Faltam: ${status.byBlock.condensador.missing.join(", ")}.`,
      );
    }
  }

  if (selected.evaporator) {
    const status = computeBlockCompleteness(selected.evaporator);
    if (status.evaporadorCompleto) {
      const ev = catalogToEvaporatorInput(selected.evaporator);
      if (ev.input) {
        result.evaporator = { progressive_input: ev.input };
      }
      result.warnings.push(...ev.warnings);
    } else {
      // Bloco incompleto: leva apenas T_evap e vazão disponíveis e avisa.
      if (selected.evaporator.tempEvaporacaoC !== undefined) {
        result.partial.evap_temp_c = selected.evaporator.tempEvaporacaoC;
      }
      if (selected.evaporator.vazaoArEvaporadorM3H !== undefined) {
        result.partial.evap_airflow_m3_h = selected.evaporator.vazaoArEvaporadorM3H;
      }
      result.warnings.push(
        `Evaporador (aletado) incompleto — geometria não usada. Faltam: ${status.byBlock.evaporador.missing.join(", ")}.`,
      );
    }
  }

  if (selected.reheat_coil) {
    const status = computeBlockCompleteness(selected.reheat_coil);
    if (status.reheatCompleto) {
      const rh = catalogToReheatCoilInput(selected.reheat_coil);
      if (rh.input) {
        result.reheat_coil = rh.input;
      }
      result.warnings.push(...rh.warnings);
    } else {
      result.warnings.push(
        `Reaquecimento (aletado) incompleto — não usado. Faltam: ${status.byBlock.reheat.missing.join(", ")}.`,
      );
    }
  }

  return result;
}

