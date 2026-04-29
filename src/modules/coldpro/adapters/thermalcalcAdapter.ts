/**
 * thermalcalcAdapter — Camada de orquestração ColdPro → thermalcalc.
 *
 * Esta é a ÚNICA porta pela qual o ColdPro chama o motor matemático.
 * Princípio: ColdPro orquestra (UI + persistência), thermalcalc calcula.
 *
 * Para Cursor: para evoluir o motor, edite `src/modules/thermalcalc/`
 * sem precisar abrir nenhum arquivo do ColdPro. Mantenha as assinaturas
 * abaixo estáveis — elas são o contrato público.
 */

import { Coil, System } from "@/modules/thermalcalc";
import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
  CoilGeometry,
} from "@/modules/thermalcalc/types/coilSimulatorTypes";
import { deriveCoilGeometry, type GeometryDerived } from "@/modules/thermalcalc/engines/coil/geometryDerived";
import { simulatePhysicalSimple } from "@/modules/thermalcalc/engines/coil/physicalSimpleEngine";
import { simulateDxEvaporator } from "@/modules/thermalcalc/engines/coil/dxEvaporatorSimulator";
import { simulateDxCondenser } from "@/modules/thermalcalc/engines/coil/dxCondenserSimulator";
import {
  simulateHybridCoil as _simulateHybridCoil,
  generateModelSignature,
  ENGINE_NAME,
  ENGINE_VERSION,
} from "@/modules/thermalcalc/engines/coil/internals/hybridCoilEngine";
import {
  calibrateAgainstReference as _calibrateAgainstReference,
} from "@/modules/thermalcalc/engines/coil/coilCalibration";
import type {
  CoilCalculationInput,
  CoilCalculationResult,
} from "@/modules/thermalcalc/engines/coil/internals/types";

// ============================================================
// 0) Entrypoint canônico — motor híbrido completo
// ============================================================
//
// Esta é a função preferida para qualquer tela/serviço que precise dos
// novos campos: hAir, hRef, U, área efetiva, eficiência de aleta, DTML,
// Q = U × Aeff × DTML, ΔP ar, ΔP refrigerante, warnings técnicos, source.
//
// O ColdPro NÃO deve recalcular nada — basta ler do retorno.

export function simulateHybridCoil(input: CoilCalculationInput): CoilCalculationResult {
  return _simulateHybridCoil(input);
}

export {
  generateModelSignature,
  ENGINE_NAME,
  ENGINE_VERSION,
  simulateDxEvaporator,
  simulateDxCondenser,
  simulatePhysicalSimple,
};

export const calibrateAgainstReference = _calibrateAgainstReference;

// Helpers de leitura (não recalculam — só extraem do resultado).
export const Readers = {
  airSide: (r: CoilCalculationResult) => ({
    hAirWm2K: r.hAirWm2K,
    correlation: r.correlationAir,
    pressureDropPa: r.airPressureDropPa,
  }),
  refrigerantSide: (r: CoilCalculationResult) => ({
    hRefWm2K: r.hRefWm2K,
    pressureDropKpa: r.refrigerantPressureDropKpa,
  }),
  heatTransfer: (r: CoilCalculationResult) => ({
    uWm2K: r.uWm2K,
    effectiveAreaM2: r.effectiveAreaM2,
    dtmlK: r.dtmlK,
    capacityW: r.capacityW,
    capacityKcalh: r.capacityKcalh,
  }),
  effectiveArea: (r: CoilCalculationResult) => ({
    effectiveAreaM2: r.effectiveAreaM2,
    finEfficiency: r.geometryResult?.finEfficiency,
    areaSource: r.geometryResult?.areaSource,
    areaDeviationPct: r.geometryResult?.areaDeviationPct,
  }),
} as const;

export type { CoilCalculationInput, CoilCalculationResult };

// ============================================================
// 1) Simulação de coil (entrypoint canônico)
// ============================================================

export interface SimulateCoilOptions {
  /**
   * Estratégia de simulação.
   *  - 'auto' (default): heurística — escolhe entre dxEvaporator/dxCondenser/physicalSimple.
   *  - 'physical': motor físico simples.
   *  - 'dxEvaporator' | 'dxCondenser': simuladores especializados.
   */
  strategy?: 'auto' | 'physical' | 'dxEvaporator' | 'dxCondenser';
}

export function simulateCoil(
  input: CoilSimulatorInput,
  opts: SimulateCoilOptions = {},
): CoilSimulatorResult {
  const strategy = opts.strategy ?? 'auto';

  if (strategy === 'physical') return simulatePhysicalSimple(input);
  if (strategy === 'dxEvaporator') return Coil.simulateDxEvaporator(input);
  if (strategy === 'dxCondenser') return Coil.simulateDxCondenser(input);

  // auto: usa coilType para decidir
  if (input.coilType === 'condenser') return Coil.simulateDxCondenser(input);
  if (input.coilType === 'evaporator') return Coil.simulateDxEvaporator(input);
  return simulatePhysicalSimple(input);
}

// ============================================================
// 2) Geometria derivada (área externa/interna, volume, etc.)
// ============================================================

export function calculateGeometry(geometry: CoilGeometry): GeometryDerived {
  return deriveCoilGeometry(geometry);
}

// ============================================================
// 3) Carga estimada de refrigerante (placeholder técnico)
// ============================================================

export interface RefrigerantChargeInput {
  geometry: CoilGeometry;
  /** Densidade do refrigerante na condição de operação (kg/m³). */
  refrigerantDensityKgM3?: number;
  /** Fração do volume interno ocupada por líquido (0–1). Default conservador 0.5. */
  liquidFraction?: number;
}

export interface RefrigerantChargeResult {
  internalVolumeL: number | null;
  estimatedChargeKg: number | null;
  /** True quando algum dado obrigatório faltou — UI deve sinalizar. */
  isEstimated: boolean;
  warnings: string[];
}

/**
 * Estimativa simples de carga: massa = ρ × V × fração.
 * Cálculo real (com perfil de qualidade ao longo do circuito) será evoluído
 * dentro de `thermalcalc/engines/coil` — manter assinatura estável.
 */
export function calculateRefrigerantCharge(
  input: RefrigerantChargeInput,
): RefrigerantChargeResult {
  const warnings: string[] = [];
  const derived = deriveCoilGeometry(input.geometry);
  const internalVolumeL = derived.internalVolumeL;

  if (internalVolumeL == null) {
    warnings.push("Volume interno não pôde ser calculado (geometria incompleta).");
    return { internalVolumeL: null, estimatedChargeKg: null, isEstimated: true, warnings };
  }

  const density = input.refrigerantDensityKgM3;
  if (!density || density <= 0) {
    warnings.push("Densidade do refrigerante não informada — carga estimada indisponível.");
    return { internalVolumeL, estimatedChargeKg: null, isEstimated: true, warnings };
  }

  const fraction = input.liquidFraction ?? 0.5;
  const volumeM3 = internalVolumeL / 1000;
  const massKg = density * volumeM3 * fraction;

  return {
    internalVolumeL,
    estimatedChargeKg: massKg,
    isEstimated: input.liquidFraction == null,
    warnings: input.liquidFraction == null
      ? [...warnings, "liquidFraction não informado; usando default 0.5."]
      : warnings,
  };
}

// ============================================================
// 4) Re-exports diretos para conveniência (apenas leitura)
// ============================================================

export const Engines = {
  Coil,
  System,
} as const;

export type { CoilSimulatorInput, CoilSimulatorResult, CoilGeometry };
