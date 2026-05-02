import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { ProgressiveCoilInput, RollGeometry } from "@/modules/coldpro_v2";

export interface EvaporatorAdapterResult {
  input: ProgressiveCoilInput | null;
  warnings: string[];
}

const REQUIRED_FIELDS = [
  "evaporadorRows",
  "evaporadorFinSpacingMm",
  "evaporadorTuboDiametroMm",
  "evaporadorTubeInnerDiameterMm",
  "evaporadorTubePitchTransverseMm",
  "evaporadorTubePitchLongitudinalMm",
  "evaporadorFinHeightMm",
  "evaporadorFinThicknessMm",
  "evaporadorCoilWidthM",
  "evaporadorCoilHeightM",
  "evaporadorAirTemperatureInC",
  "evaporadorAirRelativeHumidityIn",
  "evaporadorAirMassFlowKgS",
  "tempEvaporacaoC",
] as const;

/**
 * Converte CatalogEquipmentRow em ProgressiveCoilInput.
 * Só converte quando TODOS os campos obrigatórios estão presentes.
 * Não inventa valores.
 */
export function catalogToEvaporatorInput(row: CatalogEquipmentRow): EvaporatorAdapterResult {
  const warnings: string[] = [];

  const missing = REQUIRED_FIELDS.filter((k) => {
    const v = row[k as keyof CatalogEquipmentRow];
    return v === undefined || v === null;
  });

  if (missing.length > 0) {
    warnings.push(
      `Evaporador sem geometria suficiente para ProgressiveCoilInput (faltam: ${missing.join(", ")}).`,
    );
    return { input: null, warnings };
  }

  const rows = row.evaporadorRows!;
  const finSpacingMm = row.evaporadorFinSpacingMm!;

  // Sem distribuição por roll no catálogo: assume um único roll com todas as fileiras.
  const rolls: RollGeometry[] = [
    { fin_spacing_mm: finSpacingMm, rows_in_roll: rows },
  ];

  const input: ProgressiveCoilInput = {
    tube_outer_diameter_mm: row.evaporadorTuboDiametroMm!,
    tube_inner_diameter_mm: row.evaporadorTubeInnerDiameterMm!,
    tube_pitch_transverse_mm: row.evaporadorTubePitchTransverseMm!,
    tube_pitch_longitudinal_mm: row.evaporadorTubePitchLongitudinalMm!,
    fin_height_mm: row.evaporadorFinHeightMm!,
    fin_thickness_mm: row.evaporadorFinThicknessMm!,
    coil_width_m: row.evaporadorCoilWidthM!,
    coil_height_m: row.evaporadorCoilHeightM!,
    tube_material: row.evaporadorTubeMaterial ?? "copper",
    fin_material: row.evaporadorFinMaterial ?? "aluminum",
    rolls,
    air_temperature_in_c: row.evaporadorAirTemperatureInC!,
    air_relative_humidity_in: row.evaporadorAirRelativeHumidityIn!,
    air_mass_flow_kg_s: row.evaporadorAirMassFlowKgS!,
    T_evaporating_c: row.tempEvaporacaoC!,
    refrigerant: row.refrigerante === "unknown" ? undefined : row.refrigerante,
  };

  return { input, warnings };
}
