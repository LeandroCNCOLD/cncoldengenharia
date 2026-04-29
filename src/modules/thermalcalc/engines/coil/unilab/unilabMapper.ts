// Traduz o schema bruto de coil_geometry_factors / coil_fluids para os tipos
// que o motor híbrido entende. Mantém os defaults conservadores quando o
// dado bruto está nulo — o motor decide se marca como estimado.

import type { CoilMode, FinType, TubeType } from '../engines/types';
import type {
  UnilabFluidProperties,
  UnilabGeometry,
  UnilabGeometryFactors,
} from './unilabTypes';

type GeometryRow = {
  geometry_code: string;
  sigla: string | null;
  mode: string;
  fin_type: string | null;
  tube_type: string | null;
  tube_outer_diameter_mm: number | null;
  tube_spacing_mm: number | null;
  row_spacing_mm: number | null;
  fin_thickness_mm: number | null;
  // fatores (mesma linha)
  fat_cor_al: number | null;
  fat_coef_lato_tubo: number | null;
  fat_rid_aum_sup: number | null;
  fattore_attr_aria: number | null;
  fattore_attr_aria_latente: number | null;
  fat_corr_fat_attr: number | null;
  slope_fat_cor_al: number | null;
  slope_fat_coef_lato_tubo: number | null;
  slope_fattore_attr_aria: number | null;
  security_factor: number | null;
  raw_json?: Record<string, unknown> | null;
};

type FluidRow = {
  name: string;
  liquid_density_kg_m3: number | null;
  vapour_density_kg_m3: number | null;
  liquid_cp_kj_kgk: number | null;
  vapour_cp_kj_kgk: number | null;
  liquid_viscosity_upa_s: number | null;
  vapour_viscosity_upa_s: number | null;
  liquid_conductivity_w_mk: number | null;
  latent_heat_kj_kg: number | null;
};

function normalizeFinType(raw: string | null): FinType {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('louver')) return 'louver';
  if (v.includes('wavy')) return 'wavy';
  if (v.includes('herring')) return 'herringbone';
  if (v.includes('plain') || v.includes('flat')) return 'plain';
  return 'unknown';
}

function normalizeTubeType(raw: string | null): TubeType {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('micro')) return 'microfin';
  if (v.includes('groove') || v.includes('rifled')) return 'grooved';
  if (v.includes('smooth') || v.includes('plain')) return 'smooth';
  return 'unknown';
}

function normalizeMode(raw: string): CoilMode {
  const allowed: CoilMode[] = [
    'cooling',
    'heating',
    'condensation',
    'direct_expansion',
    'steam',
    'pump_evaporator',
    'multiphase',
  ];
  return (allowed as string[]).includes(raw) ? (raw as CoilMode) : 'cooling';
}

/** Estima diâmetro interno quando a tabela só traz o externo. */
function estimateInnerDiameter(outerMm: number | null, finThicknessMm: number | null): number {
  if (!outerMm || outerMm <= 0) return 0;
  // espessura típica de parede de tubo de cobre/alumínio ~ 0.3 mm
  const wall = Math.max(0.25, Math.min(0.5, (finThicknessMm ?? 0.3) * 1.5));
  return Math.max(outerMm - 2 * wall, outerMm * 0.85);
}

/** Estima passo de aletas a partir do FPI (10 FPI ≈ 2.54 mm). */
function pickFinPitch(row: GeometryRow): number {
  const raw = row.raw_json ?? {};
  const candidates = [
    (raw as any).fin_pitch_mm,
    (raw as any).finPitchMm,
    (raw as any).PassoAlette,
    (raw as any).passo_alette,
  ].map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  if (candidates.length) return candidates[0];
  return 2.5; // default conservador (~10 FPI)
}

export function mapGeometryRow(row: GeometryRow): UnilabGeometry {
  return {
    geometryCode: String(row.geometry_code),
    sigla: row.sigla,
    mode: normalizeMode(row.mode),
    finType: normalizeFinType(row.fin_type),
    tubeType: normalizeTubeType(row.tube_type),
    tubeOuterDiameterMm: Number(row.tube_outer_diameter_mm ?? 0),
    tubeInnerDiameterMm: estimateInnerDiameter(row.tube_outer_diameter_mm, row.fin_thickness_mm),
    tubePitchMm: Number(row.tube_spacing_mm ?? 0),
    rowPitchMm: Number(row.row_spacing_mm ?? 0),
    finPitchMm: pickFinPitch(row),
    finThicknessMm: Number(row.fin_thickness_mm ?? 0.13),
    rows: null,
    circuits: null,
  };
}

export function mapFactorsRow(row: GeometryRow): UnilabGeometryFactors {
  return {
    geometryCode: String(row.geometry_code),
    fatCorAl: row.fat_cor_al ?? 1,
    fatCoeflattub: row.fat_coef_lato_tubo ?? 1,
    fatRidAumSup: row.fat_rid_aum_sup ?? 1,
    fattoreAttrAria: row.fattore_attr_aria ?? 1,
    fattoreAttrAriaLatente: row.fattore_attr_aria_latente ?? 1,
    fatCorrFatAttr: row.fat_corr_fat_attr ?? 1,
    slopeFatCorAl: row.slope_fat_cor_al ?? 0,
    slopeFatCoeflattub: row.slope_fat_coef_lato_tubo ?? 0,
    slopeFattoreAttrAria: row.slope_fattore_attr_aria ?? 0,
    securityFactor: row.security_factor ?? 1,
  };
}

export function mapFluidRow(row: FluidRow, temperatureC: number): UnilabFluidProperties {
  return {
    fluidCode: row.name,
    temperatureC,
    liquidDensityKgM3: row.liquid_density_kg_m3 ?? undefined,
    vapourDensityKgM3: row.vapour_density_kg_m3 ?? undefined,
    liquidCpKjKgK: row.liquid_cp_kj_kgk ?? undefined,
    vapourCpKjKgK: row.vapour_cp_kj_kgk ?? undefined,
    liquidViscosityUPaS: row.liquid_viscosity_upa_s ?? undefined,
    vapourViscosityUPaS: row.vapour_viscosity_upa_s ?? undefined,
    liquidConductivityWmK: row.liquid_conductivity_w_mk ?? undefined,
    latentHeatKjKg: row.latent_heat_kj_kg ?? undefined,
  };
}

export type { GeometryRow, FluidRow };
