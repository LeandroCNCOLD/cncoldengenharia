import type { GeometryInput } from './types';

const PI = Math.PI;
const mm = (v: number) => v / 1000;

export function calculateFrontalAreaM2(g: GeometryInput): number {
  return mm(g.coilLengthMm) * mm(g.coilHeightMm);
}

export function calculateTotalTubes(g: GeometryInput): number {
  return Math.max(0, g.tubesPerRow * g.rows);
}

export function calculateTubeLengthTotalM(g: GeometryInput): number {
  return calculateTotalTubes(g) * mm(g.coilLengthMm);
}

export function calculateTubeExternalAreaM2(g: GeometryInput): number {
  return PI * mm(g.tubeOuterDiameterMm) * calculateTubeLengthTotalM(g);
}

export function calculateTubeInternalAreaM2(g: GeometryInput): number {
  return PI * mm(g.tubeInnerDiameterMm) * calculateTubeLengthTotalM(g);
}

export function calculateFinCount(g: GeometryInput): number {
  return Math.max(1, Math.floor(g.coilLengthMm / g.finPitchMm));
}

export function calculateFinGrossAreaM2(g: GeometryInput): number {
  // Approximate two-side fin area minus tube holes.
  const finCount = calculateFinCount(g);
  const facePerFin = mm(g.coilHeightMm) * (g.rows * mm(g.rowPitchMm));
  const tubeHoleArea = calculateTotalTubes(g) / finCount * (PI * Math.pow(mm(g.tubeOuterDiameterMm) / 2, 2));
  return Math.max(0, 2 * finCount * Math.max(0, facePerFin - tubeHoleArea));
}

export function calculateFinEfficiency(g: GeometryInput, hAirWm2K: number): number {
  const k = g.tubeMaterialConductivityWmK ?? 205; // default Al-like for fins when not separated
  const t = mm(g.finThicknessMm || 0.13);
  const L = mm(g.tubePitchMm) / 2;
  if (hAirWm2K <= 0 || k <= 0 || t <= 0 || L <= 0) return 0.85;
  const m = Math.sqrt((2 * hAirWm2K) / (k * t));
  const mL = m * L;
  if (mL < 1e-6) return 1;
  return Math.max(0.4, Math.min(1, Math.tanh(mL) / mL));
}

export function calculateEffectiveAreaM2(g: GeometryInput, hAirWm2K: number): {
  tubeExternalAreaM2: number;
  tubeInternalAreaM2: number;
  finAreaM2: number;
  finEfficiency: number;
  effectiveAreaM2: number;
  frontalAreaM2: number;
} {
  const tubeExternalAreaM2 = calculateTubeExternalAreaM2(g);
  const tubeInternalAreaM2 = calculateTubeInternalAreaM2(g);
  const finAreaM2 = calculateFinGrossAreaM2(g);
  const finEfficiency = calculateFinEfficiency(g, hAirWm2K);
  return {
    tubeExternalAreaM2,
    tubeInternalAreaM2,
    finAreaM2,
    finEfficiency,
    effectiveAreaM2: tubeExternalAreaM2 + finAreaM2 * finEfficiency,
    frontalAreaM2: calculateFrontalAreaM2(g),
  };
}
