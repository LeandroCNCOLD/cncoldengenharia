import { parseUnilabNumber } from './csv';
import type { UnilabCalculationMode, UnilabGeometryFactor } from './types';

export const GEOMETRY_TABLE_BY_MODE: Record<UnilabCalculationMode, string> = {
  cooling: 'Tbl_GeometrieRaffreddamento',
  heating: 'Tbl_GeometrieRiscaldamento',
  condensing: 'Tbl_GeometrieCondensazione',
  direct_expansion: 'Tbl_GeometrieEspansioneDiretta',
};

export function mapUnilabGeometryRow(
  row: Record<string, string>,
  mode: UnilabCalculationMode,
  sourceTable = GEOMETRY_TABLE_BY_MODE[mode],
): UnilabGeometryFactor {
  const n = (key: string, fallback = 0) => parseUnilabNumber(row[key], fallback);
  const n1 = (key: string) => parseUnilabNumber(row[key], 1);

  return {
    mode,
    sourceTable,
    geometryCode: row.CodiceBatteria || row.Sigla || row.Descrizione || '',
    batteryCode: row.CodiceBatteria,
    sigla: row.Sigla,
    description: row.Descrizione,

    rowSpacingMm: n('PassoRanghi'),
    tubeSpacingMm: n('PassoTubi'),
    tubeOuterDiameterMm: n('DiamEster'),
    tubeThicknessMm: n('Spessoretubo'),
    finThicknessMm: n('SpessoreAletta'),
    finHeightMm: n('AltezzaAletta'),
    tubeHeightMm: n('AltezzaTubo'),
    tubeWidthMm: n('LarghezzaTubo'),

    fatCorAl: n1('FatCorAl'),
    fatCoefLatoTubo: n1('FatCoeflattub'),
    fatRidAumSup: n1('FatRidAumSup'),
    fatCorrFatAttr: n1('FatCorrFatAttr'),
    ridAreaPassTubo: n1('RidAreaPassTubo'),
    fattoreAttrAria: n1('FattoreAttrAria'),
    fattoreAttrAriaLatente: n1('FattoreAttrAriaLatente'),
    slopeFatCorAl: n('SlopeFatCorAl'),
    slopeFatCoefLatoTubo: n('SlopeFatCoeflattub'),
    slopeFatCorrFatAttr: n('SlopeFatCorrFatAttr'),
    slopeFattoreAttrAria: n('SlopeFattoreAttrAria'),
    securityFactor: n1('SecurityFactor'),
    factorA0: n('Factor_A0'),
    factorA1: n('Factor_A1'),
    factorA2: n('Factor_A2'),
    factorFatc: n1('Factor_FATC'),
    fattPdcConcentrate: n1('Fatt_PdC_Concentrate'),

    raw: { ...row },
  };
}

export function toDatabaseRow(f: UnilabGeometryFactor, importBatchId?: string): Record<string, unknown> {
  return {
    import_batch_id: importBatchId,
    mode: f.mode,
    geometry_code: f.geometryCode,
    battery_code: f.batteryCode,
    sigla: f.sigla,
    description: f.description,
    row_spacing_mm: f.rowSpacingMm,
    tube_spacing_mm: f.tubeSpacingMm,
    tube_outer_diameter_mm: f.tubeOuterDiameterMm,
    tube_thickness_mm: f.tubeThicknessMm,
    fin_thickness_mm: f.finThicknessMm,
    fin_height_mm: f.finHeightMm,
    tube_height_mm: f.tubeHeightMm,
    tube_width_mm: f.tubeWidthMm,
    fat_cor_al: f.fatCorAl,
    fat_coef_lato_tubo: f.fatCoefLatoTubo,
    fat_rid_aum_sup: f.fatRidAumSup,
    fat_corr_fat_attr: f.fatCorrFatAttr,
    rid_area_pass_tubo: f.ridAreaPassTubo,
    fattore_attr_aria: f.fattoreAttrAria,
    fattore_attr_aria_latente: f.fattoreAttrAriaLatente,
    slope_fat_cor_al: f.slopeFatCorAl,
    slope_fat_coef_lato_tubo: f.slopeFatCoefLatoTubo,
    slope_fat_corr_fat_attr: f.slopeFatCorrFatAttr,
    slope_fattore_attr_aria: f.slopeFattoreAttrAria,
    security_factor: f.securityFactor,
    factor_a0: f.factorA0,
    factor_a1: f.factorA1,
    factor_a2: f.factorA2,
    factor_fatc: f.factorFatc,
    fatt_pdc_concentrate: f.fattPdcConcentrate,
    raw_json: f.raw,
    source_table: f.sourceTable,
  };
}

export function fromDatabaseRow(row: Record<string, unknown>): UnilabGeometryFactor {
  const n = (key: string, fallback = 0) => parseUnilabNumber(row[key], fallback);
  const n1 = (key: string) => parseUnilabNumber(row[key], 1);
  return {
    id: String(row.id || ''),
    mode: row.mode as UnilabCalculationMode,
    geometryCode: String(row.geometry_code || ''),
    batteryCode: String(row.battery_code || ''),
    sigla: String(row.sigla || ''),
    description: String(row.description || ''),
    sourceTable: String(row.source_table || ''),
    rowSpacingMm: n('row_spacing_mm'),
    tubeSpacingMm: n('tube_spacing_mm'),
    tubeOuterDiameterMm: n('tube_outer_diameter_mm'),
    tubeThicknessMm: n('tube_thickness_mm'),
    finThicknessMm: n('fin_thickness_mm'),
    finHeightMm: n('fin_height_mm'),
    tubeHeightMm: n('tube_height_mm'),
    tubeWidthMm: n('tube_width_mm'),
    fatCorAl: n1('fat_cor_al'),
    fatCoefLatoTubo: n1('fat_coef_lato_tubo'),
    fatRidAumSup: n1('fat_rid_aum_sup'),
    fatCorrFatAttr: n1('fat_corr_fat_attr'),
    ridAreaPassTubo: n1('rid_area_pass_tubo'),
    fattoreAttrAria: n1('fattore_attr_aria'),
    fattoreAttrAriaLatente: n1('fattore_attr_aria_latente'),
    slopeFatCorAl: n('slope_fat_cor_al'),
    slopeFatCoefLatoTubo: n('slope_fat_coef_lato_tubo'),
    slopeFatCorrFatAttr: n('slope_fat_corr_fat_attr'),
    slopeFattoreAttrAria: n('slope_fattore_attr_aria'),
    securityFactor: n1('security_factor'),
    factorA0: n('factor_a0'),
    factorA1: n('factor_a1'),
    factorA2: n('factor_a2'),
    factorFatc: n1('factor_fatc'),
    fattPdcConcentrate: n1('fatt_pdc_concentrate'),
    raw: (row.raw_json as Record<string, unknown>) || {},
  };
}
