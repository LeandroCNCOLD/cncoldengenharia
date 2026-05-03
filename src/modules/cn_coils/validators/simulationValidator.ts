import type {
  CnCoilsPhysicalInputs,
  CnCoilsSimulationResult,
  CnCoilsThermoInputs,
  ValidationResult,
} from "../types/cncoils.types";
import { ptBR } from "../i18n/messages.ptBR";

const m = ptBR.validation;

function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateDatasets(state: {
  ready: boolean;
  missing: string[];
}): ValidationResult {
  if (state.ready) return { isValid: true, errors: [] };
  return {
    isValid: false,
    errors: state.missing.map((f) => ptBR.datasets.fileMissing(f)),
  };
}

export function validatePhysicalInputs(
  inputs: Partial<CnCoilsPhysicalInputs>,
): ValidationResult {
  const errors: string[] = [];
  const f = ptBR.workspace.fields;

  if (!inputs.geometryId || inputs.geometryId.trim() === "") {
    return {
      isValid: false,
      errors: ["Selecione uma geometria antes de calcular."],
    };
  }

  if (!isPositive(inputs.finnedHeightMm)) errors.push(m.requiredField(f.finnedHeight));
  if (!isPositive(inputs.finnedLengthMm)) errors.push(m.requiredField(f.finnedLength));
  if (!isPositive(inputs.rows)) errors.push(m.requiredField(f.rows));
  if (!isPositive(inputs.circuits)) errors.push(m.requiredField(f.circuits));
  if (!inputs.tubeMaterialId) errors.push(m.requiredField(f.tubeMaterial));
  if (!isPositive(inputs.finPitchMm)) errors.push(m.requiredField(f.finPitch));
  if (!isPositive(inputs.finThicknessMm)) errors.push(m.requiredField(f.finThickness));
  if (!isPositive(inputs.tubePitchTransverseMm))
    errors.push(m.requiredField(f.tubePitchTransverse));
  if (!isPositive(inputs.tubePitchLongitudinalMm))
    errors.push(m.requiredField(f.tubePitchLongitudinal));
  if (!isPositive(inputs.tubeOuterDiameterMm))
    errors.push(m.requiredField(f.tubeOuterDiameter));
  if (!isPositive(inputs.tubeInnerDiameterMm))
    errors.push(m.requiredField(f.tubeInnerDiameter));

  return { isValid: errors.length === 0, errors };
}

export function validateThermoInputs(
  inputs: Partial<CnCoilsThermoInputs>,
): ValidationResult {
  const errors: string[] = [];
  const f = ptBR.workspace.fields;

  if (!inputs.refrigerantId) errors.push(m.requiredField(f.refrigerant));
  if (!isPositive(inputs.airFlowM3H)) errors.push(m.requiredField(f.airFlow));
  if (!isFiniteNumber(inputs.airInletTempC))
    errors.push(m.requiredField(f.airInletTemp));
  if (
    !isFiniteNumber(inputs.airInletRhPercent) ||
    (inputs.airInletRhPercent as number) < 0 ||
    (inputs.airInletRhPercent as number) > 100
  ) {
    errors.push(m.requiredField(f.airInletRh));
  }
  if (!isFiniteNumber(inputs.altitudeM)) errors.push(m.requiredField(f.altitude));

  if (
    !isFiniteNumber(inputs.evaporatingTempC) &&
    !isFiniteNumber(inputs.condensingTempC)
  ) {
    errors.push(m.needTempEvapOrCond);
  }

  return { isValid: errors.length === 0, errors };
}

export function validateCanSendToAssembly(
  result: CnCoilsSimulationResult | undefined,
  physical: Partial<CnCoilsPhysicalInputs>,
): ValidationResult {
  const errors: string[] = [];
  if (!result) {
    errors.push(m.geometryIncomplete);
    return { isValid: false, errors };
  }
  const physCheck = validatePhysicalInputs(physical);
  if (!physCheck.isValid) {
    errors.push(m.geometryIncomplete, ...physCheck.errors);
  }
  return { isValid: errors.length === 0, errors };
}
