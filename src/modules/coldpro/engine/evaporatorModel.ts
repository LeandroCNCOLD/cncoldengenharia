// Modelo do evaporador baseado em DT, ajustado por airflow, frost e fouling.

import type { HeatExchangerCatalogItem } from "@/lib/catalog/types";
import type { HeatExchangerPerformance } from "./thermalBalanceTypes";

export type EvaporatorOptions = {
  airFlowM3h?: number;
  frostFactor?: number;
  foulingFactor?: number;
};

export type EvaporatorResult = HeatExchangerPerformance & {
  alerts: string[];
};

export function calculateEvaporatorCapacity(
  evaporator: HeatExchangerCatalogItem,
  tevapC: number,
  chamberAirTempC: number,
  options: EvaporatorOptions = {},
): EvaporatorResult {
  const alerts: string[] = [];
  const dtReal = chamberAirTempC - tevapC;

  if (dtReal <= 0) {
    return { capacityW: 0, deltaT: dtReal, alerts: ["DT evaporador inválido (<=0)"] };
  }
  if (dtReal < 4) alerts.push(`DT evaporador muito baixo (${dtReal.toFixed(1)}K)`);
  if (dtReal > 15) alerts.push(`DT evaporador muito alto (${dtReal.toFixed(1)}K)`);

  const airflowFactor =
    options.airFlowM3h && evaporator.airFlowM3h > 0
      ? options.airFlowM3h / evaporator.airFlowM3h
      : 1;
  const frostFactor = options.frostFactor ?? 0.9;
  const foulingFactor = options.foulingFactor ?? 1.0;

  const ratio = dtReal / Math.max(evaporator.nominalDeltaT, 1e-6);
  const capacityW =
    evaporator.nominalCapacityW *
    Math.pow(ratio, 1.2) *
    airflowFactor *
    frostFactor *
    foulingFactor;

  return {
    capacityW: Math.max(capacityW, 0),
    deltaT: dtReal,
    alerts,
  };
}
