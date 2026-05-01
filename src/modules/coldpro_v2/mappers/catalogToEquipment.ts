import type { Equipment, HeatExchanger } from "../domain/types";
import { parseNullableNumber, normalizeString } from "../utils/number";
import { resolveField } from "../utils/fieldNormalizer";
import { FIELD_ALIASES } from "./fieldAliases";

function resolveNum(row: Record<string, unknown>, target: string): number | null {
  return parseNullableNumber(resolveField(row, target, FIELD_ALIASES));
}

function resolveStr(row: Record<string, unknown>, target: string): string {
  return normalizeString(resolveField(row, target, FIELD_ALIASES));
}

function hasAnyData(row: Record<string, unknown>, targets: string[]): boolean {
  return targets.some((t) => {
    const v = resolveField(row, t, FIELD_ALIASES);
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s !== "" && s !== "-";
  });
}

function buildEvaporator(row: Record<string, unknown>): HeatExchanger {
  return {
    id: "evap-main",
    type: "evaporator_dx",
    role: "main_evaporator",
    position: "main",
    sequence_order: 1,
    enabled: true,

    rows: resolveNum(row, "evaporador_numero_fileiras") ?? 0,
    tubes_per_row: resolveNum(row, "evaporador_tubos_por_fileira") ?? 0,
    circuits: resolveNum(row, "evaporador_numero_circuitos") ?? 0,
    fin_spacing_mm: resolveNum(row, "evaporador_espacamento_aletas_mm") ?? 0,
    length_mm: resolveNum(row, "evaporador_comprimento_mm") ?? 0,

    tube_diameter_mm: resolveNum(row, "evaporador_diametro_tubo_mm"),
    tube_thickness_mm: resolveNum(row, "evaporador_espessura_tubo_mm"),

    airflow_m3h: resolveNum(row, "evaporador_vazao_ventilador_m3h"),
    internal_volume_l: resolveNum(row, "evaporador_volume_interno_l"),
    exchange_area_m2: resolveNum(row, "evaporador_area_troca_m2"),
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

    rows: resolveNum(row, "condensador_numero_fileiras") ?? 0,
    tubes_per_row: resolveNum(row, "condensador_tubos_por_fileira") ?? 0,
    circuits: resolveNum(row, "condensador_numero_circuitos") ?? 0,
    fin_spacing_mm: resolveNum(row, "condensador_espacamento_aletas_mm") ?? 0,
    length_mm: resolveNum(row, "condensador_comprimento_mm") ?? 0,

    tube_diameter_mm: resolveNum(row, "condensador_diametro_tubo_mm"),
    tube_thickness_mm: resolveNum(row, "condensador_espessura_tubo_mm"),

    airflow_m3h: resolveNum(row, "condensador_vazao_ventilador_m3h"),
    internal_volume_l: resolveNum(row, "condensador_volume_interno_l"),
    exchange_area_m2: null,
  };
}

function buildReheat(row: Record<string, unknown>): HeatExchanger | null {
  const reheatFields = [
    "reaquecimento_tubos_por_fileira",
    "reaquecimento_numero_circuitos",
    "reaquecimento_espacamento_aletas_mm",
    "reaquecimento_comprimento_mm",
    "reaquecimento_numero_fileiras",
  ];

  if (!hasAnyData(row, reheatFields)) return null;

  return {
    id: "reheat-main",
    type: "reheat",
    role: "humidity_reheat",
    position: "after_evaporator",
    sequence_order: 3,
    enabled: true,

    rows: resolveNum(row, "reaquecimento_numero_fileiras") ?? 0,
    tubes_per_row: resolveNum(row, "reaquecimento_tubos_por_fileira") ?? 0,
    circuits: resolveNum(row, "reaquecimento_numero_circuitos") ?? 0,
    fin_spacing_mm: resolveNum(row, "reaquecimento_espacamento_aletas_mm") ?? 0,
    length_mm: resolveNum(row, "reaquecimento_comprimento_mm") ?? 0,

    tube_diameter_mm: null,
    tube_thickness_mm: null,

    airflow_m3h: resolveNum(row, "reaquecimento_vazao_ventilador_m3h"),
    internal_volume_l: null,
    exchange_area_m2: null,
  };
}

export function mapCatalogRowToEquipment(row: Record<string, unknown>): Equipment {
  const heat_exchangers: HeatExchanger[] = [buildEvaporator(row), buildCondenser(row)];

  const reheat = buildReheat(row);
  if (reheat) heat_exchangers.push(reheat);

  const refrigerantName = resolveStr(row, "refrigerante");
  const compressorCode = resolveStr(row, "compressor_codigo");

  return {
    id: resolveStr(row, "modelo_unico"),
    model_code: resolveStr(row, "modelo_unico"),
    model_name: resolveStr(row, "modelo"),
    line: resolveStr(row, "linha") || null,
    equipment_type: "complete_system",

    voltage: resolveNum(row, "tensao_v"),
    phases: resolveNum(row, "numero_fases"),
    frequency: resolveNum(row, "frequencia_hz"),

    refrigerant: refrigerantName
      ? {
          name: refrigerantName,
          gwp: null,
          charge_kg: null,
        }
      : null,

    compressor: compressorCode
      ? {
          model: compressorCode,
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
