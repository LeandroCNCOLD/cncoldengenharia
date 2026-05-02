import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { ProgressiveCoilInput } from "@/modules/coldpro_v2";

export interface EvaporatorAdapterResult {
  input: ProgressiveCoilInput | null;
  warnings: string[];
}

/**
 * Converte dados do catálogo CN COLD em ProgressiveCoilInput.
 * Só converte se houver geometria suficiente. Não inventa parâmetros.
 *
 * O motor exige:
 *  - diâmetro interno do tubo
 *  - pitches transversal e longitudinal
 *  - altura/espessura de aleta
 *  - largura/altura da serpentina
 *  - vazão mássica de ar (calculável a partir de m³/h)
 *
 * Caso falte qualquer um desses dados no catálogo, retorna `input: null`
 * e adiciona um aviso. A UI deve cair no fluxo manual.
 */
export function catalogToEvaporatorInput(row: CatalogEquipmentRow): EvaporatorAdapterResult {
  const warnings: string[] = [];

  const requiredCatalogFields = {
    evaporadorRows: row.evaporadorRows,
    evaporadorTubesPorRow: row.evaporadorTubesPorRow,
    evaporadorFinSpacingMm: row.evaporadorFinSpacingMm,
    evaporadorLengthMm: row.evaporadorLengthMm,
    evaporadorTuboDiametroMm: row.evaporadorTuboDiametroMm,
    vazaoArEvaporadorM3H: row.vazaoArEvaporadorM3H,
    tempEvaporacaoC: row.tempEvaporacaoC,
  };

  const missing = Object.entries(requiredCatalogFields)
    .filter(([, v]) => v === undefined || v === null)
    .map(([k]) => k);

  if (missing.length > 0) {
    warnings.push(
      `Evaporador sem geometria suficiente para ProgressiveCoilInput (faltam: ${missing.join(", ")}).`,
    );
    return { input: null, warnings };
  }

  // Campos obrigatórios do motor que NÃO existem no catálogo:
  //   tube_inner_diameter_mm, tube_pitch_transverse_mm, tube_pitch_longitudinal_mm,
  //   fin_height_mm, fin_thickness_mm, coil_width_m, coil_height_m,
  //   tube_material, fin_material, air_temperature_in_c, air_relative_humidity_in.
  //
  // Sem esses dados, não montamos o ProgressiveCoilInput — o usuário pediu
  // explicitamente para NÃO inventar serpentina.
  warnings.push(
    "Evaporador sem dados detalhados de geometria interna (diâmetro interno, pitches, altura/espessura de aleta, largura/altura da serpentina). Use a tela de Componentes para complementar.",
  );

  return { input: null, warnings };
}
