import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { ProgressiveCoilInput, RollGeometry } from "@/modules/coldpro_v2";
import { computeBlockCompleteness } from "../services/blockCompletenessService";

export interface EvaporatorAdapterResult {
  input: ProgressiveCoilInput | null;
  warnings: string[];
}

/**
 * Converte CatalogEquipmentRow em ProgressiveCoilInput.
 * Só converte quando o bloco "evaporador" estiver 100% completo
 * (segundo computeBlockCompleteness). Não inventa valores.
 */
export function catalogToEvaporatorInput(row: CatalogEquipmentRow): EvaporatorAdapterResult {
  const warnings: string[] = [];
  const status = computeBlockCompleteness(row);

  if (!status.evaporadorCompleto) {
    warnings.push(
      `Evaporador (aletado) incompleto — campos faltantes: ${status.byBlock.evaporador.missing.join(", ")}.`,
    );
    return { input: null, warnings };
  }

  // Sem distribuição por roll no catálogo: assume um único roll com todas as fileiras.
  const rolls: RollGeometry[] = [
    {
      fin_spacing_mm: row.evaporadorFinSpacingMm!,
      rows_in_roll: row.evaporadorRows!,
    },
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
    tube_material: row.evaporadorTubeMaterial!,
    fin_material: row.evaporadorFinMaterial!,
    rolls,
    air_temperature_in_c: row.evaporadorAirTemperatureInC!,
    air_relative_humidity_in: row.evaporadorAirRelativeHumidityIn!,
    air_mass_flow_kg_s: row.evaporadorAirMassFlowKgS!,
    T_evaporating_c: row.tempEvaporacaoC!,
    refrigerant: row.refrigerante === "unknown" ? undefined : row.refrigerante,
  };

  return { input, warnings };
}
