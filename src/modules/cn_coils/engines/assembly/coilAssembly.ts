/**
 * CoilAssembly — Simulação de múltiplos trocadores em série ou paralelo.
 *
 * Suporta: single, series_air, parallel_air, parallel_refrigerant, vbank.
 * Usa runCoilForCycle() para cada unidade individual.
 */
import { runCoilForCycle } from "../coil/coilCycleAdapter";
import type {
  CoilAssemblyConfig,
  CoilAssemblyResult,
  CoilAssemblyUnitResult,
} from "./assemblyTypes";

function weightedAverage(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return values[0] ?? 0;
  return values.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight;
}

function emptyTotals(config: CoilAssemblyConfig): CoilAssemblyResult["totals"] {
  return {
    totalCapacityW: 0,
    sensibleCapacityW: 0,
    latentCapacityW: 0,
    airOutletTempC: config.airInlet.tempC,
    airOutletRH: config.airInlet.relativeHumidity,
    maxAirPressureDropPa: 0,
    totalAirPressureDropPa: 0,
    maxFluidPressureDropKPa: 0,
    minSafetyFactor: 0,
    weightedOverallU_WM2K: 0,
  };
}

function buildTotals(
  unitResults: CoilAssemblyUnitResult[],
  arrangement: CoilAssemblyConfig["arrangement"],
): CoilAssemblyResult["totals"] {
  const totalCapacityW = unitResults.reduce((s, u) => s + u.coilResult.totalCapacityW, 0);
  const sensibleCapacityW = unitResults.reduce((s, u) => s + (u.coilResult.sensibleCapacityW ?? 0), 0);
  const latentCapacityW = unitResults.reduce((s, u) => s + (u.coilResult.latentCapacityW ?? 0), 0);
  const airFlows = unitResults.map((u) => u.airFlowFraction);
  const airOutletTempC = weightedAverage(unitResults.map((u) => u.airOutletTempC), airFlows);
  const airOutletRH = weightedAverage(unitResults.map((u) => u.airOutletRH), airFlows);
  const airDPs = unitResults.map((u) => u.coilResult.airPressureDropPa ?? 0);
  const totalAirPressureDropPa =
    arrangement === "series_air" || arrangement === "vbank"
      ? airDPs.reduce((a, b) => a + b, 0)
      : Math.max(...airDPs);
  const maxAirPressureDropPa = Math.max(...airDPs);
  const maxFluidPressureDropKPa = Math.max(
    ...unitResults.map((u) => u.coilResult.fluidPressureDropKPa ?? 0),
  );
  const minSafetyFactor = Math.min(...unitResults.map((u) => u.coilResult.safetyFactor ?? 0));
  const areas = unitResults.map((u) => u.coilResult.totalCapacityW);
  const weightedOverallU_WM2K = weightedAverage(
    unitResults.map((u) => u.coilResult.overallU_WM2K ?? 0),
    areas,
  );

  return {
    totalCapacityW,
    sensibleCapacityW,
    latentCapacityW,
    airOutletTempC,
    airOutletRH,
    maxAirPressureDropPa,
    totalAirPressureDropPa,
    maxFluidPressureDropKPa,
    minSafetyFactor,
    weightedOverallU_WM2K,
  };
}

async function runSingle(config: CoilAssemblyConfig): Promise<CoilAssemblyResult> {
  const unit = config.coils[0];
  const warnings: string[] = [];
  const result = await runCoilForCycle({
    ...unit.coilInputs,
    refrigerantId: config.refrigerant.id,
    evaporatingTempC: config.refrigerant.evaporatingTempC,
    condensingTempC: config.refrigerant.condensingTempC,
    refrigerantMassFlowKgS: config.refrigerant.totalMassFlowKgS,
    airInletTempC: config.airInlet.tempC,
    airRelativeHumidity: config.airInlet.relativeHumidity,
    componentType: config.componentType,
    superheatK: config.refrigerant.superheatK,
    subcoolingK: config.refrigerant.subcoolingK,
  });
  warnings.push(...result.warnings);
  const unitResult: CoilAssemblyUnitResult = {
    unitId: unit.id,
    unitName: unit.name,
    position: 1,
    coilResult: result,
    airInletTempC: config.airInlet.tempC,
    airInletRH: config.airInlet.relativeHumidity,
    airOutletTempC: result.airOutletTempC ?? config.airInlet.tempC,
    airOutletRH: result.airOutletRH ?? config.airInlet.relativeHumidity,
    airFlowFraction: 1,
    refrigerantFlowFraction: 1,
  };

  return {
    converged: true,
    arrangement: "single",
    units: [unitResult],
    totals: buildTotals([unitResult], "single"),
    warnings,
  };
}

