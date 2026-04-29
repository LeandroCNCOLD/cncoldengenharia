/**
 * Motor físico simples: Q = U · A · LMTD · CorrectionFactors
 *
 * Esta é a fundação calibrável. Usa correlações simplificadas
 * (não Wang/Cavallini ainda) — a calibração contra o ponto nominal
 * Unilab ajusta os fatores até atingir as metas (≤5% capacidade).
 *
 * Estimativas:
 *  - h_ar  (W/m²K): correlação simples baseada em velocidade frontal
 *  - h_ref (W/m²K): valor típico por fluido/lado (evap vs cond)
 *  - LMTD: assume Tref constante (mudança de fase)
 */

import type { CoilSimulatorInput, CoilSimulatorResult } from "./coilSimulatorTypes";
import { deriveCoilGeometry, type GeometryDerived } from "./geometryDerived";
import type { CalibrationFactors } from "./coilEngineTypes";
import { NEUTRAL_CALIBRATION, normalizeCalibrationFactors } from "./coilEngineTypes";
import { computeUnilabFactors } from "./unilabFactorApplication";
import {
  generateModelSignature,
  checkCalibrationValidity,
  ENGINE_NAME,
  ENGINE_VERSION,
  CORRELATION_SET_VERSION,
} from "./calibrationSignature";
import type {
  AppliedUnilabFactors,
  UnilabGeometryFactor,
} from "../unilabData/types";

const W_TO_KCALH = 0.859845;

export interface PhysicalSimpleOptions {
  calibration?: CalibrationFactors;
  /** Fatores reais de geometria do Unilab (aplicados ANTES da calibração fina). */
  unilabGeometryFactor?: UnilabGeometryFactor | null;
  /** Velocidade frontal nominal (para ajuste por slope). */
  nominalFaceVelocityMs?: number;
  /** Indicador de coil molhado (latente significativo) para escolher fator de ar correto. */
  isWetCoil?: boolean;
  componentItemId?: string;
  calibrationId?: string | null;
  nominalCapacityW?: number | null;
  logCalibration?: boolean;
  /** Fator opcional aplicado ao h_air (lado do ar) — controlado e rastreável. Default 1. */
  airSideCorrectionFactor?: number;
  /**
   * Assinatura do modelo associada à calibração `opts.calibration`.
   * Se diferente da assinatura atual gerada para os inputs, a calibração
   * NÃO será aplicada e um warning será adicionado.
   */
  calibrationSignature?: string | null;
}

interface MaterialProps { kTube: number; kFin: number }

function materialProps(tube?: string, fin?: string): MaterialProps {
  const tk = (tube ?? "").toLowerCase();
  const fk = (fin ?? "").toLowerCase();
  const kTube = tk.includes("alum") ? 237 : tk.includes("inox") ? 16 : tk.includes("aço") || tk.includes("aco") ? 50 : 401;
  const kFin = fk.includes("cobre") ? 401 : fk.includes("inox") ? 16 : 237;
  return { kTube, kFin };
}

/** Coef. ar lado externo (W/m²K) — correlação simplificada. */
function airSideHtc(faceVelMs: number | null): number {
  if (!faceVelMs || faceVelMs <= 0) return 35;
  // h ~ 25..80 W/m²K conforme velocidade frontal 1..4 m/s
  return Math.min(80, Math.max(20, 25 + 18 * faceVelMs));
}

/** Coef. interno típico para mudança de fase (W/m²K). */
function refSideHtc(coilType: "evaporator" | "condenser", refrigerant?: string): number {
  // Faixa típica para HFCs em DX: evap 1500-3500, cond 2000-5000
  if (coilType === "evaporator") return 2200;
  return 3200;
}

function airDensity(altitudeM?: number, atmKpa?: number, tC?: number): number {
  const T = (tC ?? 25) + 273.15;
  let p = atmKpa ? atmKpa * 1000 : null;
  if (!p) {
    const alt = altitudeM ?? 0;
    p = 101325 * Math.pow(1 - 2.25577e-5 * alt, 5.25588);
  }
  return p / (287.05 * T);
}

export interface PhysicalSimpleBreakdown {
  uWm2k: number;
  externalAreaM2: number;
  internalAreaM2: number;
  uaWk: number;
  lmtdK: number;
  qWraw: number;            // antes de Unilab e calibração
  qWafterUnilab: number;    // após fatores Unilab, antes da calibração fina
  qWcalibrated: number;     // após calibração fina
  airSideH: number;
  refSideH: number;
  faceVelocityMs: number | null;
  airMassFlowKgs: number | null;
  airDpRawPa: number | null;
  refDpRawKpa: number | null;
  // Rastreabilidade dos fatores aplicados
  heatTransferFactor: number;
  capacityCorrectionFactor: number;
  airDpCorrectionFactor: number;
  refDpCorrectionFactor: number;
  uaCorrectionFactor: number;
  // Fatores reais Unilab usados (ou null quando ausentes)
  unilabFactors: AppliedUnilabFactors | null;
}

