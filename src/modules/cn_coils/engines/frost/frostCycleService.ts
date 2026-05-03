/**
 * Serviço de ponte entre o CycleEngine CN Coils e os módulos de gelo do coldpro_v2.
 */
import { calculateFrostFormation } from "../../../coldpro_v2/engines/defrost/frostFormation";
import { calculateDefrostCycle } from "../../../coldpro_v2/engines/defrost/defrostCycle";
import type { DefrostMethod as ColdproDefrostMethod } from "../../../coldpro_v2/domain/types";
import type {
  FrostAnalysisInput,
  FrostAnalysisResult,
  FrostTimePoint,
} from "./frostTypes";

const SURFACE_TEMP_OFFSET_C = 3;

function toColdproDefrostMethod(method: FrostAnalysisInput["config"]["defrostMethod"]): {
  method: ColdproDefrostMethod;
  warnings: string[];
} {
  if (method === "natural") {
    return {
      method: "electric",
      warnings: ["Degelo natural ainda não é suportado pelo motor coldpro_v2. Usando elétrico como fallback."],
    };
  }
  return { method, warnings: [] };
}

function buildDegradationCurve(
  input: FrostAnalysisInput,
  coilSurfaceTempC: number,
  steps = 12,
): FrostTimePoint[] {
  const curve: FrostTimePoint[] = [];
  const stepH = input.config.operationTimeH / steps;

  for (let i = 0; i <= steps; i++) {
    const timeH = i * stepH;
    const frostResult = calculateFrostFormation({
      air_temperature_c: input.airInletTempC,
      air_relative_humidity: input.airRelativeHumidity,
      air_mass_flow_kg_s: input.airMassFlowKgS,
      coil_surface_temperature_c: coilSurfaceTempC,
      operation_time_h: timeH,
      evaporator_external_area_m2: input.evaporatorExternalAreaM2,
      frost_density_kg_m3: input.config.frostDensityKgM3,
      defrost_threshold_frost_thickness_mm: input.config.defrostThresholdMm,
    });

    const capacityLossPct = frostResult.estimated_capacity_loss_pct;
    const effectiveCapacityW = input.evaporatorCapacityW * (1 - capacityLossPct / 100);

    curve.push({
      timeH,
      frostThicknessMm: frostResult.frost_thickness_mm,
      capacityLossPct,
      effectiveCapacityW,
      airflowReductionFactor: frostResult.airflow_reduction_factor,
      mode: frostResult.mode,
    });
  }

  return curve;
}

export function calculateFrostAnalysis(input: FrostAnalysisInput): FrostAnalysisResult {
  const warnings: string[] = [];
  const coilSurfaceTempC = input.evaporatingTempC + SURFACE_TEMP_OFFSET_C;

  const frostAtEnd = calculateFrostFormation({
    air_temperature_c: input.airInletTempC,
    air_relative_humidity: input.airRelativeHumidity,
    air_mass_flow_kg_s: input.airMassFlowKgS,
    coil_surface_temperature_c: coilSurfaceTempC,
    operation_time_h: input.config.operationTimeH,
    evaporator_external_area_m2: input.evaporatorExternalAreaM2,
    frost_density_kg_m3: input.config.frostDensityKgM3,
    defrost_threshold_frost_thickness_mm: input.config.defrostThresholdMm,
  });
  warnings.push(...frostAtEnd.warnings);

  const capacityLossAtEndPct = frostAtEnd.estimated_capacity_loss_pct;
  const effectiveCapacityAtEndW =
    input.evaporatorCapacityW * (1 - capacityLossAtEndPct / 100);

  const mappedDefrost = toColdproDefrostMethod(input.config.defrostMethod);
  warnings.push(...mappedDefrost.warnings);
  const defrostResult = calculateDefrostCycle({
    method: mappedDefrost.method,
    frost_mass_kg: frostAtEnd.frost_mass_kg,
    frost_temperature_c: input.evaporatingTempC,
    compressor_capacity_w: input.evaporatorCapacityW,
    T_condensing_c: input.condensingTempC,
    T_evaporating_c: input.evaporatingTempC,
    refrigerant: input.refrigerantId,
    evaporator_external_area_m2: input.evaporatorExternalAreaM2,
    max_defrost_time_min: input.config.maxDefrostTimeMin,
  });
  warnings.push(...defrostResult.warnings.filter((w) => !warnings.includes(w)));

  const degradationCurve = buildDegradationCurve(input, coilSurfaceTempC);

  if (frostAtEnd.mode === "dry") {
    warnings.push(
      `Superfície seca (T_sup = ${coilSurfaceTempC.toFixed(1)}°C > T_dp). Nenhuma formação de gelo esperada.`,
    );
  }

  if (capacityLossAtEndPct > 15) {
    warnings.push(
      `Perda de capacidade de ${capacityLossAtEndPct.toFixed(1)}% após ${input.config.operationTimeH}h. ` +
        "Considere reduzir o intervalo de degelo.",
    );
  }

  if (input.airRelativeHumidity < 0.5 && frostAtEnd.mode !== "dry") {
    warnings.push("Umidade relativa baixa — formação de gelo será lenta.");
  }

  return {
    frostAtEndOfCycle: frostAtEnd,
    defrostResult,
    degradationCurve,
    estimatedTimeToDefrostH: frostAtEnd.estimated_time_to_defrost_h,
    effectiveCapacityAtEndW,
    capacityLossAtEndPct,
    coilSurfaceTempC,
    recommendedDefrost: frostAtEnd.recommended_defrost,
    warnings,
  };
}
