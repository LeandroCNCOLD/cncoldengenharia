// Validação leve do Lado Fluido (Etapa 4) — apenas sanidade dos inputs.
// Cálculos termodinâmicos reais ficam no engine.

export interface FluidSideValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFluidSideInputs(input: {
  fluid: string;
  fluidMassFlow_kg_h: number;
  fluidOperatingTemp_C: number;
  superheat_K: number;
  subcooling_K: number;
  foulingFactorFluid: number;
}): FluidSideValidationResult {
  const errors: string[] = [];

  if (!input.fluid || input.fluid.trim().length === 0) {
    errors.push("Fluido não informado.");
  }

  if (input.fluidMassFlow_kg_h < 0) {
    errors.push("Vazão mássica não pode ser negativa.");
  }

  if (input.fluidOperatingTemp_C < -100 || input.fluidOperatingTemp_C > 150) {
    errors.push(
      "Temperatura de operação do fluido deve estar entre -100°C e 150°C.",
    );
  }

  if (input.superheat_K < 0) {
    errors.push("Sobreaquecimento não pode ser negativo.");
  }

  if (input.subcooling_K < 0) {
    errors.push("Subresfriamento não pode ser negativo.");
  }

  if (input.foulingFactorFluid < 0) {
    errors.push("Fator de erro do fluido não pode ser negativo.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
