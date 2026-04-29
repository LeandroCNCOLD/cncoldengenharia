/**
 * Simulador do aletado condensador.
 *   Qcond = Qnom * (DTreal/DTnom)^n * airflowFactor * foulingFactor * altitudeFactor
 *   DTreal = Tcond - TarEntrada
 *   DTnom  = TcondNom - TarNom
 */

export interface CondenserNominalPoint {
  capacityW: number;
  airTempInC: number;
  condTempC: number;
  airflowM3h: number;
  exponentN?: number; // default 1.15
}

export interface CondenserSimulationInputs {
  airTempInC: number;
  condTempC: number;
  airflowM3h?: number;
  altitudeFactor?: number; // default 1.0
  foulingFactor?: number; // default 1.0
}

export interface CondenserSimulationResult {
  capacityW: number;
  dtRealK: number;
  dtNominalK: number;
  airflowUsedM3h: number;
  correctionFactor: number;
  warnings: string[];
}

export function simulateCondenser(
  nominal: CondenserNominalPoint,
  inputs: CondenserSimulationInputs,
): CondenserSimulationResult {
  const warnings: string[] = [];
  const n = nominal.exponentN ?? 1.15;
  const altitude = inputs.altitudeFactor ?? 1.0;
  const fouling = inputs.foulingFactor ?? 1.0;
  const airflow = inputs.airflowM3h ?? nominal.airflowM3h;

  const dtNom = nominal.condTempC - nominal.airTempInC;
  const dtReal = inputs.condTempC - inputs.airTempInC;

  if (dtNom <= 0) warnings.push("DT nominal inválido (≤ 0).");
  if (dtReal <= 0) warnings.push("DT real ≤ 0 — sem rejeição possível.");
  if (nominal.airflowM3h <= 0) warnings.push("Vazão nominal de ar inválida.");

  const dtRatio = dtNom > 0 ? dtReal / dtNom : 0;
  const airflowFactor = nominal.airflowM3h > 0 ? airflow / nominal.airflowM3h : 1;
  const correction = Math.max(dtRatio, 0) ** n * airflowFactor * altitude * fouling;
  const capacityW = Math.max(nominal.capacityW * correction, 0);

  if (Math.abs(airflowFactor - 1) > 0.4)
    warnings.push("Vazão de ar fora de ±40% do nominal — modelo perde acurácia.");
  if (altitude < 0.85) warnings.push("Fator de altitude baixo — confira correção atmosférica.");

  return {
    capacityW,
    dtRealK: dtReal,
    dtNominalK: dtNom,
    airflowUsedM3h: airflow,
    correctionFactor: correction,
    warnings,
  };
}
