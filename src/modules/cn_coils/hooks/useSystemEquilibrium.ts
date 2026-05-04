import { useCallback, useMemo, useState } from "react";
import type {
  CoilEnvelope,
  CompressorEnvelopePoint,
  CondenserEnvelopePoint,
  EnvelopePoint,
} from "../store/useCoilEnvelopeStore";

export interface EvaporatorEquilibriumPoint {
  Te_C: number;
  Q_W: number;
  U_Wm2K?: number;
  massFlow_kgh?: number;
}

export type SystemEvaporatorEnvelopePoint = EvaporatorEquilibriumPoint;
export type NormalizedEvaporatorEnvelopePoint = EvaporatorEquilibriumPoint;

export interface CondenserEquilibriumPoint {
  Tc_C: number;
  Q_W: number;
  UA_WK?: number;
}

export type SystemCondenserEnvelopePoint = CondenserEquilibriumPoint;
export type NormalizedCondenserEnvelopePoint = CondenserEquilibriumPoint;

export type SystemBottleneck = SystemEquilibriumResult["bottleneck"];

export interface SystemEquilibriumInputs {
  Tamb_C: number;
  Tsuperheating_K: number;
  Tsubcooling_K: number;
  evaporatorEnvelope: Array<EvaporatorEquilibriumPoint | EnvelopePoint>;
  condenserEnvelope: Array<CondenserEquilibriumPoint | CondenserEnvelopePoint>;
  compressorEnvelope: CompressorEnvelopePoint[];
}

export interface SystemEquilibriumResult {
  converged: boolean;
  iterations: number;
  Te_eq_C: number;
  Tc_eq_C: number;
  Q_evap_W: number;
  Q_comp_W: number;
  Q_cond_W: number;
  W_comp_W: number;
  COP_real: number;
  bottleneck: "evaporator" | "compressor" | "condenser" | "balanced";
  bottleneckReason: string;
  warnings: string[];
  convergencePath: Array<{ iteration: number; Te_C: number; Tc_C: number; residual: number }>;
}

interface CompressorInterpolated {
  Q_W: number;
  W_W: number;
  COP: number;
  massFlow_kgh: number;
  dischargeTemp_C: number;
}

const MAX_ITER = 100;
const TOL = 0.1;
const RELAXATION = 0.5;

function uniqueSorted(values: number[]): number[] {
  return Array.from(new Set(values.filter(Number.isFinite))).sort((a, b) => a - b);
}

function clampToRange(value: number, values: number[]): number {
  if (values.length === 0) return value;
  return Math.min(values[values.length - 1], Math.max(values[0], value));
}

function normalizeEvaporatorPoint(point: EvaporatorEquilibriumPoint | EnvelopePoint) {
  if ("Te_C" in point) return { Te_C: point.Te_C, Q_W: point.Q_W };
  return { Te_C: point.Te, Q_W: point.Q_kcalh / 0.86 };
}

function normalizeCondenserPoint(point: CondenserEquilibriumPoint | CondenserEnvelopePoint) {
  if ("Tc_C" in point) return { Tc_C: point.Tc_C, Q_W: point.Q_W };
  return { Tc_C: point.Tc, Q_W: point.Q_cond_W };
}

function linearInterpolate(
  points: Array<{ x: number; y: number }>,
  x: number,
): { value: number; extrapolated: boolean } {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return { value: 0, extrapolated: true };
  if (sorted.length === 1) return { value: sorted[0].y, extrapolated: x !== sorted[0].x };
  if (x <= sorted[0].x) {
    return { value: sorted[0].y, extrapolated: x < sorted[0].x };
  }
  const last = sorted[sorted.length - 1];
  if (x >= last.x) {
    return { value: last.y, extrapolated: x > last.x };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return { value: a.y + t * (b.y - a.y), extrapolated: false };
    }
  }
  return { value: last.y, extrapolated: true };
}

function inverseLinear(
  points: Array<{ x: number; y: number }>,
  targetY: number,
): { value: number; outside: boolean } {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return { value: 0, outside: true };
  if (sorted.length === 1) return { value: sorted[0].x, outside: targetY !== sorted[0].y };

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (targetY >= minY && targetY <= maxY) {
      const t = (targetY - a.y) / (b.y - a.y || 1);
      return { value: a.x + t * (b.x - a.x), outside: false };
    }
  }

  const nearest = sorted.reduce((best, point) =>
    Math.abs(point.y - targetY) < Math.abs(best.y - targetY) ? point : best,
  );
  return { value: nearest.x, outside: true };
}

function bilinear(
  q11: number,
  q21: number,
  q12: number,
  q22: number,
  x: number,
  y: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
): number {
  const tx = x2 === x1 ? 0 : (x - x1) / (x2 - x1);
  const ty = y2 === y1 ? 0 : (y - y1) / (y2 - y1);
  return (
    q11 * (1 - tx) * (1 - ty) +
    q21 * tx * (1 - ty) +
    q12 * (1 - tx) * ty +
    q22 * tx * ty
  );
}

