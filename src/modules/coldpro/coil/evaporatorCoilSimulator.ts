/**
 * Simulador do aletado evaporador.
 *   Qevap = Qnom * (DTreal/DTnom)^n * airflowFactor * frostFactor * foulingFactor
 *   DTreal = TarEntrada - Tevap
 *   DTnom  = TarNom - TevapNom
 */

export interface EvaporatorNominalPoint {
  capacityW: number;
  sensibleW?: number | null;
  latentW?: number | null;
  airTempInC: number;
  evapTempC: number;
  airflowM3h: number;
  exponentN?: number; // default 1.20
}

export interface EvaporatorSimulationInputs {
  airTempInC: number;
  evapTempC: number;
  airflowM3h?: number; // default = nominal
  rhInPct?: number; // só usado para split sens/lat heurístico
  frostFactor?: number; // default 0.90
  foulingFactor?: number; // default 1.00
}

export interface EvaporatorSimulationResult {
  totalCapacityW: number;
  sensibleCapacityW: number | null;
  latentCapacityW: number | null;
  dtRealK: number;
  dtNominalK: number;
  airflowUsedM3h: number;
  correctionFactor: number;
  warnings: string[];
}

export function simulateEvaporator(
  nominal: EvaporatorNominalPoint,
  inputs: EvaporatorSimulationInputs,
): EvaporatorSimulationResult {
  const warnings: string[] = [];
  const n = nominal.exponentN ?? 1.2;
  const frost = inputs.frostFactor ?? 0.9;
  const fouling = inputs.foulingFactor ?? 1.0;
  const airflow = inputs.airflowM3h ?? nominal.airflowM3h;

  const dtNom = nominal.airTempInC - nominal.evapTempC;
  const dtReal = inputs.airTempInC - inputs.evapTempC;

  if (dtNom <= 0) warnings.push("DT nominal inválido (≤ 0).");
  if (dtReal <= 0) warnings.push("DT real ≤ 0 — capacidade tende a zero.");
  if (nominal.airflowM3h <= 0) warnings.push("Vazão nominal de ar inválida.");

  const dtRatio = dtNom > 0 ? dtReal / dtNom : 0;
  const airflowFactor = nominal.airflowM3h > 0 ? airflow / nominal.airflowM3h : 1;
  const correction = Math.max(dtRatio, 0) ** n * airflowFactor * frost * fouling;

  const totalCapacityW = Math.max(nominal.capacityW * correction, 0);

  // Split sens/lat: mantém proporção nominal se disponível; caso contrário 100% sensível
  let sensible: number | null = null;
  let latent: number | null = null;
  if (nominal.sensibleW && nominal.capacityW > 0) {
    const sensFrac = nominal.sensibleW / nominal.capacityW;
    sensible = totalCapacityW * sensFrac;
    latent = totalCapacityW - sensible;
  } else {
    sensible = totalCapacityW;
    latent = 0;
  }

  if (Math.abs(airflowFactor - 1) > 0.4)
    warnings.push("Vazão de ar fora de ±40% do nominal — modelo perde acurácia.");
  if (frost < 0.7) warnings.push("Fator de gelo muito baixo — verifique degelo.");

  return {
    totalCapacityW,
    sensibleCapacityW: sensible,
    latentCapacityW: latent,
    dtRealK: dtReal,
    dtNominalK: dtNom,
    airflowUsedM3h: airflow,
    correctionFactor: correction,
    warnings,
  };
}
