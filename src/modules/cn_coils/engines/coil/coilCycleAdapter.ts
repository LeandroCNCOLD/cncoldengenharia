/**
 * Adaptador que conecta o motor V2 (Wang-Chi-Chang) ao CycleEngine.
 * Recebe condições do ciclo e retorna resultado no formato do ciclo.
 *
 * Não altera o motor V2 existente — apenas converte inputs/outputs.
 */
import { getRefrigerantFluidProps } from "../refrigerant/refrigerantFluidProps";
import { getRefrigerantSatProps } from "../refrigerant/refrigerantProperties";
import { runSimulationV2 } from "../../engine_v2/simulatorCoreV2";
import type {
  CnCoilsComponentType,
  CnCoilsPhysicalInputs,
  CnCoilsThermoInputs,
} from "../../types/cncoils.types";

export interface CoilCycleInputs {
  physical: {
    rows: number;
    finnedLengthMm: number;
    finnedHeightMm: number;
    finPitchMm: number;
    tubePitchTransversalMm: number;
    tubePitchLongitudinalMm: number;
    tubeExternalDiameterMm: number;
    tubeInternalDiameterMm: number;
    tubesPerRow: number;
    circuits: number;
    finThicknessMm: number;
    finType: string;
  };
  airInletTempC: number;
  airRelativeHumidity: number;
  airFlowM3H: number;
  refrigerantId: string;
  evaporatingTempC?: number;
  condensingTempC?: number;
  superheatK: number;
  subcoolingK: number;
  refrigerantMassFlowKgS: number;
  componentType: "evaporator" | "condenser";
  htCatalog: Record<string, unknown>;
  tubeMaterialConductivity: number;
  foulingExternal?: number;
  foulingInternal?: number;
}

export interface CoilCycleResult {
  totalCapacityW: number;
  sensibleCapacityW: number;
  latentCapacityW: number;
  airOutletTempC: number;
  airOutletRH: number;
  airPressureDropPa: number;
  fluidPressureDropKPa: number;
  overallU_WM2K: number;
  safetyFactor: number;
  refrigerantOutletTempC: number;
  inletQuality: number;
  warnings: string[];
  success: boolean;
  error?: string;
}

function toCnCoilsComponentType(type: CoilCycleInputs["componentType"]): CnCoilsComponentType {
  return type === "evaporator" ? "evaporator_dx" : "condenser_air";
}

function toPhysicalInputs(
  inputs: CoilCycleInputs,
  componentType: CnCoilsComponentType,
): CnCoilsPhysicalInputs {
  const p = inputs.physical;
  return {
    componentType,
    geometryId: "cycle-adapter",
    rows: p.rows,
    finnedLengthMm: p.finnedLengthMm,
    finnedHeightMm: p.finnedHeightMm,
    finPitchMm: p.finPitchMm,
    tubePitchTransverseMm: p.tubePitchTransversalMm,
    tubePitchLongitudinalMm: p.tubePitchLongitudinalMm,
    tubeOuterDiameterMm: p.tubeExternalDiameterMm,
    tubeInnerDiameterMm: p.tubeInternalDiameterMm,
    tubesPerRow: p.tubesPerRow,
    circuits: p.circuits,
    finThicknessMm: p.finThicknessMm,
    finType: p.finType,
    tubeMaterialId: "cycle-adapter",
  };
}

function toThermoInputs(inputs: CoilCycleInputs): CnCoilsThermoInputs {
  return {
    refrigerantId: inputs.refrigerantId,
    airFlowM3H: inputs.airFlowM3H,
    airInletTempC: inputs.airInletTempC,
    airInletRhPercent: inputs.airRelativeHumidity <= 1
      ? inputs.airRelativeHumidity * 100
      : inputs.airRelativeHumidity,
    altitudeM: 0,
    evaporatingTempC: inputs.evaporatingTempC,
    condensingTempC: inputs.condensingTempC,
    superheatK: inputs.superheatK,
    subcoolingK: inputs.subcoolingK,
  };
}

