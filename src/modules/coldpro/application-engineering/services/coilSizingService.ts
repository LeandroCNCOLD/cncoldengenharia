/**
 * coilSizingService.ts
 *
 * Dimensionamento de evaporador e condensador aletados usando o motor
 * V2 ASHRAE (Wang-Chi-Chang + psicrometria real + NTU-ε) via runCoilForCycle.
 *
 * Substitui o motor LMTD simplificado anterior — agora Q_calc vem do mesmo
 * motor que o Hub de Testes e a workspace CN Coils usam.
 *
 * Referências:
 *   - Wang, Chi-Chang et al. (2000) — Heat transfer and friction characteristics
 *     of plain fin-and-tube heat exchangers
 *   - ASHRAE Handbook Fundamentals (2021) — Cap. 4 (NTU-ε)
 *   - EN 12900:2013 — Refrigerant compressors — Rating conditions
 */
import { runCoilForCycle } from "@/modules/cn_coils/engines/coil/coilCycleAdapter";
import type {
  EvaporatorSizingInput,
  EvaporatorSizingResult,
  CondenserSizingInput,
  CondenserSizingResult,
} from "../types/application-engineering.types";

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Condutividade térmica do cobre (W/m·K) */
const K_COPPER_W_MK = 385;

/** Passo transversal padrão para tubo 9.52 mm (mm) */
const DEFAULT_PITCH_TRANSVERSE_MM = 25.4;
/** Passo longitudinal padrão para tubo 9.52 mm (mm) */
const DEFAULT_PITCH_LONGITUDINAL_MM = 22.0;
/** Espessura da aleta padrão (mm) */
const DEFAULT_FIN_THICKNESS_MM = 0.12;
/** Tipo de aleta padrão (1 = plana) */
const DEFAULT_FIN_TYPE = "1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcFaceArea(finnedHeightMm: number, finnedLengthMm: number): number {
  return (finnedHeightMm / 1000) * (finnedLengthMm / 1000);
}

function estimateTotalArea(
  finnedHeightMm: number,
  finnedLengthMm: number,
  rows: number,
  finSpacingMm: number,
  tubeOuterDiameterMm: number,
  tubePitchTransverseMm: number,
): number {
  const faceArea = calcFaceArea(finnedHeightMm, finnedLengthMm);
  const finDensity = 1000 / finSpacingMm;
  const aFin = 2 * faceArea * finDensity * (tubePitchTransverseMm / 1000);
  const nTubes = Math.round(finnedHeightMm / tubePitchTransverseMm);
  const aTube = Math.PI * (tubeOuterDiameterMm / 1000) * (finnedLengthMm / 1000) * nTubes;
  return Math.max(0.1, (aFin + aTube) * rows);
}

function calcLMTD(
  tFluidIn: number,
  tFluidOut: number,
  tAirIn: number,
  tAirOut: number,
): number {
  const dt1 = Math.abs(tFluidIn - tAirOut);
  const dt2 = Math.abs(tFluidOut - tAirIn);
  if (Math.abs(dt1 - dt2) < 0.01) return Math.max(dt1, 0.1);
  if (dt1 <= 0 || dt2 <= 0) return Math.max(dt1, dt2, 0.1);
  return (dt1 - dt2) / Math.log(dt1 / dt2);
}

// ─── Evaporador ───────────────────────────────────────────────────────────────

