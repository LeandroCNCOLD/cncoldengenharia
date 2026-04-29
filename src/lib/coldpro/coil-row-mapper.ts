/**
 * Constrói um CoilSimulatorInput a partir de um registro do banco
 * (evaporator_coil_models / condenser_coil_models). Usado pelo painel
 * de calibração para rodar simulações sem repetir mapeamento.
 */
import type { CoilSimulatorInput } from "@/modules/coldpro/coil/coilSimulatorTypes";
import type { DatasheetPoint } from "@/modules/coldpro/coil/coilCalibration";

type Row = Record<string, unknown> & {
  nominal_capacity_w?: number | null;
  nominal_air_temp_in_c?: number | null;
  nominal_air_temp_out_c?: number | null;
  nominal_evap_temp_c?: number | null;
  nominal_cond_temp_c?: number | null;
  nominal_airflow_m3h?: number | null;
  refrigerant?: string | null;
  rows?: number | null;
  tubes_per_row?: number | null;
  circuits?: number | null;
  length_mm?: number | null;
  fin_pitch_mm?: number | null;
  tube_od_mm?: number | null;
  tube_id_mm?: number | null;
  tube_material?: string | null;
  fin_material?: string | null;
  fin_thickness_mm?: number | null;
  rh_in_pct?: number | null;
  air_pressure_drop_pa?: number | null;
  refrigerant_pressure_drop_kpa?: number | null;
  altitude_m?: number | null;
  atm_pressure_bar?: number | null;
};

function n(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

export function buildInputFromCoilRow(
  row: Row | null | undefined,
  coilType: "evaporator" | "condenser",
): CoilSimulatorInput | null {
  if (!row) return null;
  const refTempC =
    coilType === "evaporator" ? n(row.nominal_evap_temp_c) : n(row.nominal_cond_temp_c);
  return {
    mode: "verify",
    coilType,
    geometry: {
      tubesPerRow: n(row.tubes_per_row),
      rows: n(row.rows),
      circuits: n(row.circuits),
      coilLengthMm: n(row.length_mm),
      finPitchMm: n(row.fin_pitch_mm),
      tubeOdMm: n(row.tube_od_mm),
      tubeIdMm: n(row.tube_id_mm),
      finThicknessMm: n(row.fin_thickness_mm),
      tubeMaterial: (row.tube_material ?? undefined) as string | undefined,
      finMaterial: (row.fin_material ?? undefined) as string | undefined,
    },
    air: {
      airflowM3h: n(row.nominal_airflow_m3h),
      airTempInC: n(row.nominal_air_temp_in_c),
      airTempOutC: n(row.nominal_air_temp_out_c),
      rhInPct: n(row.rh_in_pct),
      altitudeM: n(row.altitude_m),
      atmPressureKpa: n(row.atm_pressure_bar) != null ? Number(row.atm_pressure_bar) * 100 : undefined,
      airPressureDropPa: n(row.air_pressure_drop_pa),
    },
    refrigerant: {
      refrigerant: (row.refrigerant ?? undefined) as string | undefined,
      refTempC,
      refrigerantPressureDropKpa: n(row.refrigerant_pressure_drop_kpa),
    },
    nominal:
      n(row.nominal_capacity_w) != null && n(row.nominal_air_temp_in_c) != null && refTempC != null
        ? {
            capacityW: Number(row.nominal_capacity_w),
            airTempInC: Number(row.nominal_air_temp_in_c),
            refTempC,
            airflowM3h: n(row.nominal_airflow_m3h) ?? 0,
          }
        : undefined,
  };
}

export function buildDatasheetFromCoilRow(
  row: Row | null | undefined,
  coilType: "evaporator" | "condenser",
): DatasheetPoint | null {
  if (!row) return null;
  const cap = n(row.nominal_capacity_w);
  if (cap == null) return null;
  return {
    capacityW: cap,
    airInletTempC: n(row.nominal_air_temp_in_c),
    airOutletTempC: n(row.nominal_air_temp_out_c),
    evaporationTempC: coilType === "evaporator" ? n(row.nominal_evap_temp_c) : undefined,
    condensationTempC: coilType === "condenser" ? n(row.nominal_cond_temp_c) : undefined,
    airflowM3h: n(row.nominal_airflow_m3h),
    airPressureDropPa: n(row.air_pressure_drop_pa) ?? null,
    refrigerantPressureDropKpa: n(row.refrigerant_pressure_drop_kpa) ?? null,
    refrigerant: (row.refrigerant ?? undefined) as string | undefined,
    coilType,
  };
}
