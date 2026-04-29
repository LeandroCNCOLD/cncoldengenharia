/**
 * Correlações para o coeficiente de troca lado ar (h_air, W/m²K).
 *
 *   selectAirHTC(context) → escolhe a correlação mais adequada à geometria.
 *
 * Correlações implementadas (forma simplificada, mas com ordem de grandeza
 * fisicamente correta — superior à reta linear genérica):
 *
 *  - Chang-Wang (louver fins): j-factor para aletas com persianas.
 *  - Wang-Herringbone (wavy/corrugada): j-factor para aletas onduladas.
 *  - Plain (fallback): correlação Wang plain-fin / linear suave.
 *
 *   h = j · G · cp · Pr^(-2/3)
 *      G = ρ · V_face   (kg/m²s baseado em área frontal)
 *      cp_ar = 1006 J/kgK,   Pr_ar = 0.71
 */

import type { CoilGeometry } from "./coilSimulatorTypes";

const CP_AIR = 1006;
const PR_AIR = 0.71;
const PR_AIR_M23 = Math.pow(PR_AIR, -2 / 3); // ≈ 1.258

export type AirHtcCorrelation = "chang-wang-louver" | "wang-herringbone" | "plain-fallback";

export interface AirHtcContext {
  geometry: CoilGeometry;
  faceVelocityMs: number | null;
  airDensityKgM3: number;
}

export interface AirHtcResult {
  hAirWm2k: number;
  correlation: AirHtcCorrelation;
  jFactor: number;
  reynolds: number;
}

function classifyFinSurface(g: CoilGeometry): AirHtcCorrelation {
  const corr = (g.finCorrugation ?? "").toLowerCase();
  const finType = (g.finType ?? "").toLowerCase();
  if (corr.includes("louver") || corr.includes("persian")) return "chang-wang-louver";
  if (
    corr.includes("wavy") ||
    corr.includes("herring") ||
    corr.includes("corrug") ||
    corr.includes("ondul") ||
    finType.includes("espiral")
  ) {
    return "wang-herringbone";
  }
  return "plain-fallback";
}

/** j-factor de Chang-Wang para louver fins (forma simplificada). */
function jChangWang(reD: number, finPitchMm: number, tubeOdMm: number): number {
  if (reD <= 0) return 0.02;
  const fpDp = Math.max(finPitchMm / Math.max(tubeOdMm, 1), 0.05);
  // Forma: j = 0.26712 · Re^-0.1944 · (Fp/Dp)^-0.0446 (simplificado)
  const j = 0.26712 * Math.pow(reD, -0.1944) * Math.pow(fpDp, -0.0446);
  return Math.min(0.05, Math.max(0.003, j));
}

/** j-factor de Wang para herringbone/wavy (forma simplificada). */
function jWangWavy(reD: number, finPitchMm: number, tubeOdMm: number, rows: number): number {
  if (reD <= 0) return 0.018;
  const fpDp = Math.max(finPitchMm / Math.max(tubeOdMm, 1), 0.05);
  // j = 0.394 · Re^-0.392 · (Fp/Dp)^-0.0449 · N^-0.0897
  const j =
    0.394 *
    Math.pow(reD, -0.392) *
    Math.pow(fpDp, -0.0449) *
    Math.pow(Math.max(rows, 1), -0.0897);
  return Math.min(0.05, Math.max(0.003, j));
}

/** Fallback: j-factor Wang plain-fin. */
function jPlain(reD: number): number {
  if (reD <= 0) return 0.012;
  const j = 0.14 * Math.pow(reD, -0.328);
  return Math.min(0.04, Math.max(0.003, j));
}

/** Seleciona e calcula h_air baseado na geometria + condições. */
export function selectAirHTC(ctx: AirHtcContext): AirHtcResult {
  const g = ctx.geometry;
  const correlation = classifyFinSurface(g);
  const v = ctx.faceVelocityMs && ctx.faceVelocityMs > 0 ? ctx.faceVelocityMs : 2.0;
  const rho = ctx.airDensityKgM3 > 0 ? ctx.airDensityKgM3 : 1.2;
  const odM = (g.tubeOdMm ?? 9.5) / 1000;
  // Viscosidade dinâmica do ar a ~20°C (Pa·s)
  const muAir = 1.81e-5;
  // Re baseado no diâmetro do tubo e velocidade frontal
  const G = rho * v;
  const reD = (G * odM) / muAir;

  let j: number;
  switch (correlation) {
    case "chang-wang-louver":
      j = jChangWang(reD, g.finPitchMm ?? 2.1, g.tubeOdMm ?? 9.5);
      break;
    case "wang-herringbone":
      j = jWangWavy(reD, g.finPitchMm ?? 2.1, g.tubeOdMm ?? 9.5, g.rows ?? 4);
      break;
    default:
      j = jPlain(reD);
  }

  // h = j · G · cp · Pr^-2/3
  const h = j * G * CP_AIR * PR_AIR_M23;

  // Faixa fisicamente plausível para coils aletados de ar
  const hClamped = Math.min(180, Math.max(25, h));

  return {
    hAirWm2k: hClamped,
    correlation,
    jFactor: j,
    reynolds: reD,
  };
}
