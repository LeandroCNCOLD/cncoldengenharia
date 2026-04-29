/**
 * Tipos compartilhados para o motor físico simples e rastreabilidade.
 * Não substitui o motor empírico — convive com ele via toggle de engine.
 */

export type CoilEngine = "empirical" | "physical_simple" | "physical_advanced";

export type FieldOrigin =
  | "imported"   // veio do datasheet Unilab
  | "calculated" // derivado da geometria
  | "calibrated" // resultado calibrado contra Unilab
  | "estimated"  // valor default razoável
  | "manual";    // editado pelo usuário

export interface FieldProvenance {
  origin: FieldOrigin;
  source?: string;
  confidence?: number; // 0..1
  updatedAt?: string;
}

export type ProvenanceMap = Record<string, FieldProvenance>;

export interface CalibrationFactors {
  capacityCorrectionFactor: number; // multiplica Q
  airDpCorrectionFactor: number;    // multiplica ΔP ar
  refDpCorrectionFactor: number;    // multiplica ΔP refrigerante
  uaCorrectionFactor: number;       // multiplica U·A
  /** Alias canônico usado por partes novas da UI/motor. */
  airPressureDropFactor?: number;
  /** Alias canônico usado por partes novas da UI/motor. */
  refrigerantPressureDropFactor?: number;
  /** Alias canônico para rastreabilidade de troca térmica. */
  heatTransferFactor?: number;
}

export const NEUTRAL_CALIBRATION: CalibrationFactors = {
  capacityCorrectionFactor: 1,
  airDpCorrectionFactor: 1,
  refDpCorrectionFactor: 1,
  uaCorrectionFactor: 1,
  airPressureDropFactor: 1,
  refrigerantPressureDropFactor: 1,
  heatTransferFactor: 1,
};

/** Normaliza aliases camelCase e campos legados para evitar fator 1 por mismatch de nomes. */
export function normalizeCalibrationFactors(
  factors: CalibrationFactors | null | undefined,
): Required<CalibrationFactors> {
  const src = factors ?? NEUTRAL_CALIBRATION;
  const capacityCorrectionFactor = Number(src.capacityCorrectionFactor) || 1;
  const airPressureDropFactor = Number(src.airPressureDropFactor ?? src.airDpCorrectionFactor) || 1;
  const refrigerantPressureDropFactor =
    Number(src.refrigerantPressureDropFactor ?? src.refDpCorrectionFactor) || 1;
  const uaCorrectionFactor = Number(src.uaCorrectionFactor) || 1;
  return {
    capacityCorrectionFactor,
    airDpCorrectionFactor: airPressureDropFactor,
    refDpCorrectionFactor: refrigerantPressureDropFactor,
    uaCorrectionFactor,
    airPressureDropFactor,
    refrigerantPressureDropFactor,
    heatTransferFactor: Number(src.heatTransferFactor ?? uaCorrectionFactor) || 1,
  };
}

/** Metas de erro pós-calibração. */
export const CALIBRATION_TARGETS = {
  capacityPct: 5,
  airDpPct: 10,
  refDpPct: 15,
} as const;

export type CalibrationStatus = "calibrated" | "needs_review" | "draft";

export const CLAMP_FACTOR_MIN = 0.3;
export const CLAMP_FACTOR_MAX = 3.0;

export function confidenceScoreFor(status: CalibrationStatus, numPoints = 1): number {
  if (status === "draft") return 0.6;
  if (status === "needs_review") return 0.7;
  if (numPoints >= 3) return 0.95;
  if (numPoints === 2) return 0.9;
  return 0.85;
}

export function clampFactor(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(CLAMP_FACTOR_MAX, Math.max(CLAMP_FACTOR_MIN, v));
}
