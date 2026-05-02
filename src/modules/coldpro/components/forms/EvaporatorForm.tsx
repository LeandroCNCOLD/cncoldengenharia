// Helper para gerar um ProgressiveCoilInput mínimo a partir das condições
// já informadas pelo usuário. O detalhamento completo da serpentina será
// disponibilizado no modo Profissional em prompts futuros.
import type { ProgressiveCoilInput, CompressorSpec } from "@/modules/coldpro_v2";
import type { SystemConditions } from "./SystemConditionsForm";

export function buildMinimalEvaporatorInput(
  compressor: Partial<CompressorSpec>,
  conditions: Partial<SystemConditions>,
): ProgressiveCoilInput {
  const airflow = conditions.required_airflow_m3_h ?? 0;
  return {
    tube_outer_diameter_mm: 12,
    tube_inner_diameter_mm: 10,
    tube_pitch_transverse_mm: 30,
    tube_pitch_longitudinal_mm: 26,
    fin_height_mm: 300,
    fin_thickness_mm: 0.12,
    coil_width_m: 0.6,
    coil_height_m: 0.3,
    tube_material: "copper",
    fin_material: "aluminum",
    rolls: [{ fin_spacing_mm: 7, rows_in_roll: 2 }],
    air_temperature_in_c: conditions.ambient_temp_c ?? 25,
    air_relative_humidity_in: 0.8,
    air_mass_flow_kg_s: (airflow * 1.2) / 3600,
    T_evaporating_c: compressor.evap_temp_c ?? -10,
    refrigerant: compressor.refrigerant,
  };
}