export function interpolateCompressorQ(
  envelope: CompressorEnvelopePoint[],
  Te: number,
  Tc: number,
): CompressorInterpolated {
  const teValues = uniqueSorted(envelope.map((p) => p.Te_C));
  const tcValues = uniqueSorted(envelope.map((p) => p.Tc_C));
  const clampedTe = clampToRange(Te, teValues);
  const clampedTc = clampToRange(Tc, tcValues);
  const teLow = [...teValues].reverse().find((v) => v <= clampedTe) ?? teValues[0] ?? clampedTe;
  const teHigh = teValues.find((v) => v >= clampedTe) ?? teValues[teValues.length - 1] ?? clampedTe;
  const tcLow = [...tcValues].reverse().find((v) => v <= clampedTc) ?? tcValues[0] ?? clampedTc;
  const tcHigh = tcValues.find((v) => v >= clampedTc) ?? tcValues[tcValues.length - 1] ?? clampedTc;

  const pointAt = (tePoint: number, tcPoint: number) =>
    envelope.find((p) => p.Te_C === tePoint && p.Tc_C === tcPoint) ??
    envelope.reduce((best, point) => {
      const d = Math.abs(point.Te_C - tePoint) + Math.abs(point.Tc_C - tcPoint);
      const bestD = Math.abs(best.Te_C - tePoint) + Math.abs(best.Tc_C - tcPoint);
      return d < bestD ? point : best;
    }, envelope[0]);

  if (!envelope[0]) {
    return { Q_W: 0, W_W: 0, COP: 0, massFlow_kgh: 0, dischargeTemp_C: 0 };
  }

  const p11 = pointAt(teLow, tcLow);
  const p21 = pointAt(teHigh, tcLow);
  const p12 = pointAt(teLow, tcHigh);
  const p22 = pointAt(teHigh, tcHigh);
  const interp = (pick: (point: CompressorEnvelopePoint) => number) =>
    bilinear(pick(p11), pick(p21), pick(p12), pick(p22), clampedTe, clampedTc, teLow, teHigh, tcLow, tcHigh);

  const Q_W = interp((p) => p.Q_W);
  const W_W = interp((p) => p.W_W);
  return {
    Q_W,
    W_W,
    COP: W_W > 0 ? Q_W / W_W : 0,
    massFlow_kgh: interp((p) => p.massFlow_kgh),
    dischargeTemp_C: interp((p) => p.dischargeTemp_C),
  };
}

export function interpolateEvaporatorQ(
  envelope: Array<EvaporatorEquilibriumPoint | EnvelopePoint>,
  Te: number,
): number {
  return linearInterpolate(
    envelope.map(normalizeEvaporatorPoint).map((p) => ({ x: p.Te_C, y: p.Q_W })),
    Te,
  ).value;
}

export function interpolateCondenserQ(
  envelope: Array<CondenserEquilibriumPoint | CondenserEnvelopePoint>,
  Tc: number,
): number {
  return linearInterpolate(
    envelope.map(normalizeCondenserPoint).map((p) => ({ x: p.Tc_C, y: p.Q_W })),
    Tc,
  ).value;
}

function findTeEquilibrium(
  envelope: Array<EvaporatorEquilibriumPoint | EnvelopePoint>,
  targetQ_W: number,
) {
  return inverseLinear(
    envelope.map(normalizeEvaporatorPoint).map((p) => ({ x: p.Te_C, y: p.Q_W })),
    targetQ_W,
  );
}

function findTcEquilibrium(
  envelope: Array<CondenserEquilibriumPoint | CondenserEnvelopePoint>,
  targetQ_W: number,
) {
  return inverseLinear(
    envelope.map(normalizeCondenserPoint).map((p) => ({ x: p.Tc_C, y: p.Q_W })),
    targetQ_W,
  );
}

function identifyBottleneck(result: Pick<SystemEquilibriumResult, "Q_evap_W" | "Q_comp_W" | "Q_cond_W" | "W_comp_W">) {
  const tolerance = 0.05;
  if (result.Q_evap_W < result.Q_comp_W * (1 - tolerance)) return "evaporator" as const;
  if (result.Q_cond_W < (result.Q_comp_W + result.W_comp_W) * (1 - tolerance)) return "condenser" as const;
  if (result.Q_comp_W > 0 && Math.abs(result.Q_evap_W - result.Q_comp_W) / result.Q_comp_W < tolerance) {
    return "balanced" as const;
  }
  return "compressor" as const;
}

