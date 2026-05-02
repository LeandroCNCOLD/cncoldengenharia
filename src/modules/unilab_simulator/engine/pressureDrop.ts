// Perda de carga lado ar (catálogo UNILAB) e lado fluido (Darcy-Weisbach
// simplificado, monofásico). Sem fallback silencioso para zero.

import type { PressureDropFanItem } from "../types/unilab.types";
import { mmToM, safeDivide, KPA_TO_PA } from "./units";

export interface AirPressureDropResult {
  pressureDropPa: number;
  warnings: string[];
}

export function calculateAirPressureDrop(
  geometryId: string,
  airVelocityMs: number,
  catalog: PressureDropFanItem[],
): AirPressureDropResult {
  const warnings: string[] = [];
  const item = catalog.find((c) => c.geometryId === geometryId);
  if (!item) {
    warnings.push(`Sem dados de perda de carga lado ar para ${geometryId}.`);
    return { pressureDropPa: NaN, warnings };
  }
  if (!Array.isArray(item.coefficients) || item.coefficients.length === 0) {
    warnings.push(`Coeficientes de perda de carga ausentes para ${geometryId}.`);
    return { pressureDropPa: NaN, warnings };
  }

  let v = airVelocityMs;
  if (Number.isFinite(item.vMin) && item.vMin !== undefined && v < item.vMin) {
    warnings.push(`Velocidade abaixo da faixa de perda de carga; usando vMin.`);
    v = item.vMin;
  }
  if (Number.isFinite(item.vMax) && item.vMax !== undefined && v > item.vMax) {
    warnings.push(`Velocidade acima da faixa de perda de carga; usando vMax.`);
    v = item.vMax;
  }

  let dp = 0;
  let powerOfV = 1;
  for (let i = 0; i < item.coefficients.length; i++) {
    const a = item.coefficients[i];
    if (a !== 0 && Number.isFinite(a)) dp += a * powerOfV;
    powerOfV *= v;
  }

  if (!Number.isFinite(dp) || dp < 0) {
    warnings.push(`Perda de carga lado ar inválida (${dp}).`);
    return { pressureDropPa: NaN, warnings };
  }
  return { pressureDropPa: dp, warnings };
}

export interface FluidPressureDropParams {
  estimatedMassFlowKgS: number;
  circuits: number;
  tubeInnerDiameterMm: number;
  tubeLengthM: number;
  fluidDensityKgM3?: number;
  fluidViscosityPaS?: number;
  frictionFactor?: number;
}

export interface FluidPressureDropResult {
  pressureDropKpa: number;
  warnings: string[];
}

/**
 * Estimativa de perda de carga monofásica pelo modelo de Darcy-Weisbach:
 *   ΔP = f · (L/D) · (ρ·v²)/2
 * Para escoamento bifásico (evaporação/condensação) o usuário deve fornecer
 * o fator de atrito apropriado; valores padrão são para refrigerante líquido.
 */
export function calculateFluidPressureDrop(
  params: FluidPressureDropParams,
): FluidPressureDropResult {
  const warnings: string[] = [];

  if (!Number.isFinite(params.circuits) || params.circuits <= 0) {
    return {
      pressureDropKpa: NaN,
      warnings: ["Número de circuitos inválido — não é possível estimar ΔP fluido."],
    };
  }
  if (!Number.isFinite(params.tubeInnerDiameterMm) || params.tubeInnerDiameterMm <= 0) {
    return {
      pressureDropKpa: NaN,
      warnings: ["Diâmetro interno do tubo ausente — não é possível estimar ΔP fluido."],
    };
  }
  if (!Number.isFinite(params.tubeLengthM) || params.tubeLengthM <= 0) {
    return {
      pressureDropKpa: NaN,
      warnings: ["Comprimento de tubo inválido — não é possível estimar ΔP fluido."],
    };
  }

  const rho = params.fluidDensityKgM3 ?? 1200; // refrigerante líquido típico
  const f = params.frictionFactor ?? 0.025; // tubo de cobre liso, regime turbulento moderado
  const dM = mmToM(params.tubeInnerDiameterMm);
  const areaM2 = (Math.PI * dM * dM) / 4;
  const massFlowPerCircuit = safeDivide(params.estimatedMassFlowKgS, params.circuits);
  const velocity = safeDivide(massFlowPerCircuit, rho * areaM2);

  const dpPa = f * (params.tubeLengthM / dM) * (rho * velocity * velocity) / 2;
  if (!Number.isFinite(dpPa) || dpPa < 0) {
    return { pressureDropKpa: NaN, warnings: ["ΔP fluido calculado inválido."] };
  }
  if (params.fluidDensityKgM3 === undefined || params.frictionFactor === undefined) {
    warnings.push(
      "ΔP do fluido estimado com densidade/atrito típicos de refrigerante líquido — refine com propriedades reais.",
    );
  }
  return { pressureDropKpa: dpPa / KPA_TO_PA, warnings };
}
