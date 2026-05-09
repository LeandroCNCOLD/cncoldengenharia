/**
 * coilSizingService.ts
 *
 * Dimensionamento simplificado de evaporador e condensador aletados.
 *
 * Usa LMTD + U estimado para calcular capacidade e área de troca.
 * Integra com computeFinnedExternalArea para área real com aletas.
 *
 * Referências:
 *   - Incropera et al. (2011) — Fundamentals of Heat and Mass Transfer, 7th ed.
 *   - Wang et al. (2000) — Plain fin heat exchangers
 *   - ASHRAE Handbook Fundamentals (2017) — Cap. 4
 */
import { computeFinnedExternalArea } from "@/modules/coldpro_v2/engines/core/finnedExternalArea";
import type {
  EvaporatorSizingInput,
  EvaporatorSizingResult,
  CondenserSizingInput,
  CondenserSizingResult,
} from "../types/application-engineering.types";

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Passo transversal padrão (mm) para tubo 9.52 mm */
const DEFAULT_PITCH_TRANSVERSE_MM = 25.4;
/** Passo longitudinal padrão (mm) para tubo 9.52 mm */
const DEFAULT_PITCH_LONGITUDINAL_MM = 22.0;
/** Espessura da aleta padrão (mm) */
const DEFAULT_FIN_THICKNESS_MM = 0.12;
/** Densidade do ar (kg/m³) a 0°C */
const RHO_AIR = 1.29;
/** Calor específico do ar (J/kg·K) */
const CP_AIR = 1006;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcula LMTD para trocador contracorrente.
 * ΔT1 = T_fluid_in - T_air_out
 * ΔT2 = T_fluid_out - T_air_in
 */
function calcLMTD(
  tFluidIn: number,
  tFluidOut: number,
  tAirIn: number,
  tAirOut: number,
): number {
  const dt1 = Math.abs(tFluidIn - tAirOut);
  const dt2 = Math.abs(tFluidOut - tAirIn);
  if (Math.abs(dt1 - dt2) < 0.01) return dt1;
  if (dt1 <= 0 || dt2 <= 0) return Math.max(dt1, dt2, 0.1);
  return (dt1 - dt2) / Math.log(dt1 / dt2);
}

/**
 * Estima U global para evaporador (W/m²·K).
 * Baseado em correlações empíricas para coils aletados de refrigeração.
 */
function estimateUEvaporator(
  faceVelocityMs: number,
  finSpacingMm: number,
): number {
  // U típico: 20–45 W/m²·K para evaporadores DX aletados
  // Aumenta com velocidade do ar, diminui com espaçamento maior
  const uBase = 30;
  const velocityFactor = Math.min(1.5, Math.max(0.7, faceVelocityMs / 2.5));
  const spacingFactor = Math.min(1.2, Math.max(0.8, 4.0 / finSpacingMm));
  return uBase * velocityFactor * spacingFactor;
}

/**
 * Estima U global para condensador (W/m²·K).
 * Condensadores têm U maior que evaporadores (sem fase bifásica no ar).
 */
function estimateUCondenser(
  faceVelocityMs: number,
  finSpacingMm: number,
): number {
  // U típico: 35–65 W/m²·K para condensadores aletados
  const uBase = 45;
  const velocityFactor = Math.min(1.5, Math.max(0.7, faceVelocityMs / 3.0));
  const spacingFactor = Math.min(1.2, Math.max(0.8, 2.5 / finSpacingMm));
  return uBase * velocityFactor * spacingFactor;
}

// ─── Evaporador ───────────────────────────────────────────────────────────────

export function sizeEvaporator(
  input: EvaporatorSizingInput,
): EvaporatorSizingResult {
  const warnings: string[] = [];

  const rows = input.rows ?? 4;
  const tubesPerRow = input.tubes_per_row ?? 20;
  const finSpacingMm = input.fin_spacing_mm ?? 4.5;
  const lengthMm = input.length_mm ?? 1000;
  const tubeDiameterMm = input.tube_diameter_mm ?? 9.52;
  const rh = input.rh_air_pct ?? 85;

  // Área da face aletada
  const faceAreaM2 =
    (tubesPerRow * DEFAULT_PITCH_TRANSVERSE_MM * 1e-3) *
    (lengthMm * 1e-3);

  // Velocidade do ar na face
  const airflowM3s = input.airflow_m3h / 3600;
  const faceVelocityMs = airflowM3s / Math.max(faceAreaM2, 0.01);

  if (faceVelocityMs < 1.0) {
    warnings.push(`Velocidade do ar na face=${faceVelocityMs.toFixed(2)} m/s baixa — considere reduzir a área ou aumentar a vazão.`);
  }
  if (faceVelocityMs > 4.5) {
    warnings.push(`Velocidade do ar na face=${faceVelocityMs.toFixed(2)} m/s alta — risco de arraste de gotículas.`);
  }

  // Temperatura de saída do ar (balanço de energia)
  const massFlowAirKgS = airflowM3s * RHO_AIR;
  const tAirOut =
    input.t_air_in_c -
    input.required_capacity_w / (massFlowAirKgS * CP_AIR);

  // LMTD (evaporador: fluido a Te constante, ar resfriando)
  const lmtd = calcLMTD(
    input.te_c,
    input.te_c,
    tAirOut,
    input.t_air_in_c,
  );

  if (lmtd < 1) {
    warnings.push("LMTD muito baixo — verifique Te e temperaturas do ar.");
  }

  // Área com aletas
  const finnedArea = computeFinnedExternalArea({
    rows,
    tubes_per_row: tubesPerRow,
    length_mm: lengthMm,
    tube_diameter_mm: tubeDiameterMm,
    tube_pitch_transverse_mm: DEFAULT_PITCH_TRANSVERSE_MM,
    tube_pitch_longitudinal_mm: DEFAULT_PITCH_LONGITUDINAL_MM,
    fin_spacing_mm: finSpacingMm,
    fin_thickness_mm: DEFAULT_FIN_THICKNESS_MM,
  });

  finnedArea.warnings.forEach((w) => warnings.push(w));

  // U estimado
  const uOverall = estimateUEvaporator(faceVelocityMs, finSpacingMm);

  // Capacidade calculada com a geometria fornecida
  const capacityW = uOverall * finnedArea.A_total_m2 * lmtd;

  // Queda de pressão do ar (estimativa empírica)
  const dpAirPa = rows * 15 * Math.pow(faceVelocityMs / 2.5, 1.8);

  if (capacityW < input.required_capacity_w * 0.9) {
    warnings.push(
      `Capacidade calculada=${(capacityW / 1000).toFixed(2)} kW abaixo do requerido=${(input.required_capacity_w / 1000).toFixed(2)} kW — aumente filas ou comprimento.`,
    );
  }

  // Estimativa de carga de gelo (simplificada, baseada em umidade e área)
  const frostLoadKg = rh > 80 ? finnedArea.A_total_m2 * 0.3 : 0;

  return {
    capacity_w: capacityW,
    t_air_out_c: tAirOut,
    exchange_area_m2: finnedArea.A_total_m2,
    finned_area_m2: finnedArea.A_fin_m2,
    lmtd_k: lmtd,
    u_overall_w_m2k: uOverall,
    dp_air_pa: dpAirPa,
    face_velocity_ms: faceVelocityMs,
    frost_load_kg: frostLoadKg,
    warnings,
  };
}

