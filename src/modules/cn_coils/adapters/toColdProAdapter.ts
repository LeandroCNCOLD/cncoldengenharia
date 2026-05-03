// Adapter CN Coils → ColdPro V2.
// O simulador CN Coils termina aqui: gera ProgressiveCoilInput ou CondenserSpec
// e os entrega para `useComponentStore` via addCoil/addCondenser. Quem cuida
// de equilíbrio, COP e matching é o ColdPro V2 — não duplicamos nada disso.

import type { CondenserSpec, ProgressiveCoilInput, RollGeometry } from "@/modules/coldpro_v2";
import type {
  TubeMaterialItem,
  CnCoilsPhysicalInputs,
  CnCoilsSimulationResult,
  CnCoilsThermoInputs,
  ValidationResult,
} from "../types/cncoils.types";
import { mmToM } from "../engine/units";

const COLDPRO_TUBE_MATERIALS = ["copper", "aluminum", "steel"] as const;
type ColdProMaterial = (typeof COLDPRO_TUBE_MATERIALS)[number];

function mapMaterial(
  catalogId: string,
  catalog: TubeMaterialItem[],
): ColdProMaterial | null {
  const item = catalog.find((m) => m.id === catalogId);
  if (!item) return null;
  const name = (item.name || item.id).toLowerCase();
  if (/cobre|copper|cu\b/.test(name)) return "copper";
  if (/alum|aluminum|al\b/.test(name)) return "aluminum";
  if (/steel|aço|aco|ferro/.test(name)) return "steel";
  return null;
}

export interface ToColdProContext {
  tubeMaterials: TubeMaterialItem[];
}

export function validateBeforeAdapt(
  physical: Partial<CnCoilsPhysicalInputs>,
  result: CnCoilsSimulationResult | undefined,
  thermo: Partial<CnCoilsThermoInputs>,
): ValidationResult {
  const errors: string[] = [];
  if (!result) errors.push("Resultado de simulação ausente.");
  const required: (keyof CnCoilsPhysicalInputs)[] = [
    "geometryId",
    "finnedHeightMm",
    "finnedLengthMm",
    "rows",
    "circuits",
    "tubeMaterialId",
    "finPitchMm",
    "finThicknessMm",
    "tubePitchTransverseMm",
    "tubePitchLongitudinalMm",
    "tubeOuterDiameterMm",
    "tubeInnerDiameterMm",
  ];
  for (const f of required) {
    const v = physical[f];
    if (v === undefined || v === null || (typeof v === "number" && !Number.isFinite(v))) {
      errors.push(`Campo geométrico ausente: ${f}`);
    }
  }
  if (thermo.refrigerantId === undefined || thermo.refrigerantId === "") {
    errors.push("Refrigerante não selecionado.");
  }
  return { isValid: errors.length === 0, errors };
}

export function toEvaporatorInput(
  physical: CnCoilsPhysicalInputs,
  thermo: CnCoilsThermoInputs,
  result: CnCoilsSimulationResult,
  ctx: ToColdProContext,
): ProgressiveCoilInput {
  const material = mapMaterial(physical.tubeMaterialId, ctx.tubeMaterials);
  if (!material) {
    throw new Error(
      `Material do tubo "${physical.tubeMaterialId}" não tem equivalente em ColdPro V2 (copper/aluminum/steel).`,
    );
  }
  if (thermo.evaporatingTempC === undefined) {
    throw new Error(
      "T_evaporação ausente — obrigatório para construir ProgressiveCoilInput.",
    );
  }

  // Distribui as fileiras em rolls de geometria homogênea (1 roll com todas as fileiras
  // na mesma passagem de aleta). O motor ColdPro pode subdividir depois se necessário.
  const rolls: RollGeometry[] = [
    {
      fin_spacing_mm: physical.finPitchMm,
      rows_in_roll: physical.rows,
    },
  ];

  return {
    tube_outer_diameter_mm: physical.tubeOuterDiameterMm,
    tube_inner_diameter_mm: physical.tubeInnerDiameterMm,
    tube_pitch_transverse_mm: physical.tubePitchTransverseMm,
    tube_pitch_longitudinal_mm: physical.tubePitchLongitudinalMm,
    fin_height_mm: physical.finPitchMm, // ColdPro usa fin_height para passo
    fin_thickness_mm: physical.finThicknessMm,
    coil_width_m: mmToM(physical.finnedLengthMm),
    coil_height_m: mmToM(physical.finnedHeightMm),
    tube_material: material,
    fin_material: material,
    rolls,
    air_temperature_in_c: thermo.airInletTempC,
    air_relative_humidity_in: thermo.airInletRhPercent / 100,
    air_mass_flow_kg_s: result.airMassFlowKgS,
    T_evaporating_c: thermo.evaporatingTempC,
    refrigerant: thermo.refrigerantId,
  };
}

export function toCondenserInput(
  thermo: CnCoilsThermoInputs,
  result: CnCoilsSimulationResult,
): CondenserSpec {
  if (thermo.condensingTempC === undefined) {
    throw new Error(
      "T_condensação ausente — obrigatório para construir CondenserSpec.",
    );
  }
  return {
    heat_rejection_capacity_w: result.totalCapacityKw * 1000,
    max_cond_temp_c: thermo.condensingTempC,
  };
}

/**
 * Adapta uma bateria de reaquecimento (hidrônica/vapor) para
 * ProgressiveCoilInput. Usamos a T média do fluido como proxy de T interna —
 * o ColdPro V2 registra essa coil com role="reheat" e usa esses dados para
 * dimensionamento físico e perda de carga, não para psicrometria DX.
 */
export function toReheatCoilInput(
  physical: CnCoilsPhysicalInputs,
  thermo: CnCoilsThermoInputs,
  result: CnCoilsSimulationResult,
  ctx: ToColdProContext,
  fluidMeanTempC: number,
): ProgressiveCoilInput {
  const material = mapMaterial(physical.tubeMaterialId, ctx.tubeMaterials);
  if (!material) {
    throw new Error(
      `Material do tubo "${physical.tubeMaterialId}" não tem equivalente em ColdPro V2 (copper/aluminum/steel).`,
    );
  }

  const rolls: RollGeometry[] = [
    {
      fin_spacing_mm: physical.finPitchMm,
      rows_in_roll: physical.rows,
    },
  ];

  return {
    tube_outer_diameter_mm: physical.tubeOuterDiameterMm,
    tube_inner_diameter_mm: physical.tubeInnerDiameterMm,
    tube_pitch_transverse_mm: physical.tubePitchTransverseMm,
    tube_pitch_longitudinal_mm: physical.tubePitchLongitudinalMm,
    fin_height_mm: physical.finPitchMm,
    fin_thickness_mm: physical.finThicknessMm,
    coil_width_m: mmToM(physical.finnedLengthMm),
    coil_height_m: mmToM(physical.finnedHeightMm),
    tube_material: material,
    fin_material: material,
    rolls,
    air_temperature_in_c: thermo.airInletTempC,
    air_relative_humidity_in: thermo.airInletRhPercent / 100,
    air_mass_flow_kg_s: result.airMassFlowKgS,
    T_evaporating_c: fluidMeanTempC,
    refrigerant: thermo.refrigerantId || "water",
  };
}
