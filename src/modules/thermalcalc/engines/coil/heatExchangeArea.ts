/**
 * Cálculo de área total de troca térmica considerando eficiência de aleta.
 *
 *   A_total = A_tubos + (A_aletas × eta_fin)
 *
 * eta_fin é estimado por modelo de aleta plana retangular equivalente:
 *   eta = tanh(m·L) / (m·L),    m = sqrt(2·h_air / (k_fin · t_fin))
 *
 * A "altura efetiva" da aleta L é estimada como meio-passo entre tubos
 * (raio equivalente da célula hexagonal/quadrada da aleta).
 */

import type { CoilGeometry } from "@/modules/thermalcalc/types/coilSimulatorTypes";
import { deriveCoilGeometry, type GeometryDerived } from "./geometryDerived";

export interface HeatExchangeArea {
  /** Área externa dos tubos (m²) */
  tubeAreaM2: number;
  /** Área bruta das aletas (m²) */
  finAreaM2: number;
  /** Eficiência de aleta (0..1) */
  finEfficiency: number;
  /** Área efetiva de troca = tubos + aletas × eta_fin (m²) */
  effectiveAreaM2: number;
  /** Área interna (lado refrigerante, m²) */
  internalAreaM2: number;
  derived: GeometryDerived;
}

const DEFAULT_K_FIN_AL = 237; // W/m·K alumínio
const DEFAULT_K_FIN_CU = 401; // cobre

function finConductivity(material?: string): number {
  const m = (material ?? "").toLowerCase();
  if (m.includes("cobre") || m.includes("copper")) return DEFAULT_K_FIN_CU;
  if (m.includes("inox") || m.includes("stain")) return 16;
  return DEFAULT_K_FIN_AL;
}

/**
 * Estima eficiência de aleta plana equivalente.
 * @param hAirWm2k coef. de troca lado ar (W/m²K)
 * @param geom geometria do coil
 */
export function estimateFinEfficiency(hAirWm2k: number, geom: CoilGeometry): number {
  const tFin = (geom.finThicknessMm ?? 0.12) / 1000; // m
  const Pt = (geom.tubeSpacingMm ?? 25) / 1000;      // passo transversal
  const Pl = (geom.rowSpacingMm ?? 22) / 1000;       // passo longitudinal
  const od = (geom.tubeOdMm ?? 9.5) / 1000;
  const kFin = finConductivity(geom.finMaterial);

  // Raio equivalente da célula da aleta (Schmidt) — simplificação
  // L_fin ≈ raio_eq − r_tubo
  const cellArea = Pt * Pl;
  const rEq = Math.sqrt(cellArea / Math.PI);
  const rTube = od / 2;
  const Lfin = Math.max(rEq - rTube, 0.002); // mínimo 2 mm

  if (tFin <= 0 || kFin <= 0 || hAirWm2k <= 0) return 1;

  const m = Math.sqrt((2 * hAirWm2k) / (kFin * tFin));
  const mL = m * Lfin;
  if (mL < 1e-6) return 1;
  const eta = Math.tanh(mL) / mL;
  // Clamp para faixa fisicamente plausível
  return Math.min(1, Math.max(0.4, eta));
}

/**
 * Calcula a área de troca total efetiva.
 *
 * Quando geometria insuficiente, retorna campos null/zero — o motor decide
 * o fallback. Nunca lança.
 */
export function calcHeatExchangeArea(
  geometry: CoilGeometry,
  hAirWm2k: number,
): HeatExchangeArea {
  const derived = deriveCoilGeometry(geometry);
  const tubeAreaM2 = derived.externalAreaTubesM2 ?? 0;
  const finAreaM2 = derived.externalAreaFinsM2 ?? 0;
  const internalAreaM2 = derived.internalAreaM2 ?? 0;

  const finEfficiency = finAreaM2 > 0 ? estimateFinEfficiency(hAirWm2k, geometry) : 1;
  const effectiveAreaM2 = tubeAreaM2 + finAreaM2 * finEfficiency;

  return {
    tubeAreaM2,
    finAreaM2,
    finEfficiency,
    effectiveAreaM2,
    internalAreaM2,
    derived,
  };
}
