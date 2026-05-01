export interface ReynoldsParams {
  density_kg_m3: number;
  velocity_m_s: number;
  hydraulicDiameter_m: number;
  viscosity_pa_s: number;
}

export function calculateReynolds(params: ReynoldsParams): number {
  if (params.viscosity_pa_s <= 0) return 0;
  return (
    (params.density_kg_m3 * params.velocity_m_s * params.hydraulicDiameter_m) /
    params.viscosity_pa_s
  );
}

export interface PrandtlParams {
  cp_j_kg_k: number;
  viscosity_pa_s: number;
  conductivity_w_m_k: number;
}

export function calculatePrandtl(params: PrandtlParams): number {
  if (params.conductivity_w_m_k <= 0) return 0;
  return (params.cp_j_kg_k * params.viscosity_pa_s) / params.conductivity_w_m_k;
}

export interface NusseltGnielinskiParams {
  reynolds: number;
  prandtl: number;
  frictionFactor: number;
}

export interface NusseltResult {
  nusselt: number;
  warnings: string[];
}

export function calculateNusseltGnielinski(params: NusseltGnielinskiParams): NusseltResult {
  const { reynolds, prandtl, frictionFactor } = params;
  const warnings: string[] = [];

  if (reynolds < 1000) {
    warnings.push(`Reynolds muito baixo (${reynolds.toFixed(0)}); usando Nusselt fallback`);
    return { nusselt: 3.66, warnings };
  }

  if (reynolds < 2300) {
    warnings.push(`Reynolds em regime laminar (${reynolds.toFixed(0)})`);
  }

  const f8 = frictionFactor / 8;
  const reAdj = Math.max(reynolds - 1000, 1);
  const numerator = f8 * reAdj * prandtl;
  const denominator = 1 + 12.7 * Math.sqrt(f8) * (Math.pow(prandtl, 2 / 3) - 1);

  if (denominator <= 0) {
    warnings.push("Denominador Gnielinski <= 0; usando fallback");
    return { nusselt: 3.66, warnings };
  }

  const nusselt = Math.max(numerator / denominator, 0.1);
  return { nusselt, warnings };
}

export interface ConvectiveCoefficientParams {
  nusselt: number;
  conductivity_w_m_k: number;
  hydraulicDiameter_m: number;
}

export function calculateConvectiveCoefficient(params: ConvectiveCoefficientParams): number {
  if (params.hydraulicDiameter_m <= 0) return 0;
  return (params.nusselt * params.conductivity_w_m_k) / params.hydraulicDiameter_m;
}