async function runSeriesAir(config: CoilAssemblyConfig): Promise<CoilAssemblyResult> {
  const warnings: string[] = [];
  const unitResults: CoilAssemblyUnitResult[] = [];
  let currentAirTempC = config.airInlet.tempC;
  let currentAirRH = config.airInlet.relativeHumidity;
  const coils = [...config.coils].sort((a, b) => a.position - b.position);
  const N = coils.length;

  for (const unit of coils) {
    const refFraction = unit.refrigerantFlowFraction ?? 1 / N;
    const result = await runCoilForCycle({
      ...unit.coilInputs,
      refrigerantId: config.refrigerant.id,
      evaporatingTempC: config.refrigerant.evaporatingTempC,
      condensingTempC: config.refrigerant.condensingTempC,
      refrigerantMassFlowKgS: config.refrigerant.totalMassFlowKgS * refFraction,
      airInletTempC: currentAirTempC,
      airRelativeHumidity: currentAirRH,
      componentType: config.componentType,
      superheatK: config.refrigerant.superheatK,
      subcoolingK: config.refrigerant.subcoolingK,
    });
    for (const warning of result.warnings) {
      if (!warnings.includes(warning)) warnings.push(warning);
    }

    const unitResult: CoilAssemblyUnitResult = {
      unitId: unit.id,
      unitName: unit.name,
      position: unit.position,
      coilResult: result,
      airInletTempC: currentAirTempC,
      airInletRH: currentAirRH,
      airOutletTempC: result.airOutletTempC ?? currentAirTempC,
      airOutletRH: result.airOutletRH ?? currentAirRH,
      airFlowFraction: 1,
      refrigerantFlowFraction: refFraction,
    };
    unitResults.push(unitResult);
    currentAirTempC = unitResult.airOutletTempC;
    currentAirRH = unitResult.airOutletRH;
  }

  return {
    converged: true,
    arrangement: "series_air",
    units: unitResults,
    totals: buildTotals(unitResults, "series_air"),
    warnings,
  };
}

async function runParallelAir(config: CoilAssemblyConfig): Promise<CoilAssemblyResult> {
  const warnings: string[] = [];
  const N = config.coils.length;
  const rawFractions = config.coils.map((u) => u.airFlowFraction ?? 1 / N);
  const totalFraction = rawFractions.reduce((a, b) => a + b, 0);
  const normalizedFractions = rawFractions.map((f) => f / totalFraction);

  const unitResults = await Promise.all(
    config.coils.map(async (unit, i) => {
      const airFraction = normalizedFractions[i];
      const refFraction = unit.refrigerantFlowFraction ?? 1 / N;
      const result = await runCoilForCycle({
        ...unit.coilInputs,
        refrigerantId: config.refrigerant.id,
        evaporatingTempC: config.refrigerant.evaporatingTempC,
        condensingTempC: config.refrigerant.condensingTempC,
        refrigerantMassFlowKgS: config.refrigerant.totalMassFlowKgS * refFraction,
        airInletTempC: config.airInlet.tempC,
        airRelativeHumidity: config.airInlet.relativeHumidity,
        componentType: config.componentType,
        superheatK: config.refrigerant.superheatK,
        subcoolingK: config.refrigerant.subcoolingK,
        airFlowM3H: config.airInlet.totalFlowM3H * airFraction,
      });
      for (const warning of result.warnings) {
        if (!warnings.includes(warning)) warnings.push(warning);
      }
      return {
        unitId: unit.id,
        unitName: unit.name,
        position: unit.position,
        coilResult: result,
        airInletTempC: config.airInlet.tempC,
        airInletRH: config.airInlet.relativeHumidity,
        airOutletTempC: result.airOutletTempC ?? config.airInlet.tempC,
        airOutletRH: result.airOutletRH ?? config.airInlet.relativeHumidity,
        airFlowFraction: airFraction,
        refrigerantFlowFraction: refFraction,
      } satisfies CoilAssemblyUnitResult;
    }),
  );

  return {
    converged: true,
    arrangement: "parallel_air",
    units: unitResults,
    totals: buildTotals(unitResults, "parallel_air"),
    warnings,
  };
}

async function runParallelRefrigerant(config: CoilAssemblyConfig): Promise<CoilAssemblyResult> {
  const result = await runParallelAir({
    ...config,
    arrangement: "parallel_air",
    coils: config.coils.map((u) => ({ ...u, airFlowFraction: 1 })),
  });
  return { ...result, arrangement: "parallel_refrigerant" };
}

async function runVBank(config: CoilAssemblyConfig): Promise<CoilAssemblyResult> {
  if (config.coils.length !== 2) {
    return {
      converged: false,
      arrangement: "vbank",
      units: [],
      totals: emptyTotals(config),
      warnings: ["V-bank requer exatamente 2 trocadores."],
    };
  }

  const angle = config.coils[0].vbankAngleDeg ?? 35;
  const cosHalfAngle = Math.cos((angle / 2) * (Math.PI / 180));
  const result = await runParallelAir({
    ...config,
    arrangement: "parallel_air",
    coils: config.coils.map((u) => ({
      ...u,
      airFlowFraction: 0.5,
      coilInputs: {
        ...u.coilInputs,
        airFlowM3H: (u.coilInputs.airFlowM3H ?? config.airInlet.totalFlowM3H / 2) * cosHalfAngle,
      },
    })),
  });

  return {
    ...result,
    arrangement: "vbank",
    warnings: [
      ...result.warnings,
      `V-bank a ${angle}°: fator de correção geométrico = ${cosHalfAngle.toFixed(3)} (cos(${angle / 2}°)).`,
    ],
  };
}

export async function runAssemblySimulation(
  config: CoilAssemblyConfig,
): Promise<CoilAssemblyResult> {
  if (config.coils.length === 0) {
    throw new Error("CoilAssembly: nenhum trocador configurado.");
  }

  switch (config.arrangement) {
    case "single":
      return runSingle(config);
    case "series_air":
      return runSeriesAir(config);
    case "parallel_air":
      return runParallelAir(config);
    case "parallel_refrigerant":
      return runParallelRefrigerant(config);
    case "vbank":
      return runVBank(config);
    default:
      throw new Error(`CoilAssembly: arranjo desconhecido: ${config.arrangement}`);
  }
}