function bottleneckReason(bottleneck: SystemEquilibriumResult["bottleneck"]): string {
  switch (bottleneck) {
    case "evaporator":
      return "O evaporador não consegue absorver toda a capacidade do compressor nas condições atuais.";
    case "condenser":
      return "O condensador não consegue rejeitar todo o calor gerado pelo sistema.";
    case "compressor":
      return "O compressor é o componente limitante do sistema.";
    case "balanced":
      return "Os três componentes operam em equilíbrio adequado.";
  }
}

export function coilEnvelopeToEquilibriumPoints(envelope: CoilEnvelope | undefined): EvaporatorEquilibriumPoint[] {
  return envelope?.envelope.map((point) => ({
    Te_C: point.Te,
    Q_W: point.Q_kcalh / 0.86,
  })) ?? [];
}

export function solveSystemEquilibrium(inputs: SystemEquilibriumInputs): SystemEquilibriumResult {
  const warnings: string[] = [];
  const convergencePath: SystemEquilibriumResult["convergencePath"] = [];
  let Te = -10;
  let Tc = 45;
  let outsideEnvelope = false;

  for (let i = 0; i < MAX_ITER; i++) {
    const comp = interpolateCompressorQ(inputs.compressorEnvelope, Te, Tc);
    const teResult = findTeEquilibrium(inputs.evaporatorEnvelope, comp.Q_W);
    const qCondNeeded = comp.Q_W + comp.W_W;
    const tcResult = findTcEquilibrium(inputs.condenserEnvelope, qCondNeeded);
    outsideEnvelope = outsideEnvelope || teResult.outside || tcResult.outside;

    const residual = Math.abs(teResult.value - Te) + Math.abs(tcResult.value - Tc);
    convergencePath.push({
      iteration: i + 1,
      Te_C: teResult.value,
      Tc_C: tcResult.value,
      residual,
    });

    Te = RELAXATION * Te + RELAXATION * teResult.value;
    Tc = RELAXATION * Tc + RELAXATION * tcResult.value;

    if (residual < TOL && !outsideEnvelope) {
      return buildResult(inputs, teResult.value, tcResult.value, true, i + 1, convergencePath, warnings);
    }
  }

  warnings.push("Motor não convergiu em 100 iterações — resultado estimado");
  return buildResult(inputs, Te, Tc, false, MAX_ITER, convergencePath, warnings);
}

export const calculateSystemEquilibrium = solveSystemEquilibrium;

function buildResult(
  inputs: SystemEquilibriumInputs,
  Te: number,
  Tc: number,
  converged: boolean,
  iterations: number,
  convergencePath: SystemEquilibriumResult["convergencePath"],
  baseWarnings: string[],
): SystemEquilibriumResult {
  const comp = interpolateCompressorQ(inputs.compressorEnvelope, Te, Tc);
  const Q_evap_W = interpolateEvaporatorQ(inputs.evaporatorEnvelope, Te);
  const Q_cond_W = interpolateCondenserQ(inputs.condenserEnvelope, Tc);
  const warnings = [...baseWarnings];

  const evapTeValues = inputs.evaporatorEnvelope.map(normalizeEvaporatorPoint).map((p) => p.Te_C);
  const condTcValues = inputs.condenserEnvelope.map(normalizeCondenserPoint).map((p) => p.Tc_C);
  if (Te < Math.min(...evapTeValues)) {
    warnings.push("Te de equilíbrio abaixo do envelope do evaporador — extrapolação");
  }
  if (Tc > Math.max(...condTcValues)) {
    warnings.push("Tc de equilíbrio acima do envelope do condensador — extrapolação");
  }
  if (comp.dischargeTemp_C > 130) warnings.push("⚠️ Temperatura de descarga crítica (>130°C)");
  else if (comp.dischargeTemp_C > 110) warnings.push("⚠️ Temperatura de descarga elevada (>110°C)");

  const partial = {
    Q_evap_W,
    Q_comp_W: comp.Q_W,
    Q_cond_W,
    W_comp_W: comp.W_W,
  };
  const bottleneck = identifyBottleneck(partial);
  return {
    converged,
    iterations,
    Te_eq_C: Te,
    Tc_eq_C: Tc,
    ...partial,
    COP_real: comp.W_W > 0 ? comp.Q_W / comp.W_W : 0,
    bottleneck,
    bottleneckReason: bottleneckReason(bottleneck),
    warnings,
    convergencePath,
  };
}

export function useSystemEquilibrium(initialInputs?: SystemEquilibriumInputs) {
  const [result, setResult] = useState<SystemEquilibriumResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback((inputs = initialInputs) => {
    if (!inputs) {
      setError("Inputs de equilíbrio ausentes.");
      setResult(null);
      return null;
    }
    setIsCalculating(true);
    setError(null);
    try {
      const next = solveSystemEquilibrium(inputs);
      setResult(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setResult(null);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [initialInputs]);

  return useMemo(() => ({ result, isCalculating, error, run }), [error, isCalculating, result, run]);
}
