export interface FrictionFactorParams {
  reynolds: number;
  roughness_m: number;
  hydraulicDiameter_m: number;
}

export function calculateDarcyFrictionFactor(params: FrictionFactorParams): number {
  const { reynolds, roughness_m, hydraulicDiameter_m } = params;

  if (reynolds <= 0) return 0.02;

  if (reynolds < 2300) {
    return 64 / reynolds;
  }

  const relRoughness = hydraulicDiameter_m > 0 ? roughness_m / hydraulicDiameter_m : 0;

  let f = 0.02;
  const MAX_ITER = 50;
  const TOL = 1e-6;

  for (let i = 0; i < MAX_ITER; i++) {
    if (f <= 0) {
      f = 0.02;
      break;
    }

    const sqrtF = Math.sqrt(f);
    const lhs = 1 / sqrtF;
    const rhs = -2 * Math.log10(relRoughness / 3.7 + 2.51 / (reynolds * sqrtF));

    const fNew = 1 / (rhs * rhs);

    if (Math.abs(fNew - f) < TOL) {
      f = fNew;
      break;
    }

    f = fNew;
  }

  if (!Number.isFinite(f) || f <= 0) {
    f = 0.02;
  }

  return f;
}
