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
}

export const NEUTRAL_CALIBRATION: CalibrationFactors = {
  capacityCorrectionFactor: 1,
  airDpCorrectionFactor: 1,
  refDpCorrectionFactor: 1,
  uaCorrectionFactor: 1,
};

/** Metas de erro pós-calibração. */
export const CALIBRATION_TARGETS = {
  capacityPct: 5,
  airDpPct: 10,
  refDpPct: 15,
} as const;