export async function runCoilForCycle(inputs: CoilCycleInputs): Promise<CoilCycleResult> {
  const warnings: string[] = [];

  try {
    const componentType = toCnCoilsComponentType(inputs.componentType);
    const T_sat_C = inputs.componentType === "evaporator"
      ? (inputs.evaporatingTempC ?? -10)
      : (inputs.condensingTempC ?? 40);

    const fluidProps = await getRefrigerantFluidProps(
      inputs.refrigerantId,
      T_sat_C,
      inputs.componentType === "evaporator" ? "liquid" : "vapor",
    );
    warnings.push(...fluidProps.warnings);

    const satProps = await getRefrigerantSatProps(inputs.refrigerantId, T_sat_C);
    warnings.push(...satProps.warnings);

    let inletQuality = 0;
    if (inputs.componentType === "evaporator") {
      const h_f_Te = satProps.h_f_kJkg;
      const h_fg_Te = satProps.h_fg_kJkg;
      const cp_liq_kJkgK = satProps.liquid.cp_kJkgK;
      const h_cond_outlet = satProps.h_f_kJkg + cp_liq_kJkgK * inputs.subcoolingK;
      inletQuality = h_fg_Te > 0
        ? Math.max(0, Math.min(1, (h_cond_outlet - h_f_Te) / h_fg_Te))
        : 0;
      if (inletQuality > 0.1) {
        warnings.push(
          `Flash na expansão: título de entrada no evaporador = ${(inletQuality * 100).toFixed(1)}%. ` +
          "Capacidade efetiva reduzida. Considere aumentar o subresfriamento.",
        );
      }
      if (inputs.subcoolingK >= 10) {
        inletQuality = 0;
      }
    }

    const rawResult = runSimulationV2({
      physical: toPhysicalInputs(inputs, componentType),
      thermo: toThermoInputs(inputs),
      componentType,
      tubeMaterialConductivity: inputs.tubeMaterialConductivity,
      fluidProps: {
        rho_kg_m3: fluidProps.rho_kg_m3,
        mu_Pa_s: fluidProps.mu_Pa_s,
        cp_J_kgK: fluidProps.cp_J_kgK,
        k_W_mK: fluidProps.k_W_mK,
      },
      fluidMassFlowKgS: inputs.refrigerantMassFlowKgS,
      foulingExternal: inputs.foulingExternal ?? 0,
      foulingInternal: inputs.foulingInternal ?? 0,
      superheatK: inputs.superheatK,
      subcoolingK: inputs.subcoolingK,
      h_fg_kJkg: satProps.h_fg_kJkg,
    });

    warnings.push(...(rawResult.warnings ?? []));

    const refrigerantOutletTempC = inputs.componentType === "evaporator"
      ? T_sat_C + inputs.superheatK
      : T_sat_C - inputs.subcoolingK;

    return {
      totalCapacityW: (rawResult.totalCapacityKw ?? 0) * 1000,
      sensibleCapacityW: (rawResult.sensibleCapacityKw ?? 0) * 1000,
      latentCapacityW: (rawResult.latentCapacityKw ?? 0) * 1000,
      airOutletTempC: rawResult.airOutletTempC ?? inputs.airInletTempC,
      airOutletRH: rawResult.airOutletRhPercent !== undefined
        ? rawResult.airOutletRhPercent / 100
        : inputs.airRelativeHumidity,
      airPressureDropPa: rawResult.airPressureDropPa ?? 0,
      fluidPressureDropKPa: rawResult.fluidPressureDropKpa ?? 0,
      overallU_WM2K: rawResult.U_Wm2K ?? 0,
      safetyFactor: rawResult.correctionFactor ?? 1,
      refrigerantOutletTempC,
      inletQuality,
      warnings,
      success: true,
    };
  } catch (err) {
    return {
      totalCapacityW: 0,
      sensibleCapacityW: 0,
      latentCapacityW: 0,
      airOutletTempC: inputs.airInletTempC,
      airOutletRH: inputs.airRelativeHumidity,
      airPressureDropPa: 0,
      fluidPressureDropKPa: 0,
      overallU_WM2K: 0,
      safetyFactor: 0,
      refrigerantOutletTempC: inputs.evaporatingTempC ?? -10,
      inletQuality: 0,
      warnings,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
