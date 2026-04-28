// Gera mapa de performance varrendo Tevap × Tcond.

import type { Catalog } from "@/lib/catalog/types";
import { calculateCompressorPerformance } from "../engine/compressorPolynomial";
import { ThermalEngineError } from "../engine/thermalBalanceTypes";
import type {
  EquipmentCombination,
  PerformanceMap,
  PerformancePoint,
} from "./selectionTypes";

export type PerformanceMapOptions = {
  tevapMin?: number;
  tevapMax?: number;
  tevapStep?: number;
  tcondMin?: number;
  tcondMax?: number;
  tcondStep?: number;
};

export function generatePerformanceMap(
  combination: EquipmentCombination,
  catalog: Catalog,
  opts: PerformanceMapOptions = {},
): PerformanceMap {
  const compressor = catalog.compressors.find((c) => c.id === combination.compressorId);
  if (!compressor) throw new ThermalEngineError(`Compressor não encontrado: ${combination.compressorId}`);

  const teMin = opts.tevapMin ?? -45;
  const teMax = opts.tevapMax ?? 0;
  const teStep = opts.tevapStep ?? 5;
  const tcMin = opts.tcondMin ?? 30;
  const tcMax = opts.tcondMax ?? 60;
  const tcStep = opts.tcondStep ?? 5;

  const points: PerformancePoint[] = [];
  for (let te = teMin; te <= teMax + 1e-9; te += teStep) {
    for (let tc = tcMin; tc <= tcMax + 1e-9; tc += tcStep) {
      if (tc - te < 20) continue;
      try {
        const p = calculateCompressorPerformance(compressor, te, tc);
        points.push({
          tevap: +te.toFixed(2),
          tcond: +tc.toFixed(2),
          capacity: +p.coolingCapacityW.toFixed(1),
          power: +p.powerInputW.toFixed(1),
          cop: +p.cop.toFixed(3),
        });
      } catch {
        continue;
      }
    }
  }

  return { combination, points };
}
