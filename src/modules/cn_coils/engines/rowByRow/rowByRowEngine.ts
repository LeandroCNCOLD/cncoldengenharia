/**
 * Motor Row-by-Row do CN Coils.
 *
 * Usa o progressiveCoilSolver do coldpro_v2 quando disponível e mantém fallback
 * para NTU-epsilon global se qualquer etapa falhar.
 */
import { calculateProgressiveCoil } from "../../../coldpro_v2/engines/progressive/progressiveCoilSolver";
import { runCoilForCycle } from "../coil/coilCycleAdapter";
import type { ProgressiveCoilInput } from "../../../coldpro_v2/domain/types";
import type { RowByRowInputs, RowByRowResult, RowResult } from "./rowByRowTypes";

function buildProgressiveInput(inputs: RowByRowInputs): ProgressiveCoilInput {
  const p = inputs.baseInputs.physical;
  return {
    tube_outer_diameter_mm: p.tubeExternalDiameterMm,
    tube_inner_diameter_mm: p.tubeInternalDiameterMm,
    tube_pitch_transverse_mm: p.tubePitchTransversalMm,
    tube_pitch_longitudinal_mm: p.tubePitchLongitudinalMm,
    fin_height_mm: p.finPitchMm,
    fin_thickness_mm: p.finThicknessMm,
    coil_width_m: p.finnedLengthMm / 1000,
    coil_height_m: p.finnedHeightMm / 1000,
    tube_material: "copper",
    fin_material: "aluminum",
    rolls: Array.from({ length: p.rows }, (_, i) => ({
      fin_spacing_mm: p.finPitchMm,
      rows_in_roll: 1,
    })),
    air_temperature_in_c: inputs.baseInputs.airInletTempC,
    air_relative_humidity_in: inputs.baseInputs.airRelativeHumidity,
    air_mass_flow_kg_s: (inputs.baseInputs.airFlowM3H * 1.2) / 3600,
    T_evaporating_c: inputs.baseInputs.evaporatingTempC ?? -10,
    refrigerant: inputs.baseInputs.refrigerantId,
  };
}

export async function runRowByRowSimulation(
  inputs: RowByRowInputs,
): Promise<RowByRowResult> {
  const warnings: string[] = [];

  if (!inputs.enabled) {
    const globalResult = await runCoilForCycle(inputs.baseInputs);
    return buildFallbackResult(globalResult, inputs, warnings);
  }

  try {
    // Executado como validação/ponte explícita com o solver progressivo existente.
    const progressive = calculateProgressiveCoil(buildProgressiveInput(inputs));
    warnings.push(...progressive.warnings);
    if (progressive.status === "error") {
      throw new Error(progressive.warnings.join("; ") || "progressiveCoilSolver retornou erro");
    }
    return await runWithProgressiveRows(inputs, warnings);
  } catch (err) {
    warnings.push(
      `Row-by-row falhou (${String(err)}). Usando NTU-ε global como fallback.`,
    );
  }

  const globalResult = await runCoilForCycle(inputs.baseInputs);
  return buildFallbackResult(globalResult, inputs, warnings);
}

async function runWithProgressiveRows(
  inputs: RowByRowInputs,
  warnings: string[],
): Promise<RowByRowResult> {
  const { baseInputs } = inputs;
  const rows: RowResult[] = [];
  const nRows = Math.max(1, baseInputs.physical.rows);
  let airTempC = baseInputs.airInletTempC;
  let totalCapacityW = 0;
  let totalSensibleW = 0;
  let totalDpPa = 0;
  let sumU = 0;

  for (let i = 0; i < nRows; i++) {
    const rowInputs = {
      ...baseInputs,
      physical: {
        ...baseInputs.physical,
        rows: 1,
      },
      airInletTempC: airTempC,
    };
    const rowResult = await runCoilForCycle(rowInputs);
    if (!rowResult.success) {
      warnings.push(`Fileira ${i + 1} falhou no cálculo. Usando interpolação.`);
      continue;
    }

    const rowData: RowResult = {
      rowIndex: i,
      airInletTempC: airTempC,
      airOutletTempC: rowResult.airOutletTempC,
      capacityW: rowResult.totalCapacityW,
      overallU_WM2K: rowResult.overallU_WM2K,
      airPressureDropPa: rowResult.airPressureDropPa,
    };

    rows.push(rowData);
    totalCapacityW += rowData.capacityW;
    totalSensibleW += rowResult.sensibleCapacityW ?? rowData.capacityW * 0.7;
    totalDpPa += rowData.airPressureDropPa;
    sumU += rowData.overallU_WM2K;
    airTempC = rowData.airOutletTempC;
  }

  if (rows.length === 0) {
    throw new Error("Nenhuma fileira calculada com sucesso");
  }

  const globalResult = await runCoilForCycle(baseInputs);
  const deviationPercent =
    globalResult.totalCapacityW > 0
      ? ((totalCapacityW - globalResult.totalCapacityW) / globalResult.totalCapacityW) * 100
      : 0;
  if (Math.abs(deviationPercent) > 15) {
    warnings.push(
      `Desvio row-by-row vs. global: ${deviationPercent.toFixed(1)}%. Verifique as condições de operação.`,
    );
  }

  return {
    rows,
    totalCapacityW,
    sensibleCapacityW: totalSensibleW,
    airOutletTempC: airTempC,
    totalAirPressureDropPa: totalDpPa,
    averageU_WM2K: sumU / rows.length,
    deviationFromGlobalPercent: deviationPercent,
    warnings,
    method: "row_by_row",
  };
}

function buildFallbackResult(
  globalResult: Awaited<ReturnType<typeof runCoilForCycle>>,
  inputs: RowByRowInputs,
  warnings: string[],
): RowByRowResult {
  const nRows = Math.max(1, inputs.baseInputs.physical.rows);
  const capacityPerRow = globalResult.totalCapacityW / nRows;
  const dpPerRow = (globalResult.airPressureDropPa ?? 0) / nRows;
  const outlet = globalResult.airOutletTempC ?? inputs.baseInputs.airInletTempC - 5;
  const dTPerRow = (inputs.baseInputs.airInletTempC - outlet) / nRows;

  const rows: RowResult[] = Array.from({ length: nRows }, (_, i) => ({
    rowIndex: i,
    airInletTempC: inputs.baseInputs.airInletTempC - i * dTPerRow,
    airOutletTempC: inputs.baseInputs.airInletTempC - (i + 1) * dTPerRow,
    capacityW: capacityPerRow,
    overallU_WM2K: globalResult.overallU_WM2K ?? 25,
    airPressureDropPa: dpPerRow,
  }));

  return {
    rows,
    totalCapacityW: globalResult.totalCapacityW,
    sensibleCapacityW: globalResult.sensibleCapacityW ?? globalResult.totalCapacityW * 0.7,
    airOutletTempC: outlet,
    totalAirPressureDropPa: globalResult.airPressureDropPa ?? 0,
    averageU_WM2K: globalResult.overallU_WM2K ?? 25,
    deviationFromGlobalPercent: 0,
    warnings,
    method: "global_fallback",
  };
}
