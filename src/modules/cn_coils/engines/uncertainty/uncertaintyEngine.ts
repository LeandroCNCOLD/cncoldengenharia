/**
 * Motor de Analise de Incerteza — Monte Carlo simplificado.
 */
import { runCoilForCycle } from "../coil/coilCycleAdapter";
import type { CoilCycleInputs, CoilCycleResult } from "../coil/coilCycleAdapter";
import type {
  UncertaintyBand,
  UncertaintyConfig,
  UncertaintyResult,
} from "./uncertaintyTypes";

export const DEFAULT_UNCERTAINTIES = {
  h_air_relative: 0.15,
  dp_air_relative: 0.15,
  h_fluid_relative: 0.15,
  refrigerant_props_relative: 0.02,
  fin_efficiency_relative: 0.05,
  contact_resistance_relative: 0.3,
};

export const DEFAULT_UNCERTAINTY_CONFIG: UncertaintyConfig = {
  samples: 500,
  confidenceLevel: 0.9,
  seed: 42,
  correlationUncertainties: DEFAULT_UNCERTAINTIES,
};

class LCGRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  nextGaussian(): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  gaussian(mean: number, stdDev: number): number {
    return mean + stdDev * this.nextGaussian();
  }

  gaussianTruncated(mean: number, relativeStdDev: number): number {
    const stdDev = Math.abs(mean) * relativeStdDev;
    const value = this.gaussian(mean, stdDev);
    const min = mean - 3 * stdDev;
    const max = mean + 3 * stdDev;
    return Math.max(min, Math.min(max, value));
  }
}

function computePercentile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function buildBand(
  samples: number[],
  confidenceLevel: number,
  nominal: number,
): UncertaintyBand {
  const sorted = [...samples].sort((a, b) => a - b);
  const alpha = (1 - confidenceLevel) / 2;
  const lower = computePercentile(sorted, alpha);
  const upper = computePercentile(sorted, 1 - alpha);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance =
    samples.length > 1
      ? samples.reduce((s, x) => s + (x - mean) ** 2, 0) /
        (samples.length - 1)
      : 0;
  return {
    nominal,
    lower,
    upper,
    stdDev: Math.sqrt(variance),
    confidenceLevel,
  };
}

function perturbInputs(
  base: CoilCycleInputs,
  rng: LCGRandom,
  unc: UncertaintyConfig["correlationUncertainties"],
): CoilCycleInputs {
  const p = base.physical;
  return {
    ...base,
    physical: {
      ...p,
      finPitchMm: rng.gaussianTruncated(p.finPitchMm, unc.h_air_relative),
      tubeInternalDiameterMm: rng.gaussianTruncated(
        p.tubeInternalDiameterMm,
        unc.h_fluid_relative,
      ),
    },
    tubeMaterialConductivity: rng.gaussianTruncated(
      base.tubeMaterialConductivity ?? 385,
      unc.contact_resistance_relative,
    ),
  };
}

export async function runUncertaintyAnalysis(
  nominalInputs: CoilCycleInputs,
  nominalResult: CoilCycleResult,
  config: Partial<UncertaintyConfig> = {},
): Promise<UncertaintyResult> {
  const cfg: UncertaintyConfig = {
    ...DEFAULT_UNCERTAINTY_CONFIG,
    ...config,
    correlationUncertainties: {
      ...DEFAULT_UNCERTAINTIES,
      ...(config.correlationUncertainties ?? {}),
    },
  };
  const startTime = Date.now();
  const rng = new LCGRandom(cfg.seed);
  const warnings: string[] = [];
  const capacitySamples: number[] = [];
  const sensibleSamples: number[] = [];
  const dpAirSamples: number[] = [];
  const uSamples: number[] = [];
  let successCount = 0;
  const maxAttempts = cfg.samples * 2;

  for (let attempt = 0; attempt < maxAttempts && successCount < cfg.samples; attempt++) {
    const perturbedInputs = perturbInputs(nominalInputs, rng, cfg.correlationUncertainties);
    try {
      const result = await runCoilForCycle(perturbedInputs);
      if (result.success && result.totalCapacityW > 0) {
        capacitySamples.push(result.totalCapacityW);
        sensibleSamples.push(result.sensibleCapacityW ?? result.totalCapacityW);
        dpAirSamples.push(result.airPressureDropPa ?? 0);
        uSamples.push(result.overallU_WM2K ?? 0);
        successCount++;
      }
    } catch {
      // amostra invalida
    }
  }

  if (successCount < cfg.samples * 0.5) {
    warnings.push(
      `Apenas ${successCount}/${cfg.samples} amostras convergiram. Intervalos de confiança podem ser menos precisos.`,
    );
  }

  if (successCount < 10) {
    warnings.push("Amostras insuficientes para análise de incerteza confiável.");
    const fallbackBand = (nominal: number): UncertaintyBand => ({
      nominal,
      lower: nominal * 0.85,
      upper: nominal * 1.15,
      stdDev: nominal * 0.075,
      confidenceLevel: cfg.confidenceLevel,
    });
    return {
      totalCapacityW: fallbackBand(nominalResult.totalCapacityW),
      sensibleCapacityW: fallbackBand(
        nominalResult.sensibleCapacityW ?? nominalResult.totalCapacityW,
      ),
      airPressureDropPa: fallbackBand(nominalResult.airPressureDropPa ?? 0),
      overallU_WM2K: fallbackBand(nominalResult.overallU_WM2K ?? 0),
      samplesUsed: successCount,
      computeTimeMs: Date.now() - startTime,
      warnings,
    };
  }

  return {
    totalCapacityW: buildBand(
      capacitySamples,
      cfg.confidenceLevel,
      nominalResult.totalCapacityW,
    ),
    sensibleCapacityW: buildBand(
      sensibleSamples,
      cfg.confidenceLevel,
      nominalResult.sensibleCapacityW ?? nominalResult.totalCapacityW,
    ),
    airPressureDropPa: buildBand(
      dpAirSamples,
      cfg.confidenceLevel,
      nominalResult.airPressureDropPa ?? 0,
    ),
    overallU_WM2K: buildBand(
      uSamples,
      cfg.confidenceLevel,
      nominalResult.overallU_WM2K ?? 0,
    ),
    samplesUsed: successCount,
    computeTimeMs: Date.now() - startTime,
    warnings,
  };
}
