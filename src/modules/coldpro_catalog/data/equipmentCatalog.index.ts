import { EQUIPMENT_CATALOG_RAW } from "./equipmentCatalog.raw";
import type { CatalogEquipmentRow } from "./equipmentCatalog.types";

const AIR_DENSITY_KG_M3 = 1.2;
const DEFAULT_FIN_THICKNESS_MM = 0.12;

function parseGeometryMm(value?: string): [number, number] | undefined {
  if (!value) return undefined;
  const parts = value
    .replace(/,/g, ".")
    .split(/[xX×]/)
    .map((part) => Number.parseFloat(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length >= 2 ? [parts[0]!, parts[1]!] : undefined;
}

function setIfMissing<T extends keyof CatalogEquipmentRow>(
  row: CatalogEquipmentRow,
  key: T,
  value: CatalogEquipmentRow[T] | undefined,
) {
  if (row[key] === undefined && value !== undefined) row[key] = value;
}

function tubeInnerDiameterMm(outerMm?: number, wallMm?: number): number | undefined {
  if (!outerMm || !wallMm) return undefined;
  const inner = outerMm - 2 * wallMm;
  return inner > 0 ? inner : undefined;
}

function airMassFlowKgS(airflowM3H?: number): number | undefined {
  if (!airflowM3H) return undefined;
  return (airflowM3H / 3600) * AIR_DENSITY_KG_M3;
}

function enrichCoilMetrics(row: CatalogEquipmentRow) {
  const condPitch = parseGeometryMm(row.condensadorGeometria);
  const evapPitch = parseGeometryMm(row.evaporadorGeometria);
  const reheatPitch = parseGeometryMm(row.reheatGeometria);

  setIfMissing(row, "condensadorTubePitchTransverseMm", condPitch?.[0]);
  setIfMissing(row, "condensadorTubePitchLongitudinalMm", condPitch?.[1]);
  setIfMissing(row, "evaporadorTubePitchTransverseMm", evapPitch?.[0]);
  setIfMissing(row, "evaporadorTubePitchLongitudinalMm", evapPitch?.[1]);
  setIfMissing(row, "condensadorTuboDiametroInternoMm", tubeInnerDiameterMm(row.condensadorTuboDiametroMm, row.condensadorTuboEspessuraMm));
  setIfMissing(row, "evaporadorTubeInnerDiameterMm", tubeInnerDiameterMm(row.evaporadorTuboDiametroMm, row.evaporadorTuboEspessuraMm));

  setIfMissing(row, "reheatTubeOuterDiameterM", row.evaporadorTuboDiametroMm ? row.evaporadorTuboDiametroMm / 1000 : undefined);
  setIfMissing(row, "reheatTubeThicknessM", row.evaporadorTuboEspessuraMm ? row.evaporadorTuboEspessuraMm / 1000 : undefined);
  setIfMissing(row, "reheatFinSpacingM", row.reheatFinSpacingMm ? row.reheatFinSpacingMm / 1000 : undefined);
  setIfMissing(row, "reheatTubePitchTransversalM", reheatPitch?.[0] ? reheatPitch[0] / 1000 : undefined);
  setIfMissing(row, "reheatTubePitchLongitudinalM", reheatPitch?.[1] ? reheatPitch[1] / 1000 : undefined);
  setIfMissing(row, "reheatCoilLengthM", row.reheatCoilLengthMm ? row.reheatCoilLengthMm / 1000 : undefined);

  setIfMissing(row, "evaporadorAirTemperatureInC", row.tempCamaraC);
  setIfMissing(row, "evaporadorAirRelativeHumidityIn", row.umidadeCamaraPercent !== undefined ? row.umidadeCamaraPercent / 100 : undefined);
  setIfMissing(row, "evaporadorAirMassFlowKgS", airMassFlowKgS(row.vazaoArEvaporadorM3H));

  setIfMissing(row, "condensadorFinThicknessMm", DEFAULT_FIN_THICKNESS_MM);
  setIfMissing(row, "evaporadorFinThicknessMm", DEFAULT_FIN_THICKNESS_MM);
  setIfMissing(row, "reheatFinThicknessM", DEFAULT_FIN_THICKNESS_MM / 1000);
  setIfMissing(row, "condensadorTubeMaterial", "copper");
  setIfMissing(row, "evaporadorTubeMaterial", "copper");
  setIfMissing(row, "reheatTubeMaterial", "copper");
  setIfMissing(row, "condensadorFinMaterial", "aluminum");
  setIfMissing(row, "evaporadorFinMaterial", "aluminum");
  setIfMissing(row, "reheatFinMaterial", "aluminum");
}

function enrichSizedCoil(
  row: CatalogEquipmentRow,
  prefix: "condensador" | "evaporador" | "reheat",
) {
  const isCond = prefix === "condensador";
  const isEvap = prefix === "evaporador";
  const rows = isCond ? row.condensadorRows : isEvap ? row.evaporadorRows : row.reheatRows;
  const tubesPerRow = isCond ? row.condensadorTubesPorRow : isEvap ? row.evaporadorTubesPorRow : row.reheatTubesPerRow;
  const lengthMm = isCond ? row.condensadorLengthMm : isEvap ? row.evaporadorLengthMm : row.reheatCoilLengthMm;
  const outerMm = isCond ? row.condensadorTuboDiametroMm : isEvap ? row.evaporadorTuboDiametroMm : row.evaporadorTuboDiametroMm;
  const innerMm = isCond ? row.condensadorTuboDiametroInternoMm : isEvap ? row.evaporadorTubeInnerDiameterMm : tubeInnerDiameterMm(row.evaporadorTuboDiametroMm, row.evaporadorTuboEspessuraMm);
  const pitchT = isCond ? row.condensadorTubePitchTransverseMm : isEvap ? row.evaporadorTubePitchTransverseMm : parseGeometryMm(row.reheatGeometria)?.[0];
  const pitchL = isCond ? row.condensadorTubePitchLongitudinalMm : isEvap ? row.evaporadorTubePitchLongitudinalMm : parseGeometryMm(row.reheatGeometria)?.[1];
  if (!rows || !tubesPerRow || !lengthMm || !outerMm || !pitchT || !pitchL) return;

  const widthM = lengthMm / 1000;
  const heightM = (tubesPerRow * pitchT) / 1000;
  const depthM = (rows * pitchL) / 1000;
  const faceM2 = widthM * heightM;
  const tubeLengthM = widthM * tubesPerRow * rows;
  const tubeAreaM2 = Math.PI * (outerMm / 1000) * tubeLengthM;
  const finAreaM2 = 2 * Math.max(0, faceM2 - ((Math.PI * (outerMm / 1000) ** 2) / 4) * tubesPerRow) * rows;
  const exchangeM2 = tubeAreaM2 + finAreaM2;
  const volumeL = innerMm ? Math.PI * (innerMm / 2000) ** 2 * tubeLengthM * 1000 : undefined;

  if (isCond) {
    setIfMissing(row, "condensadorCoilWidthM", widthM);
    setIfMissing(row, "condensadorCoilHeightM", heightM);
    setIfMissing(row, "condensadorCoilDepthM", depthM);
    setIfMissing(row, "condensadorAreaFaceM2", faceM2);
    setIfMissing(row, "condensadorAreaTrocaM2", exchangeM2);
    setIfMissing(row, "condensadorVolumeInternoL", volumeL);
  } else if (isEvap) {
    setIfMissing(row, "evaporadorCoilWidthM", widthM);
    setIfMissing(row, "evaporadorCoilHeightM", heightM);
    setIfMissing(row, "evaporadorCoilDepthM", depthM);
    setIfMissing(row, "evaporadorFinHeightMm", heightM * 1000);
    setIfMissing(row, "evaporadorAreaFaceM2", faceM2);
    setIfMissing(row, "evaporadorAreaTrocaM2", row.evaporadorAreaSuperficieM2 ?? exchangeM2);
  } else {
    setIfMissing(row, "reheatCoilWidthM", widthM);
    setIfMissing(row, "reheatCoilHeightM", heightM);
    setIfMissing(row, "reheatCoilDepthM", depthM);
    setIfMissing(row, "reheatAreaFaceM2", faceM2);
    setIfMissing(row, "reheatAreaTrocaM2", exchangeM2);
    setIfMissing(row, "reheatVolumeInternoL", volumeL);
  }
}

const EQUIPMENT_CATALOG: CatalogEquipmentRow[] = EQUIPMENT_CATALOG_RAW.map((item) => {
  const row: CatalogEquipmentRow = { ...item };
  enrichCoilMetrics(row);
  enrichSizedCoil(row, "condensador");
  enrichSizedCoil(row, "evaporador");
  enrichSizedCoil(row, "reheat");
  return row;
});

export function getEquipmentCatalog(): CatalogEquipmentRow[] {
  return EQUIPMENT_CATALOG;
}

export function getEquipmentById(id: string): CatalogEquipmentRow | undefined {
  return EQUIPMENT_CATALOG.find((item) => item.id === id);
}

export function getEquipmentByModel(modeloUnico: string): CatalogEquipmentRow | undefined {
  return EQUIPMENT_CATALOG.find((item) => item.modeloUnico === modeloUnico);
}
