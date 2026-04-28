// Validações físicas e regras de status / gargalo / alertas.

import type {
  Bottleneck,
  CompressorPerformance,
  HeatExchangerPerformance,
  SimulationStatus,
  ThermalSimulationInput,
} from "./thermalBalanceTypes";

export const COMPRESSOR_LIMITS = {
  tevapMinC: -50,
  tevapMaxC: 10,
  tcondMinC: 25,
  tcondMaxC: 75,
  minDeltaK: 20,
};

export function validateCompressorEnvelope(
  tevapC: number,
  tcondC: number,
): string[] {
  const out: string[] = [];
  if (tevapC < COMPRESSOR_LIMITS.tevapMinC || tevapC > COMPRESSOR_LIMITS.tevapMaxC) {
    out.push(`Compressor fora da faixa: Tevap=${tevapC.toFixed(1)}°C`);
  }
  if (tcondC < COMPRESSOR_LIMITS.tcondMinC || tcondC > COMPRESSOR_LIMITS.tcondMaxC) {
    out.push(`Compressor fora da faixa: Tcond=${tcondC.toFixed(1)}°C`);
  }
  if (tcondC - tevapC < COMPRESSOR_LIMITS.minDeltaK) {
    out.push(
      `Diferencial Tcond-Tevap insuficiente (${(tcondC - tevapC).toFixed(1)}K < 20K)`,
    );
  }
  return out;
}

export function determineBottleneck(
  compressor: CompressorPerformance,
  evaporator: HeatExchangerPerformance,
  condenser: HeatExchangerPerformance,
  heatRejectionW: number,
): Bottleneck {
  if (
    compressor.coolingCapacityW <= 0 ||
    evaporator.capacityW <= 0 ||
    condenser.capacityW <= 0
  ) {
    return "invalid";
  }
  if (compressor.coolingCapacityW < evaporator.capacityW * 0.95) return "compressor";
  if (evaporator.capacityW < compressor.coolingCapacityW * 0.95) return "evaporator";
  if (condenser.capacityW < heatRejectionW * 0.95) return "condenser";
  return "balanced";
}

export function determineStatus(params: {
  coolingCapacityW: number;
  balanceErrorW: number;
  requiredLoadW?: number;
  cop: number;
  tevapC: number;
  tcondC: number;
  condenserAirInletTempC: number;
  chamberAirTempC: number;
  heatRejectionW: number;
  condenserCapacityW: number;
}): SimulationStatus {
  const {
    coolingCapacityW,
    balanceErrorW,
    requiredLoadW,
    cop,
    tevapC,
    tcondC,
    condenserAirInletTempC,
    chamberAirTempC,
    heatRejectionW,
    condenserCapacityW,
  } = params;

  // Reprovação dura.
  if (cop <= 0) return "rejected";
  if (coolingCapacityW <= 0) return "rejected";
  if (tcondC <= condenserAirInletTempC) return "rejected";
  if (tevapC >= chamberAirTempC) return "rejected";
  if (heatRejectionW > condenserCapacityW * 1.1) return "rejected";
  if (balanceErrorW > coolingCapacityW * 0.25) return "rejected";

  const errPct = balanceErrorW / Math.max(coolingCapacityW, 1);

  if (requiredLoadW != null) {
    if (coolingCapacityW >= requiredLoadW * 1.05 && errPct <= 0.1) return "approved";
    if (coolingCapacityW < requiredLoadW || errPct > 0.2) return "rejected";
    return "warning";
  }
  if (errPct <= 0.1) return "approved";
  if (errPct <= 0.2) return "warning";
  return "rejected";
}

export function buildAlerts(params: {
  input: ThermalSimulationInput;
  tevapC: number;
  tcondC: number;
  compressor: CompressorPerformance;
  evaporator: HeatExchangerPerformance;
  condenser: HeatExchangerPerformance;
  coolingCapacityW: number;
  heatRejectionW: number;
  balanceErrorW: number;
  bottleneck: Bottleneck;
  cop: number;
  utilizations: { comp: number; evap: number; cond: number };
  envelopeAlerts: string[];
}): string[] {
  const alerts = [...params.envelopeAlerts];
  const {
    input,
    evaporator,
    condenser,
    compressor,
    cop,
    coolingCapacityW,
    heatRejectionW,
    balanceErrorW,
    bottleneck,
    utilizations,
  } = params;

  if (cop < 1.0) alerts.push(`COP muito baixo (${cop.toFixed(2)})`);
  else if (cop < 1.5 && input.chamberAirTempC < -15)
    alerts.push(`COP baixo para baixa temperatura (${cop.toFixed(2)})`);

  if (evaporator.deltaT < 4) alerts.push(`DT evaporador muito baixo (${evaporator.deltaT.toFixed(1)}K)`);
  if (evaporator.deltaT > 15) alerts.push(`DT evaporador muito alto (${evaporator.deltaT.toFixed(1)}K)`);
  if (condenser.deltaT < 5) alerts.push(`DT condensador muito baixo (${condenser.deltaT.toFixed(1)}K)`);
  if (condenser.deltaT > 20) alerts.push(`DT condensador muito alto (${condenser.deltaT.toFixed(1)}K)`);

  if (bottleneck === "condenser") alerts.push("Condensador subdimensionado");
  if (bottleneck === "evaporator") alerts.push("Evaporador subdimensionado");
  if (bottleneck === "compressor") alerts.push("Compressor limitando o sistema");

  const errPct = (balanceErrorW / Math.max(coolingCapacityW, 1)) * 100;
  if (errPct > 10) alerts.push(`Erro de balanço energético elevado (${errPct.toFixed(1)}%)`);

  if (input.requiredLoadW != null && coolingCapacityW < input.requiredLoadW) {
    alerts.push(
      `Capacidade abaixo da carga requerida (${coolingCapacityW.toFixed(0)}W < ${input.requiredLoadW.toFixed(0)}W)`,
    );
  }

  for (const [name, util] of [
    ["compressor", utilizations.comp],
    ["evaporador", utilizations.evap],
    ["condensador", utilizations.cond],
  ] as const) {
    if (util > 95) alerts.push(`Utilização do ${name} acima de 95% (${util.toFixed(0)}%)`);
    else if (util < 60) alerts.push(`Utilização do ${name} abaixo de 60% (${util.toFixed(0)}%)`);
  }

  // Marca para evitar warnings de variável não usada.
  void compressor;
  void heatRejectionW;

  return alerts;
}
