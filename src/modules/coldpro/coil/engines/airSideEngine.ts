import type { CoilCalculationInput, FinType } from './types';

export function getAirProperties(Tc: number) {
  const Tk = Tc + 273.15;
  return {
    density: 1.2929 * (273.15 / Tk),
    viscosity: (1.458e-6 * Math.pow(Tk, 1.5)) / (Tk + 110.4),
    specificHeat: 1006.0 + 0.0217 * Tc,
    conductivity: 0.02442 + 7.18e-5 * Tc,
    prandtl: 0.71,
  };
}

function hydraulicDiameterM(input: CoilCalculationInput): number {
  // Practical proxy for fin-and-tube air side. Can be replaced by exact free-flow area later.
  const g = input.geometry;
  return Math.max(0.002, Math.min(0.03, (g.finPitchMm / 1000) * 2.0));
}

function calcRe(rho: number, velocity: number, dh: number, mu: number): number {
  return (rho * velocity * dh) / mu;
}

function calcHtcLouver(input: CoilCalculationInput, velocity: number, props: ReturnType<typeof getAirProperties>) {
  const Dh = hydraulicDiameterM(input);
  const Re = calcRe(props.density, velocity, Dh, props.viscosity);
  const j = 0.02 * Math.pow(Math.max(Re, 1), -0.4);
  const h = (j * props.density * velocity * props.specificHeat) / Math.pow(props.prandtl, 2 / 3);
  return { hAir: h, Re, correlation: 'ChangWangLouverHTC_simplified' };
}

function calcHtcWavy(input: CoilCalculationInput, velocity: number, props: ReturnType<typeof getAirProperties>) {
  const Dh = hydraulicDiameterM(input);
  const Re = calcRe(props.density, velocity, Dh, props.viscosity);
  const Nu = 0.27 * Math.pow(Math.max(Re, 1), 0.63) * Math.pow(props.prandtl, 0.36);
  const h = (Nu * props.conductivity) / Dh;
  return { hAir: h, Re, correlation: 'WangHerringboneWavyHTC_simplified' };
}

function selectFinType(finType: FinType): FinType {
  return finType && finType !== 'unknown' ? finType : 'wavy';
}

export function calculateAirSide(input: CoilCalculationInput, frontalAreaM2: number) {
  const meanAirTemp = (input.airInletTempC + (input.airOutletTempC ?? input.airInletTempC - 5)) / 2;
  const props = getAirProperties(meanAirTemp);
  const airFlowM3s = input.airflowM3h / 3600;
  const faceVelocity = frontalAreaM2 > 0 ? airFlowM3s / frontalAreaM2 : 0;

  let raw = input.hAirOverrideWm2K
    ? { hAir: input.hAirOverrideWm2K, Re: 0, correlation: 'manual_h_air' }
    : selectFinType(input.geometry.finType) === 'louver'
      ? calcHtcLouver(input, faceVelocity, props)
      : calcHtcWavy(input, faceVelocity, props);

  if (input.wet) {
    raw = { ...raw, hAir: raw.hAir * 0.85, correlation: `${raw.correlation}_wet_factor` };
  }

  const f = input.factors ?? {};
  const velDelta = faceVelocity - 3.0;
  const fatCorAl = (f.fatCorAl ?? 1) + (f.slopeFatCorAl ?? 0) * velDelta;
  const fatRidAumSup = f.fatRidAumSup ?? 1;
  const hAirCorrected = raw.hAir * fatCorAl * fatRidAumSup;

  return {
    ...props,
    faceVelocityMs: faceVelocity,
    hAirBaseWm2K: raw.hAir,
    hAirWm2K: hAirCorrected,
    reynoldsAir: raw.Re,
    correlationAir: raw.correlation,
    factors: { fatCorAl, fatRidAumSup },
  };
}
