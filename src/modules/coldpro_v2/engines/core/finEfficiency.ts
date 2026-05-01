export interface FinEfficiencyParams {
  h_air_w_m2k: number;
  finConductivity_w_mk: number;
  finThickness_m: number;
}

export interface FinEfficiencyResult {
  finEfficiency: number;
  warnings: string[];
}

export function calculateFinEfficiencySimplified(params: FinEfficiencyParams): FinEfficiencyResult {
  const { h_air_w_m2k, finConductivity_w_mk, finThickness_m } = params;
  const warnings: string[] = [];

  if (finConductivity_w_mk <= 0 || finThickness_m <= 0 || h_air_w_m2k <= 0) {
    warnings.push(
      "Dados insuficientes para cálculo de eficiência de aleta; usando valor conservador 0.85",
    );
    return { finEfficiency: 0.85, warnings };
  }

  const m = Math.sqrt((2 * h_air_w_m2k) / (finConductivity_w_mk * finThickness_m));

  const mL = m * 0.01;
  const eta = mL > 0 ? Math.tanh(mL) / mL : 1;

  const clamped = Math.max(0, Math.min(1, eta));

  if (clamped < 0.5) {
    warnings.push(`Eficiência de aleta muito baixa (${clamped.toFixed(3)})`);
  }

  return { finEfficiency: clamped, warnings };
}
