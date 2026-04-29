/**
 * Adapter: roda o motor híbrido (correlações + fatores Unilab) a partir de um
 * CoilSimulatorInput, sem alterar o número final do simulador legado. Serve
 * APENAS para alimentar o painel de Debug Técnico.
 */
import type { CoilSimulatorInput, HybridDebugInfo } from "./coilSimulatorTypes";
import { simulateHybridCoil } from "./engines/hybridCoilEngine";
import type {
  CoilCalculationInput,
  CoilMode,
  FinType,
  GeometryInput,
} from "./engines/types";

function mapFinType(v?: string): FinType {
  const x = (v ?? "").toLowerCase();
  if (x.includes("louver")) return "louver";
  if (x.includes("wavy")) return "wavy";
  if (x.includes("herring") || x === "espiral") return "herringbone";
  if (x.includes("plain") || x === "integral") return "plain";
  return "unknown";
}

export function buildHybridGeometry(input: CoilSimulatorInput): GeometryInput {
  return buildGeometry(input);
}

function buildGeometry(input: CoilSimulatorInput): GeometryInput {
  const g = input.geometry;
  const tubesPerRow = g.tubesPerRow ?? 12;
  const rows = g.rows ?? 4;
  const tubeOd = g.tubeOdMm ?? 9.52;
  const tubeId = g.tubeIdMm ?? Math.max(tubeOd - 0.6, tubeOd * 0.85);
  return {
    code: g.description ?? "uncatalogued",
    mode: input.coilType === "condenser" ? "condensation" : "direct_expansion",
    finType: mapFinType(g.finType),
    tubeType: "smooth",
    tubeOuterDiameterMm: tubeOd,
    tubeInnerDiameterMm: tubeId,
    tubePitchMm: g.tubeSpacingMm ?? 25,
    rowPitchMm: g.rowSpacingMm ?? 22,
    finPitchMm: g.finPitchMm ?? 4,
    finThicknessMm: g.finThicknessMm ?? 0.13,
    coilLengthMm: g.coilLengthMm ?? 1000,
    coilHeightMm: tubesPerRow * (g.tubeSpacingMm ?? 25),
    coilDepthMm: rows * (g.rowSpacingMm ?? 22),
    rows,
    tubesPerRow,
    circuits: g.circuits ?? 1,
    skippedTubes: g.skippedTubes ?? 0,
  };
}

export function buildHybridCalcInput(input: CoilSimulatorInput): CoilCalculationInput {
  const mode: CoilMode =
    input.coilType === "condenser" ? "condensation" : "direct_expansion";
  const geometry = buildGeometry(input);
  return {
    mode,
    geometry,
    airInletTempC: input.air.airTempInC ?? 0,
    airOutletTempC: input.air.airTempOutC,
    refTempC: input.refrigerant.refTempC ?? 0,
    airflowM3h: input.air.airflowM3h ?? 0,
    relativeHumidityPct: input.air.rhInPct,
    wet: (input.air.rhInPct ?? 0) >= 70 && input.coilType === "evaporator",
    refrigerant: input.refrigerant.refrigerant,
    refrigerantMassFlowKgH:
      input.refrigerant.massFlowKgs != null
        ? input.refrigerant.massFlowKgs * 3600
        : undefined,
  };
}

export function runHybridDebug(input: CoilSimulatorInput): HybridDebugInfo | undefined {
  try {
    const calcInput = buildHybridCalcInput(input);

    const r = simulateHybridCoil(calcInput);
    const d = r.debug as Record<string, any>;
    return {
      source: d.source,
      geometryCode: d.geometryCode,
      finType: d.finType,
      tubeType: d.tubeType,
      airCorrelationName: d.airCorrelationName,
      refCorrelationName: d.refCorrelationName,
      hAirBaseWm2K: d.hAirBase,
      hAirFinalWm2K: d.hAirFinal,
      hRefBaseWm2K: d.hRefBase,
      hRefFinalWm2K: d.hRefFinal,
      uWm2K: r.uWm2K,
      effectiveAreaM2: r.effectiveAreaM2,
      airCorrelationConfidence: d.airCorrelationConfidence,
      refCorrelationConfidence: d.refCorrelationConfidence,
      confidenceScore: d.confidenceScore,
      isEstimated: r.isEstimated,
      factorsApplied: d.factorsApplied,
      warnings: r.warnings,
      geometry: r.geometryResult,
    };
  } catch {
    return undefined;
  }
}
