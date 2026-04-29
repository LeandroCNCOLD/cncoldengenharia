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
  airflowM3h?: number;
  rhInPct?: number;
  frostFactor?: number; // default 0.90
  foulingFactor?: number; // default 1.00
}

export interface EvaporatorSimulationResult {
  totalCapacityW: number;
  totalCapacityKcalh: number;
  sensibleCapacityW: number | null;
  latentCapacityW: number | null;
  dtRealK: number;
  dtNominalK: number;
  airflowUsedM3h: number;
  airflowFactor: number;
  frostFactor: number;
  foulingFactor: number;
  correctionFactor: number;
  comparisonToNominalPercent: number; // Q/Qnom * 100
  warnings: string[];
}

const W_TO_KCALH = 0.859845;

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

  // Alertas técnicos completos (item 6 do prompt)
  if (dtNom <= 0) warnings.push("DT nominal inválido (≤ 0).");
  if (dtReal <= 0) warnings.push("ERRO: DT real ≤ 0 — capacidade tende a zero.");
  else if (dtReal < 4) warnings.push(`DT muito baixo (${dtReal.toFixed(1)} K).`);
  else if (dtReal > 15) warnings.push(`DT alto para evaporador (${dtReal.toFixed(1)} K).`);

  const airflowFactor = nominal.airflowM3h > 0 ? airflow / nominal.airflowM3h : 1;
  if (airflowFactor < 0.7) warnings.push(`Vazão de ar abaixo da nominal (${(airflowFactor * 100).toFixed(0)}%).`);
  else if (airflowFactor > 1.3) warnings.push(`Vazão de ar acima da nominal (${(airflowFactor * 100).toFixed(0)}%).`);

  if (frost < 0.8) warnings.push(`Perda significativa por gelo (fator ${frost.toFixed(2)}).`);

  const dtRatio = dtNom > 0 ? dtReal / dtNom : 0;
  const correction = Math.max(dtRatio, 0) ** n * airflowFactor * frost * fouling;
  const totalCapacityW = Math.max(nominal.capacityW * correction, 0);
  const comparisonToNominalPercent = nominal.capacityW > 0
    ? (totalCapacityW / nominal.capacityW) * 100
    : 0;

  if (comparisonToNominalPercent < 70)
    warnings.push(`Capacidade simulada abaixo de 70% da nominal (${comparisonToNominalPercent.toFixed(0)}%).`);
  else if (comparisonToNominalPercent > 140)
    warnings.push(`Capacidade simulada acima de 140% da nominal (${comparisonToNominalPercent.toFixed(0)}%).`);

  // Split sens/lat
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

  return {
    totalCapacityW,
    totalCapacityKcalh: totalCapacityW * W_TO_KCALH,
    sensibleCapacityW: sensible,
    latentCapacityW: latent,
    dtRealK: dtReal,
    dtNominalK: dtNom,
    airflowUsedM3h: airflow,
    airflowFactor,
    frostFactor: frost,
    foulingFactor: fouling,
    correctionFactor: correction,
    comparisonToNominalPercent,
    warnings,
  };
}