export async function sizeEvaporator(
  input: EvaporatorSizingInput,
): Promise<EvaporatorSizingResult> {
  const warnings: string[] = [];

  const rows = input.rows ?? 4;
  const tubesPerRow = input.tubes_per_row ?? 20;
  const finSpacingMm = input.fin_spacing_mm ?? 4.5;
  const lengthMm = input.length_mm ?? 1000;
  const tubeDiameterMm = input.tube_diameter_mm ?? 9.52;
  const circuits = input.circuits ?? 4;
  const rhPct = input.rh_air_pct ?? 85;

  const finnedHeightMm = tubesPerRow * DEFAULT_PITCH_TRANSVERSE_MM;
  const finnedLengthMm = lengthMm;
  const faceAreaM2 = calcFaceArea(finnedHeightMm, finnedLengthMm);
  const faceVelocityMs = faceAreaM2 > 0 ? (input.airflow_m3h / 3600) / faceAreaM2 : 2.0;

  if (faceVelocityMs < 1.0)
    warnings.push(`Velocidade de face ${faceVelocityMs.toFixed(2)} m/s baixa — considere reduzir a área ou aumentar a vazão.`);
  if (faceVelocityMs > 4.5)
    warnings.push(`Velocidade de face ${faceVelocityMs.toFixed(2)} m/s alta — risco de arraste de gotículas.`);

  try {
    const result = await runCoilForCycle({
      physical: {
        rows,
        finnedLengthMm,
        finnedHeightMm,
        finPitchMm: finSpacingMm,
        tubePitchTransversalMm: DEFAULT_PITCH_TRANSVERSE_MM,
        tubePitchLongitudinalMm: DEFAULT_PITCH_LONGITUDINAL_MM,
        tubeExternalDiameterMm: tubeDiameterMm,
        tubeInternalDiameterMm: tubeDiameterMm - 0.7,
        tubesPerRow,
        circuits,
        finThicknessMm: DEFAULT_FIN_THICKNESS_MM,
        finType: DEFAULT_FIN_TYPE,
      },
      airInletTempC: input.t_air_in_c,
      airRelativeHumidity: rhPct,
      airFlowM3H: input.airflow_m3h,
      refrigerantId: input.refrigerant,
      evaporatingTempC: input.te_c,
      superheatK: 10,
      subcoolingK: 5,
      refrigerantMassFlowKgS: 0,
      componentType: "evaporator",
      htCatalog: {},
      tubeMaterialConductivity: K_COPPER_W_MK,
    });

    warnings.push(...result.warnings);

    const capacityW = result.totalCapacityW;
    const tAirOutC = result.airOutletTempC;
    const dpAirPa = result.airPressureDropPa;
    const lmtdK = calcLMTD(input.te_c, input.te_c, input.t_air_in_c, tAirOutC);
    const totalAreaM2 = estimateTotalArea(
      finnedHeightMm, finnedLengthMm, rows, finSpacingMm,
      tubeDiameterMm, DEFAULT_PITCH_TRANSVERSE_MM,
    );
    const uOverallWm2K = lmtdK > 0 && totalAreaM2 > 0
      ? capacityW / (totalAreaM2 * lmtdK)
      : result.overallU_WM2K ?? 30;

    if (capacityW < input.required_capacity_w * 0.9)
      warnings.push(`Capacidade calculada ${(capacityW / 1000).toFixed(2)} kW abaixo do requerido ${(input.required_capacity_w / 1000).toFixed(2)} kW — aumente filas ou comprimento.`);

    const frostLoadKg = input.t_air_in_c < 0 ? (capacityW / 1000) * 0.5 : undefined;

    return {
      capacity_w: capacityW,
      t_air_out_c: tAirOutC,
      exchange_area_m2: totalAreaM2,
      finned_area_m2: totalAreaM2 * 0.85,
      lmtd_k: lmtdK,
      u_overall_w_m2k: uOverallWm2K,
      dp_air_pa: dpAirPa,
      face_velocity_ms: faceVelocityMs,
      frost_load_kg: frostLoadKg,
      // Campos extras do motor V2
      sensible_capacity_w: result.sensibleCapacityW,
      latent_capacity_w: result.latentCapacityW,
      air_outlet_rh: result.airOutletRH,
      fluid_pressure_drop_kpa: result.fluidPressureDropKPa,
      refrigerant_outlet_temp_c: result.refrigerantOutletTempC,
      inlet_quality: result.inletQuality,
      safety_factor: result.safetyFactor,
      warnings,
    };
  } catch (err) {
    warnings.push(`Motor V2 falhou: ${String(err)}. Usando estimativa LMTD.`);
    return _sizeEvaporatorFallback(input, faceVelocityMs, finnedHeightMm, finnedLengthMm, warnings);
  }
}

