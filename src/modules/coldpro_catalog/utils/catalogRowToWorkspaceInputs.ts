import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

export interface WorkspaceEvaporatorInputs {
  geomHeight: number;
  geomWidth: number;
  geomDepth: number;
  finPitch: number;
  tubeDiam: number;
  circuits: number;
  rows: number;
  tubesPerRow: number;
  airFlow: number;
  airTempIn: number;
  airRH: number;
  refrigerantId: string;
  te: number;
  tc: number;
  superheat: number;
  subcooling: number;
}

export function catalogRowToEvaporatorInputs(
  row: CatalogEquipmentRow,
): Partial<WorkspaceEvaporatorInputs> {
  const inputs: Partial<WorkspaceEvaporatorInputs> = {};

  if (row.evaporadorFinHeightMm ?? row.evaporadorCoilHeightM) {
    inputs.geomHeight =
      row.evaporadorFinHeightMm ??
      Math.round((row.evaporadorCoilHeightM ?? 0.4) * 1000);
  }
  if (row.evaporadorLengthMm ?? row.evaporadorCoilWidthM) {
    inputs.geomWidth =
      row.evaporadorLengthMm ??
      Math.round((row.evaporadorCoilWidthM ?? 1.2) * 1000);
  }
  if (row.evaporadorCoilDepthM) {
    inputs.geomDepth = Math.round(row.evaporadorCoilDepthM * 1000);
  }
  if (row.evaporadorFinSpacingMm) inputs.finPitch = row.evaporadorFinSpacingMm;
  if (row.evaporadorTuboDiametroMm) inputs.tubeDiam = row.evaporadorTuboDiametroMm;
  if (row.evaporadorCircuitos) inputs.circuits = row.evaporadorCircuitos;
  if (row.evaporadorRows) inputs.rows = row.evaporadorRows;
  if (row.evaporadorTubesPorRow) inputs.tubesPerRow = row.evaporadorTubesPorRow;

  if (row.tempEvaporacaoC !== undefined) inputs.te = row.tempEvaporacaoC;
  if (row.tempCondensacaoC !== undefined) inputs.tc = row.tempCondensacaoC;
  if (row.superaquecimentoTotalK !== undefined) {
    inputs.superheat = row.superaquecimentoTotalK;
  }
  if (row.subresfriamentoK !== undefined) inputs.subcooling = row.subresfriamentoK;
  if (row.refrigerante && row.refrigerante !== "unknown") {
    inputs.refrigerantId = row.refrigerante;
  }

  if (row.evaporadorAirTemperatureInC !== undefined) {
    inputs.airTempIn = row.evaporadorAirTemperatureInC;
  } else if (row.tempCamaraC !== undefined) {
    inputs.airTempIn = row.tempCamaraC;
  }
  if (row.evaporadorAirRelativeHumidityIn !== undefined) {
    inputs.airRH = row.evaporadorAirRelativeHumidityIn * 100;
  } else if (row.umidadeCamaraPercent !== undefined) {
    inputs.airRH = row.umidadeCamaraPercent;
  }
  if (row.vazaoArEvaporadorM3H !== undefined) {
    inputs.airFlow = row.vazaoArEvaporadorM3H;
  } else if (row.evaporadorAirMassFlowKgS !== undefined) {
    inputs.airFlow = Math.round((row.evaporadorAirMassFlowKgS / 1.2) * 3600);
  }

  return inputs;
}
