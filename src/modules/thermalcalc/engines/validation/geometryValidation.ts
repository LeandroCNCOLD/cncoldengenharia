import type { CoilGeometryInput, ValidationWarning } from "../../types";

export function validatePositiveNumber(
  value: number | undefined,
  path: string,
  label: string,
  code = "INVALID_POSITIVE_NUMBER",
): ValidationWarning[] {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return [
      {
        code,
        severity: "error",
        path,
        message: `${label} deve ser maior que zero.`,
      },
    ];
  }

  return [];
}

export function validateCircuits(input: CoilGeometryInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const totalTubes = input.tube.rows * input.tube.tubesPerRow - (input.tube.skippedTubes ?? 0);

  warnings.push(
    ...validatePositiveNumber(input.tube.circuits, "tube.circuits", "Número de circuitos"),
  );

  if (Number.isFinite(totalTubes) && Number.isFinite(input.tube.circuits)) {
    if (input.tube.circuits > totalTubes) {
      warnings.push({
        code: "CIRCUITS_EXCEED_TUBES",
        severity: "error",
        path: "tube.circuits",
        message: "Número de circuitos não pode exceder o total de tubos ativos.",
      });
    }

    if (input.tube.circuits > 0 && totalTubes % input.tube.circuits !== 0) {
      warnings.push({
        code: "CIRCUITS_NOT_DIVISIBLE",
        severity: "warning",
        path: "tube.circuits",
        message: "Total de tubos ativos não é divisível pelo número de circuitos.",
      });
    }
  }

  return warnings;
}

export function validateGeometry(input: CoilGeometryInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [
    ...validatePositiveNumber(
      input.tube.outerDiameterMm,
      "tube.outerDiameterMm",
      "Diâmetro externo",
    ),
    ...validatePositiveNumber(input.tube.usefulLengthMm, "tube.usefulLengthMm", "Comprimento útil"),
    ...validatePositiveNumber(input.tube.rows, "tube.rows", "Número de fileiras"),
    ...validatePositiveNumber(input.tube.tubesPerRow, "tube.tubesPerRow", "Tubos por fileira"),
    ...validatePositiveNumber(
      input.fin.finPitchMm,
      "fin.finPitchMm",
      "Espaçamento entre aletas",
      "INVALID_FIN_PITCH",
    ),
    ...validateCircuits(input),
  ];

  if (input.tube.wallThicknessMm == null && input.tube.innerDiameterMm == null) {
    warnings.push({
      code: "MISSING_INNER_DIAMETER_SOURCE",
      severity: "error",
      path: "tube.innerDiameterMm",
      message: "Informe diâmetro interno ou espessura de parede para calcular o diâmetro interno.",
    });
  }

  if (input.tube.wallThicknessMm != null && input.tube.wallThicknessMm <= 0) {
    warnings.push({
      code: "INVALID_WALL_THICKNESS",
      severity: "error",
      path: "tube.wallThicknessMm",
      message: "Espessura de parede deve ser maior que zero.",
    });
  }

  if (
    input.tube.innerDiameterMm != null &&
    input.tube.innerDiameterMm >= input.tube.outerDiameterMm
  ) {
    warnings.push({
      code: "INNER_DIAMETER_NOT_SMALLER",
      severity: "error",
      path: "tube.innerDiameterMm",
      message: "Diâmetro interno deve ser menor que o diâmetro externo.",
    });
  }

  if (
    input.tube.wallThicknessMm != null &&
    input.tube.outerDiameterMm - 2 * input.tube.wallThicknessMm <= 0
  ) {
    warnings.push({
      code: "INVALID_INNER_DIAMETER",
      severity: "error",
      path: "tube.wallThicknessMm",
      message: "Espessura de parede não pode ser maior ou igual ao raio externo.",
    });
  }

  if ((input.tube.skippedTubes ?? 0) < 0) {
    warnings.push({
      code: "NEGATIVE_SKIPPED_TUBES",
      severity: "error",
      path: "tube.skippedTubes",
      message: "Tubos saltados não pode ser negativo.",
    });
  }

  if ((input.tube.skippedTubes ?? 0) >= input.tube.rows * input.tube.tubesPerRow) {
    warnings.push({
      code: "SKIPPED_TUBES_EXCEED_TOTAL",
      severity: "error",
      path: "tube.skippedTubes",
      message: "Tubos saltados deve ser menor que o total de tubos.",
    });
  }

  if (input.fin.finThicknessMm != null && input.fin.finThicknessMm >= input.fin.finPitchMm) {
    warnings.push({
      code: "FIN_THICKNESS_EXCEEDS_PITCH",
      severity: "warning",
      path: "fin.finThicknessMm",
      message: "Espessura da aleta está maior ou igual ao espaçamento entre aletas.",
    });
  }

  return warnings;
}

export function hasBlockingWarnings(warnings: ValidationWarning[]): boolean {
  return warnings.some((warning) => warning.severity === "error");
}

export const validateCoilGeometry = validateGeometry;
