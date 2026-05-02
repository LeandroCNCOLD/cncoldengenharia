// Validações simples para inputs de formulário do frontend.
// NUNCA replicar regras de validação do motor — essas validações são apenas
// para feedback imediato na UI antes de enviar pro engine.

export interface FieldValidation {
  readonly valid: boolean;
  readonly message: string | null;
}

const OK: FieldValidation = { valid: true, message: null };

function fail(message: string): FieldValidation {
  return { valid: false, message };
}

export function validateRequired(value: unknown): FieldValidation {
  if (value === null || value === undefined) return fail("Campo obrigatório.");
  if (typeof value === "string" && value.trim() === "") {
    return fail("Campo obrigatório.");
  }
  return OK;
}

export function validateNumberRange(
  value: number | null | undefined,
  min: number,
  max: number,
): FieldValidation {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fail("Valor numérico inválido.");
  }
  if (!Number.isFinite(value)) return fail("Valor deve ser finito.");
  if (value < min) return fail(`Mínimo permitido: ${min}.`);
  if (value > max) return fail(`Máximo permitido: ${max}.`);
  return OK;
}

export function validatePositiveNumber(value: number | null | undefined): FieldValidation {
  if (value === null || value === undefined) return fail("Campo obrigatório.");
  if (!Number.isFinite(value)) return fail("Valor inválido.");
  if (value <= 0) return fail("Deve ser maior que zero.");
  return OK;
}

export function validateTemperatureC(value: number | null | undefined): FieldValidation {
  return validateNumberRange(value, -80, 120);
}

export function validateNonEmptyString(
  value: string | null | undefined,
  maxLength = 255,
): FieldValidation {
  const required = validateRequired(value);
  if (!required.valid) return required;
  if ((value as string).length > maxLength) {
    return fail(`Máximo de ${maxLength} caracteres.`);
  }
  return OK;
}

export function combineValidations(...results: readonly FieldValidation[]): FieldValidation {
  for (const r of results) {
    if (!r.valid) return r;
  }
  return OK;
}