function _sizeEvaporatorFallback(
  input: EvaporatorSizingInput,
  faceVelocityMs: number,
  finnedHeightMm: number,
  finnedLengthMm: number,
  warnings: string[],
): EvaporatorSizingResult {
  const rows = input.rows ?? 4;
  const finSpacingMm = input.fin_spacing_mm ?? 4.5;
  const tubeDiameterMm = input.tube_diameter_mm ?? 9.52;
  const uEst = 30 * Math.min(1.5, Math.max(0.7, faceVelocityMs / 2.5));
  const rho = 1.29, cp = 1006;
  const massFlow = (input.airflow_m3h / 3600) * rho;
  const tAirOutC = input.t_air_in_c - (massFlow > 0 ? input.required_capacity_w / (massFlow * cp) : 0);
  const lmtdK = calcLMTD(input.te_c, input.te_c, input.t_air_in_c, tAirOutC);
  const totalAreaM2 = estimateTotalArea(finnedHeightMm, finnedLengthMm, rows, finSpacingMm, tubeDiameterMm, DEFAULT_PITCH_TRANSVERSE_MM);
  const capacityW = uEst * totalAreaM2 * lmtdK;
  const dpAirPa = rows * 15 * Math.pow(faceVelocityMs / 2.5, 1.8);
  return {
    capacity_w: capacityW,
    t_air_out_c: tAirOutC,
    exchange_area_m2: totalAreaM2,
    finned_area_m2: totalAreaM2 * 0.85,
    lmtd_k: lmtdK,
    u_overall_w_m2k: uEst,
    dp_air_pa: dpAirPa,
    face_velocity_ms: faceVelocityMs,
    warnings,
  };
}

// ─── Condensador ──────────────────────────────────────────────────────────────

