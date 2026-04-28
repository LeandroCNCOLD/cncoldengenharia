// Solver de equilíbrio térmico: encontra (Tevap, Tcond) que balanceia o sistema.

import type {
  Catalog,
  CompressorCatalogItem,
  HeatExchangerCatalogItem,
} from "@/lib/catalog/types";
import { calculateCompressorPerformance } from "./compressorPolynomial";
import { calculateCondenserCapacity } from "./condenserModel";
import { calculateEvaporatorCapacity } from "./evaporatorModel";
import {
  ThermalEngineError,
  type ThermalSimulationInput,
  type ThermalSimulationResult,
} from "./thermalBalanceTypes";
import {
  buildAlerts,
  determineBottleneck,
  determineStatus,
  validateCompressorEnvelope,
} from "./thermalValidation";

const KCAL_H_PER_W = 0.859845;

type BestPoint = {
  tevap: number;
  tcond: number;
  err: number;
  comp: ReturnType<typeof calculateCompressorPerformance>;
  evap: ReturnType<typeof calculateEvaporatorCapacity>;
  cond: ReturnType<typeof calculateCondenserCapacity>;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function sweep(params: {
  input: ThermalSimulationInput;
  evaporator: HeatExchangerCatalogItem;
  condenser: HeatExchangerCatalogItem;
  compressor: CompressorCatalogItem;
  teRange: [number, number];
  tcRange: [number, number];
  step: number;
}): BestPoint | null {
  const { input, evaporator, condenser, compressor, teRange, tcRange, step } = params;
  let best: BestPoint | null = null;

  for (let te = teRange[0]; te <= teRange[1] + 1e-9; te += step) {
    for (let tc = tcRange[0]; tc <= tcRange[1] + 1e-9; tc += step) {
      if (tc - te < 20) continue;
      let comp;
      try {
        comp = calculateCompressorPerformance(compressor, te, tc);
      } catch {
        continue;
      }
      const evap = calculateEvaporatorCapacity(evaporator, te, input.chamberAirTempC, {
        airFlowM3h: input.evaporatorAirFlowM3h,
        frostFactor: input.frostFactor,
        foulingFactor: input.evaporatorFoulingFactor,
      });
      const cond = calculateCondenserCapacity(condenser, tc, input.condenserAirInletTempC, {
        airFlowM3h: input.condenserAirFlowM3h,
        foulingFactor: input.condenserFoulingFactor,
        altitudeFactor: input.altitudeFactor,
      });
      if (evap.capacityW <= 0 || cond.capacityW <= 0) continue;

      const err1 = Math.abs(evap.capacityW - comp.coolingCapacityW);
      const err2 = Math.abs(cond.capacityW - (comp.coolingCapacityW + comp.powerInputW));
      const err = err1 + err2;

      if (!best || err < best.err) {
        best = { tevap: te, tcond: tc, err, comp, evap, cond };
      }
    }
  }
  return best;
}

export function solveThermalBalance(
  input: ThermalSimulationInput,
  catalog: Catalog,
): ThermalSimulationResult {
  const evaporator = catalog.evaporators.find((e) => e.id === input.evaporatorId);
  const condenser = catalog.condensers.find((c) => c.id === input.condenserId);
  const compressor = catalog.compressors.find((c) => c.id === input.compressorId);
  if (!evaporator) throw new ThermalEngineError(`Evaporador não encontrado: ${input.evaporatorId}`);
  if (!condenser) throw new ThermalEngineError(`Condensador não encontrado: ${input.condenserId}`);
  if (!compressor) throw new ThermalEngineError(`Compressor não encontrado: ${input.compressorId}`);

  // Faixas de busca.
  const teLo = clamp(input.chamberAirTempC - 25, -50, 5);
  const teHi = clamp(input.chamberAirTempC - 3, -50, 5);
  const tcLo = clamp(input.condenserAirInletTempC + 5, 25, 75);
  const tcHi = clamp(input.condenserAirInletTempC + 35, 25, 75);

  const coarse = sweep({
    input,
    evaporator,
    condenser,
    compressor,
    teRange: [teLo, teHi],
    tcRange: [tcLo, tcHi],
    step: 0.5,
  });
  if (!coarse) {
    throw new ThermalEngineError(
      "Nenhum ponto de equilíbrio físico encontrado na faixa.",
      { teRange: [teLo, teHi], tcRange: [tcLo, tcHi] },
    );
  }

  const fine = sweep({
    input,
    evaporator,
    condenser,
    compressor,
    teRange: [Math.max(teLo, coarse.tevap - 1), Math.min(teHi, coarse.tevap + 1)],
    tcRange: [Math.max(tcLo, coarse.tcond - 1), Math.min(tcHi, coarse.tcond + 1)],
    step: 0.1,
  }) ?? coarse;

  const { tevap, tcond, comp, evap, cond } = fine;

  const coolingCapacityW = Math.min(comp.coolingCapacityW, evap.capacityW);
  const powerInputW = comp.powerInputW;
  const heatRejectionW = coolingCapacityW + powerInputW;
  const cop = coolingCapacityW / Math.max(powerInputW, 1e-6);
  const balanceErrorW =
    Math.abs(evap.capacityW - comp.coolingCapacityW) +
    Math.abs(cond.capacityW - heatRejectionW);

  const utilizations = {
    comp: (coolingCapacityW / Math.max(comp.coolingCapacityW, 1e-6)) * 100,
    evap: (coolingCapacityW / Math.max(evap.capacityW, 1e-6)) * 100,
    cond: (heatRejectionW / Math.max(cond.capacityW, 1e-6)) * 100,
  };

  const bottleneck = determineBottleneck(
    comp,
    { capacityW: evap.capacityW, deltaT: evap.deltaT },
    { capacityW: cond.capacityW, deltaT: cond.deltaT },
    heatRejectionW,
  );

  const envelopeAlerts = validateCompressorEnvelope(tevap, tcond);
  const alerts = buildAlerts({
    input,
    tevapC: tevap,
    tcondC: tcond,
    compressor: comp,
    evaporator: { capacityW: evap.capacityW, deltaT: evap.deltaT, utilizationPercent: utilizations.evap },
    condenser: { capacityW: cond.capacityW, deltaT: cond.deltaT, utilizationPercent: utilizations.cond },
    coolingCapacityW,
    heatRejectionW,
    balanceErrorW,
    bottleneck,
    cop,
    utilizations,
    envelopeAlerts,
  });
  // Inclui alertas locais dos modelos.
  alerts.push(...evap.alerts, ...cond.alerts);

  const status = determineStatus({
    coolingCapacityW,
    balanceErrorW,
    requiredLoadW: input.requiredLoadW,
    cop,
    tevapC: tevap,
    tcondC: tcond,
    condenserAirInletTempC: input.condenserAirInletTempC,
    chamberAirTempC: input.chamberAirTempC,
    heatRejectionW,
    condenserCapacityW: cond.capacityW,
  });

  return {
    tevapC: tevap,
    tcondC: tcond,
    compressor: comp,
    evaporator: {
      capacityW: evap.capacityW,
      deltaT: evap.deltaT,
      utilizationPercent: utilizations.evap,
    },
    condenser: {
      capacityW: cond.capacityW,
      deltaT: cond.deltaT,
      utilizationPercent: utilizations.cond,
    },
    coolingCapacityW,
    coolingCapacityKcalh: coolingCapacityW * KCAL_H_PER_W,
    heatRejectionW,
    powerInputW,
    cop,
    balanceErrorW,
    bottleneck,
    status,
    alerts: Array.from(new Set(alerts)),
  };
}

/**
 * Wrapper de alto nível: valida refrigerante e executa o solver.
 */
export function simulateSingleSystem(
  input: ThermalSimulationInput,
  catalog: Catalog,
): ThermalSimulationResult {
  const evaporator = catalog.evaporators.find((e) => e.id === input.evaporatorId);
  const condenser = catalog.condensers.find((c) => c.id === input.condenserId);
  const compressor = catalog.compressors.find((c) => c.id === input.compressorId);
  if (!evaporator || !condenser || !compressor) {
    throw new ThermalEngineError("Componente não encontrado no catálogo.", {
      evaporatorId: input.evaporatorId,
      condenserId: input.condenserId,
      compressorId: input.compressorId,
    });
  }
  const refs = [evaporator.refrigerant, condenser.refrigerant, compressor.refrigerant]
    .map((r) => (r ?? "").trim().toUpperCase())
    .filter(Boolean);
  const distinct = new Set(refs);
  if (distinct.size > 1) {
    throw new ThermalEngineError(
      `Refrigerantes incompatíveis: ${Array.from(distinct).join(", ")}`,
    );
  }
  return solveThermalBalance(input, catalog);
}
