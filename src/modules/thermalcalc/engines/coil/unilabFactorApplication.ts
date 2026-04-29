import type {
  AppliedUnilabFactors,
  CoilBaseResult,
  FactorApplicationContext,
  UnilabGeometryFactor,
} from '../unilabData/types';

const clamp = (v: number, min = 0.2, max = 5) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : 1));

function velocityAdjusted(base: number, slope: number, current?: number, nominal?: number): number {
  if (!current || !nominal || !Number.isFinite(current) || !Number.isFinite(nominal) || nominal <= 0) {
    return base;
  }
  const delta = current - nominal;
  return base + slope * delta;
}

export function computeUnilabFactors(
  f: UnilabGeometryFactor | null | undefined,
  ctx: FactorApplicationContext,
): AppliedUnilabFactors {
  if (!f) {
    return {
      heatTransferFactor: 1,
      surfaceFactor: 1,
      securityFactor: 1,
      airPressureDropFactor: 1,
      refrigerantPressureDropFactor: 1,
      effectiveCapacityFactor: 1,
      factorDetails: {},
      warnings: ['Sem fatores de geometria Unilab; resultado continua estimado.'],
    };
  }

  const fatCorAl = clamp(velocityAdjusted(f.fatCorAl, f.slopeFatCorAl, ctx.currentFaceVelocityMs, ctx.nominalFaceVelocityMs));
  const fatCoefTubo = clamp(velocityAdjusted(f.fatCoefLatoTubo, f.slopeFatCoefLatoTubo, ctx.currentFaceVelocityMs, ctx.nominalFaceVelocityMs));
  const fatRidAumSup = clamp(f.fatRidAumSup);
  const security = clamp(f.securityFactor, 0.5, 1.2);
  const airAttrBase = ctx.isWetCoil ? f.fattoreAttrAriaLatente || f.fattoreAttrAria : f.fattoreAttrAria;
  const airDp = clamp(velocityAdjusted(airAttrBase, f.slopeFattoreAttrAria, ctx.currentFaceVelocityMs, ctx.nominalFaceVelocityMs));
  const refDp = clamp(velocityAdjusted(f.fatCorrFatAttr, f.slopeFatCorrFatAttr, ctx.currentFaceVelocityMs, ctx.nominalFaceVelocityMs));

  const heatTransferFactor = clamp(fatCorAl * fatCoefTubo, 0.2, 5);
  const surfaceFactor = clamp(fatRidAumSup, 0.2, 5);
  const effectiveCapacityFactor = clamp(heatTransferFactor * surfaceFactor * security, 0.1, 5);

  return {
    heatTransferFactor,
    surfaceFactor,
    securityFactor: security,
    airPressureDropFactor: airDp,
    refrigerantPressureDropFactor: refDp,
    effectiveCapacityFactor,
    factorDetails: {
      FatCorAl: fatCorAl,
      FatCoeflattub: fatCoefTubo,
      FatRidAumSup: fatRidAumSup,
      SecurityFactor: security,
      FattoreAttrAria: f.fattoreAttrAria,
      FattoreAttrAriaLatente: f.fattoreAttrAriaLatente,
      FatCorrFatAttr: f.fatCorrFatAttr,
      Factor_A0: f.factorA0,
      Factor_A1: f.factorA1,
      Factor_A2: f.factorA2,
      Factor_FATC: f.factorFatc,
    },
    warnings: [],
  };
}

export function applyUnilabGeometryFactorsToResult<T extends CoilBaseResult>(
  base: T,
  geometryFactor: UnilabGeometryFactor | null | undefined,
  ctx: FactorApplicationContext,
): T & { unilabFactors: AppliedUnilabFactors } {
  const factors = computeUnilabFactors(geometryFactor, ctx);
  const result: CoilBaseResult = { ...base };

  if (typeof result.capacityW === 'number') {
    result.capacityW = result.capacityW * factors.effectiveCapacityFactor;
    result.capacityKcalh = result.capacityW * 0.859845;
  }

  if (typeof result.uGlobalWm2K === 'number') {
    result.uGlobalWm2K = result.uGlobalWm2K * factors.heatTransferFactor;
  }

  if (typeof result.hAirWm2K === 'number') {
    result.hAirWm2K = result.hAirWm2K * factors.factorDetails.FatCorAl;
  }

  if (typeof result.hRefWm2K === 'number') {
    result.hRefWm2K = result.hRefWm2K * factors.factorDetails.FatCoeflattub;
  }

  if (typeof result.externalAreaM2 === 'number') {
    result.externalAreaM2 = result.externalAreaM2 * factors.surfaceFactor;
  }

  if (typeof result.airPressureDropPa === 'number') {
    result.airPressureDropPa = result.airPressureDropPa * factors.airPressureDropFactor;
  }

  if (typeof result.refrigerantPressureDropKpa === 'number') {
    result.refrigerantPressureDropKpa = result.refrigerantPressureDropKpa * factors.refrigerantPressureDropFactor;
  }

  result.warnings = [...(base.warnings ?? []), ...factors.warnings];
  return { ...(result as T), unilabFactors: factors };
}
