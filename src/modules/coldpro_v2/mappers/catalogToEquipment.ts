import type { Equipment, HeatExchanger } from "../domain/types";
import { parseNullableNumber, normalizeString, isFilled } from "../utils/number";

function buildEvaporator(row: Record<string, unknown>): HeatExchanger {
  return {
    id: "evap-main",
    type: "evaporator_dx",
    role: "main_evaporator",
    position: "main",
    sequence_order: 1,
    enabled: true,

    rows: parseNullableNumber(row["evap_rows"]) ?? 0,
    tubes_per_row: parseNullableNumber(row["evap_tubes_per_row"]) ?? 0,
    circuits: parseNullableNumber(row["evap_circuits"]) ?? 0,
    fin_spacing_mm: parseNullableNumber(row["evap_fin_spacing_mm"]) ?? 0,
    length_mm: parseNullableNumber(row["evap_length_mm"]) ?? 0,

    tube_diameter_mm: parseNullableNumber(row["tubo_evap_mm"]),
    tube_thickness_mm: parseNullableNumber(row["esp_tubo_evap_mm"]),

    airflow_m3h: parseNullableNumber(row["vazao_ventilador_evaporador_m3h"]),
    internal_volume_l: parseNullableNumber(row["volume_interno_evaporador_l"]),
    exchange_area_m2: parseNullableNumber(row["area_superficie_troca_evaporador_m2"]),
  };
}

function buildCondenser(row: Record<string, unknown>): HeatExchanger {
  return {
    id: "cond-main",
    type: "condenser",
    role: "main_condenser",
    position: "external",
    sequence_order: 2,
    enabled: true,

    rows: parseNullableNumber(row["cond_rows"]) ?? 0,
    tubes_per_row: parseNullableNumber(row["cond_tubes_per_row"]) ?? 0,
    circuits: parseNullableNumber(row["cond_circuits"]) ?? 0,
    fin_spacing_mm: parseNullableNumber(row["cond_fin_spacing_mm"]) ?? 0,
    length_mm: parseNullableNumber(row["cond_length_mm"]) ?? 0,

    tube_diameter_mm: parseNullableNumber(row["tubo_cond_mm"]),
    tube_thickness_mm: parseNullableNumber(row["esp_tubo_cond_mm"]),

    airflow_m3h: parseNullableNumber(row["vazao_ventilador_condensador_m3h"]),
    internal_volume_l: parseNullableNumber(row["volume_interno_condensador_l"]),
    exchange_area_m2: null,
  };
}

function buildReheat(row: Record<string, unknown>): HeatExchanger | null {
  const hasData =
    isFilled(row["reaq_tubes_per_row"]) ||
    isFilled(row["reaq_circuits"]) ||
    isFilled(row["reaq_fin_spacing_mm"]) ||
    isFilled(row["reaq_length_mm"]) ||
    isFilled(row["geometria_reaquecimento"]);

  if (!hasData) return null;

  return {
    id: "reheat-main",
    type: "reheat",
    role: "humidity_reheat",
    position: "after_evaporator",
    sequence_order: 3,
    enabled: true,

    rows: parseNullableNumber(row["geometria_reaquecimento"]) ?? 0,
    tubes_per_row: parseNullableNumber(row["reaq_tubes_per_row"]) ?? 0,
    circuits: parseNullableNumber(row["reaq_circuits"]) ?? 0,
    fin_spacing_mm: parseNullableNumber(row["reaq_fin_spacing_mm"]) ?? 0,
    length_mm: parseNullableNumber(row["reaq_length_mm"]) ?? 0,

    tube_diameter_mm: null,
    tube_thickness_mm: null,

    airflow_m3h: parseNullableNumber(row["ventilador_reaquecimento"]),
    internal_volume_l: null,
    exchange_area_m2: null,
  };
}

export function mapCatalogRowToEquipment(row: Record<string, unknown>): Equipment {
  const heat_exchangers: HeatExchanger[] = [buildEvaporator(row), buildCondenser(row)];

  const reheat = buildReheat(row);
  if (reheat) heat_exchangers.push(reheat);

  return {
    id: normalizeString(row["modelo_unico"]),
    model_code: normalizeString(row["modelo_unico"]),
    model_name: normalizeString(row["modelo"]),
    line: normalizeString(row["linha"]) || null,

    voltage: parseNullableNumber(row["tensao_v"]),
    phases: parseNullableNumber(row["numero_fases"]),
    frequency: parseNullableNumber(row["frequencia_hz"]),

    refrigerant: normalizeString(row["refrigerante"])
      ? {
          name: normalizeString(row["refrigerante"]),
          gwp: null,
          charge_kg: null,
        }
      : null,

    compressor: normalizeString(row["compressor_codigo"])
      ? {
          model: normalizeString(row["compressor_codigo"]),
          brand: null,
          type: null,
          capacity_w: null,
          power_w: null,
          quantity: 1,
        }
      : null,

    fans: [],
    expansion_valve: null,
    heat_exchangers,
    performance_points: [],
    metadata: {},
  };
}
