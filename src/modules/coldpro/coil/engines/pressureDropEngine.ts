import type { CoilCalculationInput } from './types';

export function calculateAirPressureDrop(input: CoilCalculationInput, airDensity: number, faceVelocity: number) {
  if (!Number.isFinite(faceVelocity) || faceVelocity <= 0) return null;
  const f = input.factors ?? {};
  const baseFactor = input.wet ? (f.fattoreAttrAriaLatente ?? f.fattoreAttrAria ?? 1) : (f.fattoreAttrAria ?? 1);
  const slope = f.slopeFattoreAttrAria ?? 0;
  const factor = baseFactor + slope * (faceVelocity - 3.0);
  const base = input.geometry.rows * airDensity * Math.pow(faceVelocity, 2) / 2;
  return base * factor;
}

export function calculateRefrigerantPressureDrop(input: CoilCalculationInput) {
  const f = input.factors ?? {};
  const baseKpa = 2; // conservative placeholder until circuiting is available
  return baseKpa * (f.fatCorrFatAttr ?? 1);
}
