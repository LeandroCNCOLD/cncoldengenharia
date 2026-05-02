import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { ReheatCoilSizingInput } from "@/modules/coldpro_v2";
import { computeBlockCompleteness } from "../services/blockCompletenessService";

export interface ReheatAdapterResult {
  input: ReheatCoilSizingInput | null;
  warnings: string[];
}

/**
 * Converte CatalogEquipmentRow em ReheatCoilSizingInput.
 * Só converte quando o bloco "reheat" estiver 100% completo
 * (segundo computeBlockCompleteness). Não inventa valores.
 */
export function catalogToReheatCoilInput(row: CatalogEquipmentRow): ReheatAdapterResult {
  const warnings: string[] = [];
  const status = computeBlockCompleteness(row);

  if (!status.reheatCompleto) {
    warnings.push(
      `Reaquecimento (aletado) incompleto — campos faltantes: ${status.byBlock.reheat.missing.join(", ")}.`,
    );
    return { input: null, warnings };
  }

  const input: ReheatCoilSizingInput = {
    Q_reheat_target_w: row.reheatQTargetW!,
    T_air_in_c: row.reheatTAirInC!,
    T_air_out_c: row.reheatTAirOutC!,
    air_mass_flow_kg_s: row.reheatAirMassFlowKgS!,
    T_condensing_c: row.reheatTCondensingC!,
    T_hot_gas_in_c: row.reheatTHotGasInC!,
    refrigerant: row.refrigerante === "unknown" ? undefined : row.refrigerante,
    tube_outer_diameter_m: row.reheatTubeOuterDiameterM!,
    tube_thickness_m: row.reheatTubeThicknessM!,
    fin_spacing_m: row.reheatFinSpacingM!,
    fin_thickness_m: row.reheatFinThicknessM!,
    tube_pitch_transversal_m: row.reheatTubePitchTransversalM!,
    tube_pitch_longitudinal_m: row.reheatTubePitchLongitudinalM!,
    coil_length_m: row.reheatCoilLengthM!,
    circuits: row.reheatCircuits!,
  };

  return { input, warnings };
}
