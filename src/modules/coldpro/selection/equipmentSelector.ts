// Seletor automático: testa todas as combinações e classifica.

import type { Catalog } from "@/lib/catalog/types";
import { simulateSingleSystem } from "../engine/systemBalanceSolver";
import { ThermalEngineError } from "../engine/thermalBalanceTypes";
import {
  classify,
  computeScore,
  enforceApplicationRules,
  sortResults,
} from "./rankingEngine";
import type {
  SelectionInput,
  SelectionOutput,
  SelectionResult,
} from "./selectionTypes";

function normRef(s: string): string {
  return (s ?? "").trim().toUpperCase();
}

export function selectBestEquipment(
  input: SelectionInput,
  catalog: Catalog,
): SelectionOutput {
  const ref = normRef(input.refrigerant);
  const evaps = catalog.evaporators.filter((e) => normRef(e.refrigerant) === ref);
  const conds = catalog.condensers.filter((c) => normRef(c.refrigerant) === ref);
  const comps = catalog.compressors.filter((c) => normRef(c.refrigerant) === ref);

  const results: SelectionResult[] = [];
  let totalTested = 0;
  let rejected = 0;

  // Estimativa rápida da potência para o pré-filtro do condensador (assume COP ~ 2).
  const estPower = input.requiredLoadW / 2;
  const minCondCap = input.requiredLoadW + estPower;
  const minEvapCap = input.requiredLoadW * 0.7;

  for (const comp of comps) {
    for (const evap of evaps) {
      if (evap.nominalCapacityW < minEvapCap) continue;
      for (const cond of conds) {
        if (cond.nominalCapacityW < minCondCap * 0.6) continue;
        totalTested++;
        try {
          const sim = simulateSingleSystem(
            {
              compressorId: comp.id,
              evaporatorId: evap.id,
              condenserId: cond.id,
              chamberAirTempC: input.chamberAirTempC,
              condenserAirInletTempC: input.condenserAirInletTempC,
              requiredLoadW: input.requiredLoadW,
              altitudeFactor: input.altitudeFactor,
            },
            catalog,
          );
          if (sim.status === "rejected") {
            rejected++;
            continue;
          }
          if (input.maxPowerKW != null && sim.powerInputW > input.maxPowerKW * 1000) {
            rejected++;
            continue;
          }

          const partial: Omit<SelectionResult, "score" | "rating"> = {
            combination: {
              compressorId: comp.id,
              evaporatorId: evap.id,
              condenserId: cond.id,
            },
            models: {
              compressor: comp.model,
              evaporator: evap.model,
              condenser: cond.model,
            },
            tevapC: sim.tevapC,
            tcondC: sim.tcondC,
            coolingCapacityW: sim.coolingCapacityW,
            powerInputW: sim.powerInputW,
            cop: sim.cop,
            compressorUtilization: sim.compressor.cop > 0
              ? (sim.coolingCapacityW / Math.max(sim.compressor.coolingCapacityW, 1)) * 100
              : 0,
            evaporatorUtilization: sim.evaporator.utilizationPercent ?? 0,
            condenserUtilization: sim.condenser.utilizationPercent ?? 0,
            heatRejectionW: sim.heatRejectionW,
            balanceErrorW: sim.balanceErrorW,
            bottleneck: sim.bottleneck,
            status: sim.status,
            alerts: sim.alerts,
          };
          const score = computeScore(partial, input);
          const rating = classify(score);
          const final = enforceApplicationRules({ ...partial, score, rating }, input);
          results.push(final);
        } catch (e) {
          if (e instanceof ThermalEngineError) {
            rejected++;
            continue;
          }
          throw e;
        }
      }
    }
  }

  const sorted = sortResults(results);
  const approved = sorted.length;
  const bestCOP = sorted.reduce((m, r) => Math.max(m, r.cop), 0);
  const bestCapacityMatch = sorted.reduce((best, r) => {
    const diff = Math.abs(r.coolingCapacityW - input.requiredLoadW);
    return diff < best ? diff : best;
  }, Number.POSITIVE_INFINITY);

  return {
    bestOptions: sorted.slice(0, 10),
    allResults: sorted,
    summary: {
      totalTested,
      approved,
      rejected,
      bestCOP,
      bestCapacityMatch:
        bestCapacityMatch === Number.POSITIVE_INFINITY ? 0 : bestCapacityMatch,
    },
  };
}
