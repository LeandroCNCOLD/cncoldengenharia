export type NominalGuardInput = {
  datasheetCapacityW: number;
  simulatedCapacityW: number;
  tolerancePercent?: number;
};

export type NominalGuardResult = {
  ok: boolean;
  deviationPercent: number;
  message: string;
};

export function validateNominalPoint(input: NominalGuardInput): NominalGuardResult {
  const tolerance = input.tolerancePercent ?? 5;
  if (!input.datasheetCapacityW || input.datasheetCapacityW <= 0) {
    return { ok: false, deviationPercent: Number.POSITIVE_INFINITY, message: 'Capacidade nominal do datasheet ausente ou inválida.' };
  }
  const deviation = ((input.simulatedCapacityW - input.datasheetCapacityW) / input.datasheetCapacityW) * 100;
  const ok = Math.abs(deviation) <= tolerance;
  return {
    ok,
    deviationPercent: deviation,
    message: ok
      ? `Ponto nominal validado: desvio ${deviation.toFixed(2)}%.`
      : `Mapa não reproduz ponto nominal Unilab: desvio ${deviation.toFixed(2)}%.`,
  };
}
