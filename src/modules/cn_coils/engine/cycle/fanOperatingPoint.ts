/**
 * Solver de ponto de operação do ventilador.
 *
 * Encontra o equilíbrio entre a curva de pressão do ventilador e a curva de
 * resistência do sistema (trocador + dutos).
 */

import {
  evaluateFanCurve,
  type AxialFanRecord,
} from "../../services/cncoilsCoefficientsService";

export interface FanOperatingPointInputs {
  fanRecord: AxialFanRecord;
  fanCount: number;
  systemResistanceFn: (airFlowM3H: number) => Promise<number>;
  flowMin_m3h?: number;
  flowMax_m3h?: number;
  tolerancePa?: number;
  maxIterations?: number;
}

export interface FanOperatingPointResult {
  airFlowM3H: number;
  staticPressurePa: number;
  fanPressurePa: number;
  systemResistancePa: number;
  iterations: number;
  converged: boolean;
  warnings: string[];
}

function nominalFlowM3H(fanRecord: AxialFanRecord): number {
  const recordWithNominal = fanRecord as AxialFanRecord & { airflow_m3h?: number };
  if (Number.isFinite(recordWithNominal.airflow_m3h) && recordWithNominal.airflow_m3h! > 0) {
    return recordWithNominal.airflow_m3h!;
  }
  if (fanRecord.xMin > 0 && fanRecord.xMax > fanRecord.xMin) {
    return (fanRecord.xMin + fanRecord.xMax) / 2;
  }
  if (fanRecord.xMax > 0) return fanRecord.xMax;
  return 5000;
}

function fanPressurePa(fanRecord: AxialFanRecord, airflowM3H: number): number {
  const pressure = evaluateFanCurve(fanRecord, airflowM3H);
  if (pressure != null && Number.isFinite(pressure)) return Math.max(0, pressure);

  // Fallback apenas para testes/curvas incompletas: curva linear conservadora.
  const nominal = nominalFlowM3H(fanRecord);
  return Math.max(0, 300 - 0.01 * (airflowM3H / Math.max(nominal / 5000, 1e-6)));
}

export async function findFanOperatingPoint(
  inputs: FanOperatingPointInputs,
): Promise<FanOperatingPointResult> {
  const warnings: string[] = [];
  const fanCount = Math.max(1, Math.floor(inputs.fanCount) || 1);
  const tol = inputs.tolerancePa ?? 5;
  const maxIter = inputs.maxIterations ?? 50;
  const nominalFlow = nominalFlowM3H(inputs.fanRecord) * fanCount;
  const flowMin = inputs.flowMin_m3h ?? nominalFlow * 0.1;
  const flowMax = inputs.flowMax_m3h ?? nominalFlow * 1.1;

  async function f(Q_m3h: number): Promise<number> {
    const pFan = fanPressurePa(inputs.fanRecord, Q_m3h / fanCount);
    const pSystem = await inputs.systemResistanceFn(Q_m3h);
    return pFan - pSystem;
  }

  const fMin = await f(flowMin);
  const fMax = await f(flowMax);

  if (fMin < 0) {
    const pFan = fanPressurePa(inputs.fanRecord, flowMin / fanCount);
    const pSystem = await inputs.systemResistanceFn(flowMin);
    warnings.push(
      `Ventilador insuficiente: pressão disponível (${pFan.toFixed(0)} Pa) menor que a resistência do sistema na vazão mínima. Usando Q_min como ponto de operação.`,
    );
    return {
      airFlowM3H: flowMin,
      staticPressurePa: pFan,
      fanPressurePa: pFan,
      systemResistancePa: pSystem,
      iterations: 0,
      converged: false,
      warnings,
    };
  }

  if (fMax > 0) {
    const pFan = fanPressurePa(inputs.fanRecord, flowMax / fanCount);
    const pSystem = await inputs.systemResistanceFn(flowMax);
    warnings.push(
      "Ventilador superdimensionado: pressão disponível excede a resistência do sistema em toda a faixa. Usando Q_max como ponto de operação conservador.",
    );
    return {
      airFlowM3H: flowMax,
      staticPressurePa: pFan,
      fanPressurePa: pFan,
      systemResistancePa: pSystem,
      iterations: 0,
      converged: false,
      warnings,
    };
  }

  let lo = flowMin;
  let hi = flowMax;
  let qEq = (lo + hi) / 2;
  let iter = 0;

  while (iter < maxIter) {
    qEq = (lo + hi) / 2;
    const fMid = await f(qEq);
    if (Math.abs(fMid) < tol) break;
    if (fMid > 0) lo = qEq;
    else hi = qEq;
    iter++;
  }

  const pFanEq = fanPressurePa(inputs.fanRecord, qEq / fanCount);
  const pSystemEq = await inputs.systemResistanceFn(qEq);
  const converged = Math.abs(pFanEq - pSystemEq) < tol;

  if (!converged) {
    warnings.push(
      `Solver de ponto de operação não convergiu em ${maxIter} iterações. Erro residual: ${Math.abs(pFanEq - pSystemEq).toFixed(1)} Pa. Usando melhor estimativa: Q = ${qEq.toFixed(0)} m³/h.`,
    );
  }

  return {
    airFlowM3H: qEq,
    staticPressurePa: pFanEq,
    fanPressurePa: pFanEq,
    systemResistancePa: pSystemEq,
    iterations: iter,
    converged,
    warnings,
  };
}

export function findFanOperatingPointSimple(
  fanRecord: AxialFanRecord,
  fanCount: number,
  knownFlowM3H: number,
  knownPressurePa: number,
): { airFlowM3H: number; staticPressurePa: number; warnings: string[] } {
  const warnings: string[] = [];
  const count = Math.max(1, Math.floor(fanCount) || 1);
  const nominalFlow = nominalFlowM3H(fanRecord) * count;
  const k = knownPressurePa > 0 && knownFlowM3H > 0
    ? knownPressurePa / (knownFlowM3H * knownFlowM3H)
    : 0;

  if (!(k > 0)) {
    return {
      airFlowM3H: knownFlowM3H,
      staticPressurePa: fanPressurePa(fanRecord, knownFlowM3H / count),
      warnings: ["Ponto de operação não calculado: ΔP conhecido inválido."],
    };
  }

  let lo = nominalFlow * 0.1;
  let hi = nominalFlow * 1.1;

  for (let i = 0; i < 50; i++) {
    const qMid = (lo + hi) / 2;
    const pFan = fanPressurePa(fanRecord, qMid / count);
    const pSystem = k * qMid * qMid;
    if (pFan > pSystem) lo = qMid;
    else hi = qMid;
    if (Math.abs(pFan - pSystem) < 5) break;
  }

  const qEq = (lo + hi) / 2;
  const pEq = fanPressurePa(fanRecord, qEq / count);
  return { airFlowM3H: qEq, staticPressurePa: pEq, warnings };
}