// ─── Condensador ──────────────────────────────────────────────────────────────

export function sizeCondenser(
  input: CondenserSizingInput,
): CondenserSizingResult {
  const warnings: string[] = [];

  const rows = input.rows ?? 2;
  const tubesPerRow = input.tubes_per_row ?? 20;
  const finSpacingMm = input.fin_spacing_mm ?? 2.0;
  const lengthMm = input.length_mm ?? 1200;
  const tubeDiameterMm = input.tube_diameter_mm ?? 9.52;

  // Área da face aletada
  const faceAreaM2 =
    (tubesPerRow * DEFAULT_PITCH_TRANSVERSE_MM * 1e-3) *
    (lengthMm * 1e-3);

  // Velocidade do ar na face
  const airflowM3s = input.airflow_m3h / 3600;
  const faceVelocityMs = airflowM3s / Math.max(faceAreaM2, 0.01);

  if (faceVelocityMs < 1.5) {
    warnings.push(`Velocidade do ar na face=${faceVelocityMs.toFixed(2)} m/s baixa para condensador.`);
  }
  if (faceVelocityMs > 5.0) {
    warnings.push(`Velocidade do ar na face=${faceVelocityMs.toFixed(2)} m/s muito alta para condensador.`);
  }

  // Temperatura de saída do ar
  const massFlowAirKgS = airflowM3s * RHO_AIR;
  const tAirOut =
    input.t_ambient_c +
    input.heat_rejection_w / (massFlowAirKgS * CP_AIR);

  // LMTD (condensador: fluido a Tc constante, ar aquecendo)
  const lmtd = calcLMTD(
    input.tc_c,
    input.tc_c,
    input.t_ambient_c,
    tAirOut,
  );

  if (lmtd < 1) {
    warnings.push("LMTD muito baixo — verifique Tc e temperatura ambiente.");
  }

  // Área com aletas
  const finnedArea = computeFinnedExternalArea({
    rows,
    tubes_per_row: tubesPerRow,
    length_mm: lengthMm,
    tube_diameter_mm: tubeDiameterMm,
    tube_pitch_transverse_mm: DEFAULT_PITCH_TRANSVERSE_MM,
    tube_pitch_longitudinal_mm: DEFAULT_PITCH_LONGITUDINAL_MM,
    fin_spacing_mm: finSpacingMm,
    fin_thickness_mm: DEFAULT_FIN_THICKNESS_MM,
  });

  finnedArea.warnings.forEach((w) => warnings.push(w));

  // U estimado
  const uOverall = estimateUCondenser(faceVelocityMs, finSpacingMm);

  // Calor rejeitado calculado
  const heatRejectionW = uOverall * finnedArea.A_total_m2 * lmtd;

  // Queda de pressão do ar
  const dpAirPa = rows * 12 * Math.pow(faceVelocityMs / 3.0, 1.8);

  if (heatRejectionW < input.heat_rejection_w * 0.9) {
    warnings.push(
      `Calor rejeitado calculado=${(heatRejectionW / 1000).toFixed(2)} kW abaixo do requerido=${(input.heat_rejection_w / 1000).toFixed(2)} kW — aumente filas ou comprimento.`,
    );
  }

  return {
    heat_rejection_w: heatRejectionW,
    t_air_out_c: tAirOut,
    exchange_area_m2: finnedArea.A_total_m2,
    finned_area_m2: finnedArea.A_fin_m2,
    lmtd_k: lmtd,
    u_overall_w_m2k: uOverall,
    dp_air_pa: dpAirPa,
    face_velocity_ms: faceVelocityMs,
    warnings,
  };
}
