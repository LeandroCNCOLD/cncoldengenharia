import type { FieldValidation } from "../types/frontend.types";

export function validateEvapTemp(value: number | undefined): FieldValidation {
  if (value === undefined || value === null) {
    return { status: "error", message: "Campo obrigatório" };
  }
  if (value < -40 || value > 15) {
    return { status: "error", message: "Fora do intervalo válido: -40°C a +15°C" };
  }
  if (value < -30 || value > 10) {
    return { status: "warning", message: "Valor incomum. Faixa típica: -30°C a +10°C" };
  }
  return { status: "valid" };
}

export function validateCondTemp(value: number | undefined): FieldValidation {
  if (value === undefined || value === null) {
    return { status: "error", message: "Campo obrigatório" };
  }
  if (value < 20 || value > 60) {
    return { status: "error", message: "Fora do intervalo válido: 20°C a 60°C" };
  }
  if (value < 25 || value > 55) {
    return { status: "warning", message: "Valor incomum. Faixa típica: 25°C a 55°C" };
  }
  return { status: "valid" };
}

export function validateCapacityW(value: number | undefined): FieldValidation {
  if (value === undefined || value === null || value <= 0) {
    return { status: "error", message: "Capacidade deve ser maior que zero" };
  }
  if (value > 500000) {
    return { status: "warning", message: "Valor muito alto. Verificar unidade (W, não kW)" };
  }
  return { status: "valid" };
}

export function validateRequired(value: unknown): FieldValidation {
  if (value === undefined || value === null || value === "") {
    return { status: "error", message: "Campo obrigatório" };
  }
  return { status: "valid" };
}