export async function sizeCondenser(
  input: CondenserSizingInput,
): Promise<CondenserSizingResult> {
  const warnings: string[] = [];

  const rows = input.rows ?? 2;
  const tubesPerRow = input.tubes_per_row ?? 20;
  const finSpacingMm = input.fin_spacing_mm ?? 2.0;
  const lengthMm = input.length_mm ?? 1200;
  const tubeDiameterMm = input.tube_diameter_mm ?? 9.52;
  const circuits = input.circuits ?? 2;

  const finnedHeightMm = tubesPerRow * DEFAULT_PITCH_TRANSVERSE_MM;
  const finnedLengthMm = lengthMm;
  const faceAreaM2 = calcFaceArea(finnedHeightMm, finnedLengthMm);
  const faceVelocityMs = faceAreaM2 > 0 ? (input.airflow_m3h / 3600) / faceAreaM2 : 2.5;

  if (faceVelocityMs < 1.5)
    warnings.push(`Velocidade de face ${faceVelocityMs.toFixed(2)} m/s baixa para condensador.`);
  if (faceVelocityMs > 5.0)
    warnings.push(`Velocidade de face ${faceVelocityMs.toFixed(2)} m/s muito alta para condensador.`);

  try {
    const result = await runCoilForCycle({
      physical: {
        rows,
        finnedLengthMm,
        finnedHeightMm,
        finPitchMm: finSpacingMm,
        tubePitchTransversalMm: DEFAULT_PITCH_TRANSVERSE_MM,
        tubePitchLongitudinalMm: DEFAULT_PITCH_LONGITUDINAL_MM,
        tubeExternalDiameterMm: tubeDiameterMm,
        tubeInternalDiameterMm: tubeDiameterMm - 0.7,
        tubesPerRow,
        circuits,
        finThicknessMm: DEFAULT_FIN_THICKNESS_MM,
        finType: DEFAULT_FIN_TYPE,
      },
      airInletTempC: input.t_ambient_c,
      airRelativeHumidity: 50,
      airFlowM3H: input.airflow_m3h,
      refrigerantId: input.refrigerant ?? "R404A",
      condensingTempC: input.tc_c,
      superheatK: 10,
      subcoolingK: 5,
      refrigerantMassFlowKgS: 0,
      componentType: "condenser",
      htCatalog: {},
      tubeMaterialConductivity: K_COPPER_W_MK,
    });

    warnings.push(...result.warnings);

    const heatRejectionW = result.totalCapacityW;
    const tAirOutC = result.airOutletTempC;
    const dpAirPa = result.airPressureDropPa;
    const lmtdK = calcLMTD(input.tc_c, input.tc_c, input.t_ambient_c, tAirOutC);
    const totalAreaM2 = estimateTotalArea(
      finnedHeightMm, finnedLengthMm, rows, finSpacingMm,
      tubeDiameterMm, DEFAULT_PITCH_TRANSVERSE_MM,
    );
    const uOverallWm2K = lmtdK > 0 && totalAreaM2 > 0
      ? heatRejectionW / (totalAreaM2 * lmtdK)
      : result.overallU_WM2K ?? 45;

    if (heatRejectionW < input.heat_rejection_w * 0.9)
      warnings.push(`Calor rejeitado ${(heatRejectionW / 1000).toFixed(2)} kW abaixo do requerido ${(input.heat_rejection_w / 1000).toFixed(2)} kW — aumente filas ou comprimento.`);

    return {
      heat_rejection_w: heatRejectionW,
      t_air_out_c: tAirOutC,
      exchange_area_m2: totalAreaM2,
      finned_area_m2: totalAreaM2 * 0.85,
      lmtd_k: lmtdK,
      u_overall_w_m2k: uOverallWm2K,
      dp_air_pa: dpAirPa,
      face_velocity_ms: faceVelocityMs,
      // Campos extras do motor V2
      sensible_capacity_w: result.sensibleCapacityW,
      latent_capacity_w: result.latentCapacityW,
      air_outlet_rh: result.airOutletRH,
      fluid_pressure_drop_kpa: result.fluidPressureDropKPa,
      refrigerant_outlet_temp_c: result.refrigerantOutletTempC,
      inlet_quality: result.inletQuality,
      safety_factor: result.safetyFactor,
      warnings,
    };
  } catch (err) {
    warnings.push(`Motor V2 falhou: ${String(err)}. Usando estimativa LMTD.`);
    return _sizeCondenserFallback(input, faceVelocityMs, finnedHeightMm, finnedLengthMm, warnings);
  }
}

function _sizeCondenserFallback(
  input: CondenserSizingInput,
  faceVelocityMs: number,
  finnedHeightMm: number,
  finnedLengthMm: number,
  warnings: string[],
): CondenserSizingResult {
  const rows = input.rows ?? 2;
  const finSpacingMm = input.fin_spacing_mm ?? 2.0;
  const tubeDiameterMm = input.tube_diameter_mm ?? 9.52;
  const uEst = 45 * Math.min(1.5, Math.max(0.7, faceVelocityMs / 3.0));
  const rho = 1.29, cp = 1006;
  const massFlow = (input.airflow_m3h / 3600) * rho;
  const tAirOutC = input.t_ambient_c + (massFlow > 0 ? input.heat_rejection_w / (massFlow * cp) : 0);
  const lmtdK = calcLMTD(input.tc_c, input.tc_c, input.t_ambient_c, tAirOutC);
  const totalAreaM2 = estimateTotalArea(finnedHeightMm, finnedLengthMm, rows, finSpacingMm, tubeDiameterMm, DEFAULT_PITCH_TRANSVERSE_MM);
  const heatRejectionW = uEst * totalAreaM2 * lmtdK;
  const dpAirPa = rows * 12 * Math.pow(faceVelocityMs / 3.0, 1.8);
  return {
    heat_rejection_w: heatRejectionW,
    t_air_out_c: tAirOutC,
    exchange_area_m2: totalAreaM2,
    finned_area_m2: totalAreaM2 * 0.85,
    lmtd_k: lmtdK,
    u_overall_w_m2k: uEst,
    dp_air_pa: dpAirPa,
    face_velocity_ms: faceVelocityMs,
    warnings,
  };
}
