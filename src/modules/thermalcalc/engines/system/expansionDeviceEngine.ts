// ColdPro — Expansion device (placeholder).
// Implementação completa virá em etapa futura. Por ora, assume TXV ideal:
// vazão de massa atende exatamente a demanda do compressor, mantendo o superaquecimento alvo.
import type { Refrigerant } from './systemTypes';

export interface ExpansionInput {
  refrigerant: Refrigerant;
  evaporatingTempC: number;
  condensingTempC: number;
  targetSuperheatK: number;
  compressorMassFlowKgh: number;
}

export interface ExpansionResult {
  refrigerantMassFlowKgh: number;
  achievedSuperheatK: number;
  /** True se o dispositivo está saturando (perda de superaquecimento). */
  saturating: boolean;
  warnings: string[];
}

export function runExpansionDevice(input: ExpansionInput): ExpansionResult {
  return {
    refrigerantMassFlowKgh: input.compressorMassFlowKgh,
    achievedSuperheatK: input.targetSuperheatK,
    saturating: false,
    warnings: [],
  };
}
