import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

export type BlockKey =
  | "compressor"
  | "condensador"
  | "evaporador"
  | "reheat"
  | "eletrica";

export interface BlockDetail {
  complete: boolean;
  required: string[];
  missing: string[];
  optional?: string[];
  optionalMissing?: string[];
}

export interface CatalogCompleteness {
  compressorCompleto: boolean;
  condensadorCompleto: boolean;
  evaporadorCompleto: boolean;
  reheatCompleto: boolean;
  eletricaCompleta: boolean;
  /** True somente quando TODOS os blocos obrigatórios para simulação estiverem completos. */
  simulacaoCompleta: boolean;
  byBlock: Record<BlockKey, BlockDetail>;
}

const has = (v: unknown): boolean =>
  v !== undefined && v !== null && !(typeof v === "number" && Number.isNaN(v)) && v !== "";

function evalBlock(
  row: CatalogEquipmentRow,
  required: readonly (keyof CatalogEquipmentRow)[],
  optional: readonly (keyof CatalogEquipmentRow)[] = [],
): BlockDetail {
  const missing = required.filter((k) => !has(row[k])).map(String);
  const optionalMissing = optional.filter((k) => !has(row[k])).map(String);
  return {
    required: required.map(String),
    missing,
    optional: optional.length ? optional.map(String) : undefined,
    optionalMissing: optional.length ? optionalMissing : undefined,
    complete: missing.length === 0,
  };
}

// Campos mínimos por bloco — fonte única de verdade.
// Adapters NUNCA produzem input para o motor se estes campos não estiverem todos presentes.
export const COMPRESSOR_REQUIRED = [
  "compressorModelo",
  "refrigerante",
  "capacidadeCompressorKcalH",
  "potenciaCompressorKw",
  "tempEvaporacaoC",
  "tempCondensacaoC",
] as const satisfies readonly (keyof CatalogEquipmentRow)[];

export const ELETRICA_REQUIRED = [
  "tensaoV",
  "numeroFases",
  "frequenciaHz",
  "correnteA",
  "potenciaEletricaKw",
] as const satisfies readonly (keyof CatalogEquipmentRow)[];

export const CONDENSADOR_REQUIRED = [
  "calorRejeitadoKcalH",
  "vazaoArCondensadorM3H",
  "tempCondensacaoC",
  "tempAmbienteC",
  "condensadorRows",
  "condensadorTubesPorRow",
  "condensadorCircuitos",
  "condensadorTuboDiametroMm",
  "condensadorTuboDiametroInternoMm",
  "condensadorTubePitchTransverseMm",
  "condensadorTubePitchLongitudinalMm",
  "condensadorFinSpacingMm",
  "condensadorFinThicknessMm",
  "condensadorCoilWidthM",
  "condensadorCoilHeightM",
  "condensadorCoilDepthM",
  "condensadorTubeMaterial",
  "condensadorFinMaterial",
  "condensadorAreaFaceM2",
  "condensadorAreaTrocaM2",
  "condensadorVolumeInternoL",
] as const satisfies readonly (keyof CatalogEquipmentRow)[];

export const EVAPORADOR_REQUIRED = [
  "vazaoArEvaporadorM3H",
  "tempEvaporacaoC",
  "evaporadorRows",
  "evaporadorTubesPorRow",
  "evaporadorCircuitos",
  "evaporadorTuboDiametroMm",
  "evaporadorTubeInnerDiameterMm",
  "evaporadorTuboEspessuraMm",
  "evaporadorTubePitchTransverseMm",
  "evaporadorTubePitchLongitudinalMm",
  "evaporadorFinSpacingMm",
  "evaporadorFinThicknessMm",
  "evaporadorFinHeightMm",
  "evaporadorCoilWidthM",
  "evaporadorCoilHeightM",
  "evaporadorCoilDepthM",
  "evaporadorTubeMaterial",
  "evaporadorFinMaterial",
  "evaporadorAreaFaceM2",
  "evaporadorAreaTrocaM2",
  "evaporadorVolumeInternoL",
  "evaporadorAirTemperatureInC",
  "evaporadorAirRelativeHumidityIn",
  "evaporadorAirMassFlowKgS",
] as const satisfies readonly (keyof CatalogEquipmentRow)[];

export const REHEAT_REQUIRED = [
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
  "reheatTubeMaterial",
  "reheatFinMaterial",
] as const satisfies readonly (keyof CatalogEquipmentRow)[];

const REHEAT_OPTIONAL = [
  "reheatCoilWidthM",
  "reheatCoilHeightM",
  "reheatCoilDepthM",
  "reheatAreaFaceM2",
  "reheatAreaTrocaM2",
  "reheatVolumeInternoL",
] as const satisfies readonly (keyof CatalogEquipmentRow)[];

export function computeBlockCompleteness(row: CatalogEquipmentRow): CatalogCompleteness {
  const byBlock: Record<BlockKey, BlockDetail> = {
    compressor: evalBlock(row, COMPRESSOR_REQUIRED),
    eletrica: evalBlock(row, ELETRICA_REQUIRED),
    condensador: evalBlock(row, CONDENSADOR_REQUIRED),
    evaporador: evalBlock(row, EVAPORADOR_REQUIRED),
    reheat: evalBlock(row, REHEAT_REQUIRED, REHEAT_OPTIONAL),
  };

  // Reaquecimento é opcional para a simulação — entra apenas se completo.
  // Simulação completa requer compressor + condensador + evaporador + elétrica.
  const simulacaoCompleta =
    byBlock.compressor.complete &&
    byBlock.condensador.complete &&
    byBlock.evaporador.complete &&
    byBlock.eletrica.complete;

  return {
    compressorCompleto: byBlock.compressor.complete,
    condensadorCompleto: byBlock.condensador.complete,
    evaporadorCompleto: byBlock.evaporador.complete,
    reheatCompleto: byBlock.reheat.complete,
    eletricaCompleta: byBlock.eletrica.complete,
    simulacaoCompleta,
    byBlock,
  };
}

export const BLOCK_LABEL: Record<BlockKey, string> = {
  compressor: "Compressor",
  eletrica: "Elétrica",
  condensador: "Condensador (aletado)",
  evaporador: "Evaporador (aletado)",
  reheat: "Reaquecimento (aletado)",
};
