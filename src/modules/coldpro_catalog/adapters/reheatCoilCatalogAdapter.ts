import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { ReheatCoilSizingInput } from "@/modules/coldpro_v2";

export interface ReheatAdapterResult {
  input: ReheatCoilSizingInput | null;
  warnings: string[];
}

const REQUIRED_FIELDS = [
  "reheatQTargetW",
  "reheatTAirInC",
  "reheatTAirOutC",
  "reheatAirMassFlowKgS",
  "reheatTCondensingC",
  "reheatTHotGasInC",
  "reheatTubeOuterDiameterM",
  "reheatTubeThicknessM",
  "reheatFinSpacingM",
  "reheatFinThicknessM",
  "reheatTubePitchTransversalM",
  "reheatTubePitchLongitudinalM",
  "reheatCoilLengthM",
  "reheatCircuits",
] as const;

/**
 * Converte CatalogEquipmentRow em ReheatCoilSizingInput.
 * Só converte quando TODOS os campos obrigatórios estão presentes.
 * Não inventa valores.
 */
export function catalogToReheatCoilInput(row: CatalogEquipmentRow): ReheatAdapterResult {
  const warnings: string[] = [];

  const missing = REQUIRED_FIELDS.filter((k) => {
    const v = row[k as keyof CatalogEquipmentRow];
    return v === undefined || v === null;
  });

  if (missing.length > 0) {
    warnings.push(
      `Reaquecimento sem dados suficientes para ReheatCoilSizingInput (faltam: ${missing.join(", ")}).`,
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
