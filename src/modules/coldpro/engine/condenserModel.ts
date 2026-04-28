// Modelo do condensador baseado em DT, ajustado por airflow, fouling e altitude.

import type { HeatExchangerCatalogItem } from "@/lib/catalog/types";
import type { HeatExchangerPerformance } from "./thermalBalanceTypes";

export type CondenserOptions = {
  airFlowM3h?: number;
  foulingFactor?: number;
  altitudeFactor?: number;
};

export type CondenserResult = HeatExchangerPerformance & {
  alerts: string[];
};

export function calculateCondenserCapacity(
  condenser: HeatExchangerCatalogItem,
  tcondC: number,
  condenserAirInletTempC: number,
  options: CondenserOptions = {},
): CondenserResult {
  const alerts: string[] = [];
  const dtReal = tcondC - condenserAirInletTempC;

  if (dtReal <= 0) {
    return { capacityW: 0, deltaT: dtReal, alerts: ["DT condensador inválido (<=0)"] };
  }
  if (dtReal < 5) alerts.push(`DT condensador muito baixo (${dtReal.toFixed(1)}K)`);
  if (dtReal > 20) alerts.push(`DT condensador muito alto (${dtReal.toFixed(1)}K)`);

  const airflowFactor =
    options.airFlowM3h && condenser.airFlowM3h > 0
      ? options.airFlowM3h / condenser.airFlowM3h
      : 1;
  const foulingFactor = options.foulingFactor ?? 1.0;
  const altitudeFactor = options.altitudeFactor ?? 1.0;

  const ratio = dtReal / Math.max(condenser.nominalDeltaT, 1e-6);
  const capacityW =
    condenser.nominalCapacityW *
    Math.pow(ratio, 1.15) *
    airflowFactor *
    foulingFactor *
    altitudeFactor;

  return {
    capacityW: Math.max(capacityW, 0),
    deltaT: dtReal,
    alerts,
  };
}