export interface PhysicalSimpleResult extends CoilSimulatorResult {
  engine: "physical_simple";
  derived: GeometryDerived;
  breakdown: PhysicalSimpleBreakdown;
  /** Fatores Unilab aplicados (espelhado para componentes da UI). */
  unilabFactors: AppliedUnilabFactors | null;
}

export function simulatePhysicalSimple(
  input: CoilSimulatorInput,
  opts: PhysicalSimpleOptions = {},
): PhysicalSimpleResult {
  const requestedCal = normalizeCalibrationFactors(opts.calibration);
  const warnings: string[] = [];
  const derived = deriveCoilGeometry(input.geometry);

  const faceArea = derived.faceAreaM2;
  const aExt = derived.externalAreaM2;
  const aInt = derived.internalAreaM2;

  if (!faceArea) warnings.push("Geometria insuficiente para calcular área frontal.");
  if (!aExt || !aInt) warnings.push("Geometria insuficiente para áreas de troca — resultado físico aproximado.");

  // Vazão e velocidade
  const airflowM3h = input.air.airflowM3h ?? input.nominal?.airflowM3h ?? 0;
  const airflowM3s = airflowM3h / 3600;
  const faceVelocityMs = input.air.faceVelocityMs ?? (faceArea && faceArea > 0 ? airflowM3s / faceArea : null);
  const rho = input.air.airDensityKgM3 ?? airDensity(input.air.altitudeM, input.air.atmPressureKpa, input.air.airTempInC);
  const airMassFlowKgs = airflowM3s * rho;

  // Coeficientes
  // Lado do ar: correlação base + fator opcional rastreável (substitui o
  // hack temporário h_air * 2.5; default = 1).
  const airSideCorrectionFactor =
    Number.isFinite(opts.airSideCorrectionFactor) && (opts.airSideCorrectionFactor ?? 0) > 0
      ? (opts.airSideCorrectionFactor as number)
      : 1;
  const hArBase = airSideHtc(faceVelocityMs);
  const hAr = hArBase * airSideCorrectionFactor;
  const hRef = refSideHtc(input.coilType, input.refrigerant.refrigerant);
  const { kTube } = materialProps(input.geometry.tubeMaterial, input.geometry.finMaterial);

  // 1/U_ext = 1/h_ar + (A_ext/A_int) * 1/h_ref + R_parede + R_fouling
  const tubeWallM = (input.geometry.tubeWallMm ?? 0.5) / 1000;
  const rWall = tubeWallM / kTube; // simplificação plana
  const rFouling = ((input.foulingFactor ?? 1) - 1) >= 0 ? 0.0001 : 0; // padrão 1e-4

  const aRatio = aExt && aInt && aInt > 0 ? aExt / aInt : 15; // razão típica
  const invU = 1 / hAr + aRatio / hRef + rWall + rFouling;
  const uWm2k = 1 / invU;
  const uaWk = aExt ? uWm2k * aExt : 0;

  // LMTD assumindo Tref constante (mudança de fase) — modelo de coil cruzado simplificado
  const Tin = input.air.airTempInC ?? input.nominal?.airTempInC ?? 0;
  const Tref = input.refrigerant.refTempC ?? input.nominal?.refTempC ?? 0;
  const dt1 = Math.abs(Tin - Tref);
  // Estima saída por NTU
  let lmtdK = dt1;
  let Tout = Tin;
  if (uaWk > 0 && airMassFlowKgs > 0) {
    const cpAir = 1.006 * 1000; // J/kgK
    const cMin = airMassFlowKgs * cpAir;
    const ntu = uaWk / cMin;
    const eff = 1 - Math.exp(-ntu);
    Tout = input.coilType === "evaporator" ? Tin - eff * (Tin - Tref) : Tin + eff * (Tref - Tin);
    const dt2 = Math.abs(Tout - Tref);
    lmtdK = dt1 === dt2 ? dt1 : (dt1 - dt2) / Math.log(Math.max(dt1 / Math.max(dt2, 0.01), 1.0001));
  }

  // === Ordem de cálculo (CRÍTICA — não inverter): ===
  // 1) base físico (qWraw)
  // 2) fatores empíricos Unilab (heatTransfer × surface × security)
  // 3) calibração fina do componente (capacityCorrectionFactor)
  const qWraw = uaWk * lmtdK;

  const unilabFactors = computeUnilabFactors(opts.unilabGeometryFactor ?? null, {
    engine: "physical_simple",
    mode: input.coilType === "evaporator" ? "direct_expansion" : "condensing",
    isWetCoil: opts.isWetCoil,
    currentFaceVelocityMs: faceVelocityMs ?? undefined,
    nominalFaceVelocityMs: opts.nominalFaceVelocityMs,
  });

  const qBase = qWraw * unilabFactors.effectiveCapacityFactor * cal.uaCorrectionFactor;
  const qFinal = qBase * cal.capacityCorrectionFactor;

  if (opts.logCalibration) {
    // Log obrigatório de rastreabilidade da calibração ativa.
    // eslint-disable-next-line no-console
    console.log({
      componentItemId: opts.componentItemId,
      calibrationId: opts.calibrationId,
      capacityCorrectionFactor: cal.capacityCorrectionFactor,
      qBase,
      qFinal,
      nominalCapacityW: opts.nominalCapacityW,
    });
  }

  // Perdas de carga: base × Unilab × calibração
  const airDpBase = faceVelocityMs && input.geometry.rows
    ? 8 * input.geometry.rows * faceVelocityMs * faceVelocityMs
    : null;
  const airDpRawPa = airDpBase != null
    ? airDpBase * unilabFactors.airPressureDropFactor * cal.airPressureDropFactor
    : null;
  const refDpBase = derived.totalTubes
    ? 0.5 * (input.geometry.rows ?? 1)
    : null;
  const refDpRawKpa = refDpBase != null
    ? refDpBase * unilabFactors.refrigerantPressureDropFactor * cal.refrigerantPressureDropFactor
    : null;

  // Sensível/latente: assume sensível = m·cp·ΔT, latente = resto
  const sensibleW = airMassFlowKgs > 0 ? airMassFlowKgs * 1006 * Math.abs(Tin - Tout) : null;
  const latentW = sensibleW != null ? Math.max(qFinal - sensibleW, 0) : null;

  // Condensado (apenas evap)
  const condensateLh =
    input.coilType === "evaporator" && latentW != null
      ? (latentW / 2_500_000) * 3600
      : null;

  if (qFinal <= 0) warnings.push("Capacidade física calculada ≤ 0 — verifique geometria, vazão e ΔT.");
  if (faceVelocityMs && faceVelocityMs > 4) warnings.push(`Velocidade frontal alta (${faceVelocityMs.toFixed(2)} m/s).`);
  if (faceVelocityMs && faceVelocityMs < 1) warnings.push(`Velocidade frontal baixa (${faceVelocityMs.toFixed(2)} m/s).`);
  for (const w of unilabFactors.warnings) warnings.push(w);

  const dtNominal =
    input.nominal ? input.nominal.airTempInC - input.nominal.refTempC : dt1;

  return {
    engine: "physical_simple",
    coilType: input.coilType,
    capacityW: qFinal,
    capacityKcalh: qFinal * W_TO_KCALH,
    sensibleW,
    latentW,
    dtRealK: dt1,
    dtNominalK: dtNominal,
    faceAreaM2: faceArea ?? null,
    faceVelocityMs,
    airflowFactor:
      input.nominal && input.nominal.airflowM3h > 0 ? airflowM3h / input.nominal.airflowM3h : 1,
    dtFactor: dtNominal > 0 ? dt1 / dtNominal : 1,
    airPressureDropPa: airDpRawPa,
    refPressureDropKpa: refDpRawKpa,
    condensateLh,
    warnings,
    derived,
    unilabFactors: opts.unilabGeometryFactor ? unilabFactors : null,
    breakdown: {
      uWm2k,
      externalAreaM2: aExt ?? 0,
      internalAreaM2: aInt ?? 0,
      uaWk,
      lmtdK,
      qWraw,
      qWafterUnilab: qBase,
      qWcalibrated: qFinal,
      airSideH: hAr,
      refSideH: hRef,
      faceVelocityMs,
      airMassFlowKgs,
      airDpRawPa,
      refDpRawKpa,
      heatTransferFactor: unilabFactors.heatTransferFactor * cal.capacityCorrectionFactor,
      capacityCorrectionFactor: cal.capacityCorrectionFactor,
      airDpCorrectionFactor: cal.airPressureDropFactor,
      refDpCorrectionFactor: cal.refrigerantPressureDropFactor,
      uaCorrectionFactor: cal.uaCorrectionFactor,
      unilabFactors: opts.unilabGeometryFactor ? unilabFactors : null,
    },
  };
}
