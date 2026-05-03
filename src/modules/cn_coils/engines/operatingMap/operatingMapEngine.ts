import { runCoilForCycle, type CoilCycleInputs } from "../coil/coilCycleAdapter";
import {
  evaluateCompressor,
  type CompressorInputs,
  type CompressorRecord,
} from "../compressor/compressorModel";
import type {
  OperatingMapConfig,
  OperatingMapCurve,
  OperatingMapPoint,
  OperatingMapResult,
} from "./operatingMapTypes";

const CURVE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export async function generateOperatingMap(
  baseInputs: CoilCycleInputs,
  config: OperatingMapConfig,
  compressor?: CompressorRecord,
  compressorBase?: Omit<CompressorInputs, "Te_C" | "Tc_C" | "refrigerantId">,
): Promise<OperatingMapResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const curves: OperatingMapCurve[] = [];
  const evapTemps: number[] = [];

  for (
    let t = config.evapTempRange.min;
    t <= config.evapTempRange.max + 0.001;
    t += config.evapTempRange.step
  ) {
    evapTemps.push(Math.round(t * 10) / 10);
  }

  for (let ci = 0; ci < config.condensingTemps.length; ci++) {
    const condensingTempC = config.condensingTemps[ci];
    const points: OperatingMapPoint[] = [];

    for (const evapTempC of evapTemps) {
      if (evapTempC >= condensingTempC - 5) continue;

      const inputs: CoilCycleInputs = {
        ...baseInputs,
        evaporatingTempC: evapTempC,
        condensingTempC,
        airInletTempC: config.airInletTempC,
        airFlowM3H: config.airFlowM3H,
      };

      try {
        const result = await runCoilForCycle(inputs);
        if (!result.success || result.totalCapacityW <= 0) continue;

        let copSystem = 0;
        if (compressor) {
          try {
            const compResult = await evaluateCompressor(
              {
                Te_C: evapTempC,
                Tc_C: condensingTempC,
                superheat_K: compressorBase?.superheat_K ?? inputs.superheatK,
                subcooling_K: compressorBase?.subcooling_K ?? inputs.subcoolingK,
                refrigerantId: inputs.refrigerantId,
              },
              compressor,
            );
            copSystem = compResult.COP;
            warnings.push(...compResult.warnings.filter((w) => !warnings.includes(w)));
          } catch {
            // COP não disponível para este ponto.
          }
        }

        points.push({
          evapTempC,
          condensingTempC,
          capacityW: result.totalCapacityW,
          copSystem,
          airOutletTempC: result.airOutletTempC,
          warnings: result.warnings,
        });
      } catch {
        // Ponto inválido — pular.
      }
    }

    if (points.length > 0) {
      curves.push({
        condensingTempC,
        points,
        color: CURVE_COLORS[ci % CURVE_COLORS.length],
      });
    }
  }

  if (curves.length === 0) {
    warnings.push("Nenhuma curva gerada. Verifique os parâmetros do mapa de operação.");
  }

  const allPoints = curves.flatMap((curve) => curve.points);
  const xRange = {
    min: Math.min(...allPoints.map((p) => p.evapTempC), config.evapTempRange.min),
    max: Math.max(...allPoints.map((p) => p.evapTempC), config.evapTempRange.max),
  };
  const yRange = {
    min: 0,
    max: Math.max(...allPoints.map((p) => p.capacityW), 1) * 1.1,
  };

  let designPoint: OperatingMapPoint | undefined;
  if (config.designPoint) {
    let minDist = Infinity;
    for (const curve of curves) {
      if (Math.abs(curve.condensingTempC - config.designPoint.condensingTempC) > 2) {
        continue;
      }
      for (const point of curve.points) {
        const dist = Math.abs(point.evapTempC - config.designPoint.evapTempC);
        if (dist < minDist) {
          minDist = dist;
          designPoint = point;
        }
      }
    }
  }

  return {
    curves,
    designPoint,
    xRange,
    yRange,
    computeTimeMs: Date.now() - startTime,
    warnings,
  };
}
