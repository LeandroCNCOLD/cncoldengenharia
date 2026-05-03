// Validação leve de entradas do lado ar (Etapa 3).
// IMPORTANTE: cálculos termodinâmicos reais (entalpia, densidade, ponto de
// orvalho) ficam no engine (`engine/psychrometrics.ts`) e não devem ser
// duplicados aqui. Esta camada apenas verifica sanidade dos inputs do usuário.

export interface PsychrometricValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAirSideInputs(input: {
  tempInDB_C: number;
  rhIn_pct: number;
  foulingFactorAir: number;
}): PsychrometricValidationResult {
  const errors: string[] = [];

  if (input.tempInDB_C < -50 || input.tempInDB_C > 100) {
    errors.push("Temperatura de entrada deve estar entre -50°C e 100°C.");
  }

  if (input.rhIn_pct < 0 || input.rhIn_pct > 100) {
    errors.push("Umidade relativa deve estar entre 0% e 100%.");
  }

  if (input.foulingFactorAir < 0) {
    errors.push("Fator de fouling não pode ser negativo.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
