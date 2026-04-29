// ColdPro — Solver de equilíbrio: evaporador + compressor + condensador.
//
// Estratégia (ponto-fixo amortecido):
//   1. Chute inicial de Te, Tc (vindos do input).
//   2. Compressor → qComp(Te,Tc), W(Te,Tc), massFlow.
//   3. Evaporador (massFlow do comp) → qEvap(Te) com hRef ligado ao mass flow.
//   4. Condensador (massFlow do comp, qCond_alvo = qEvap + W) → qCondReal.
//   5. Ajusta:
//        - Te: se qEvap > qComp, diminui Te (sistema esfria evap); senão aumenta.
//        - Tc: se qCondReal < qComp + W, aumenta Tc; senão diminui.
//   6. Repete até |qEvap - qComp|/qComp < tol.
//
// Não pretende ser CFD — é o solver clássico de "equilíbrio de máquina"
// que casa as três curvas. Bottleneck = etapa de menor capacidade.

import type {
  Bottleneck,
  CompressorResult,
  SectionResult,
  SystemInput,
  SystemResult,
} from './systemTypes';
import { runCompressor } from './compressorEngine';
import { runEvaporator } from './evaporatorWrapper';
import { runCondenser } from './condenserWrapper';
import { runExpansionDevice } from './expansionDeviceEngine';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeUtilization(realW: number, capW: number): number {
  if (capW <= 0) return 0;
  return clamp(realW / capW, 0, 1);
}

function pickBottleneck(qEvap: number, qComp: number, qCond: number, tol: number): Bottleneck {
  const xs = [
    { name: 'evaporator' as const, q: qEvap },
    { name: 'compressor' as const, q: qComp },
    { name: 'condenser' as const, q: qCond },
  ].sort((a, b) => a.q - b.q);
  const min = xs[0];
  const max = xs[xs.length - 1];
  if (max.q > 0 && (max.q - min.q) / max.q < tol * 2) return 'balanced';
  return min.name;
}

export function simulateSystem(input: SystemInput): SystemResult {
  const tol = input.tolerance ?? 0.03;
  const maxIter = input.maxIterations ?? 25;
  const warnings: string[] = [];

  let te = input.evaporatingTempC;
  let tc = input.condensingTempC;

  // Limites físicos de busca
  const teMin = input.airInletEvapC - 30;
  const teMax = input.airInletEvapC - 1; // sempre abaixo do ar
  const tcMin = input.airInletCondC + 1; // sempre acima do ar
  const tcMax = input.airInletCondC + 35;

  let comp: CompressorResult = runCompressor({
    model: input.compressorModel,
    refrigerant: input.refrigerant,
    evaporatingTempC: te,
    condensingTempC: tc,
  });

  let evap: SectionResult = {
    capacityW: 0,
    uWm2K: 0,
    hAirWm2K: 0,
    hRefWm2K: 0,
    effectiveAreaM2: 0,
    warnings: [],
  };
  let cond: SectionResult = { ...evap };

  let iter = 0;
  let converged = false;
  let lastError = Number.POSITIVE_INFINITY;

  for (iter = 1; iter <= maxIter; iter++) {
    comp = runCompressor({
      model: input.compressorModel,
      refrigerant: input.refrigerant,
      evaporatingTempC: te,
      condensingTempC: tc,
    });

    runExpansionDevice({
      refrigerant: input.refrigerant,
      evaporatingTempC: te,
      condensingTempC: tc,
      targetSuperheatK: input.superheatK,
      compressorMassFlowKgh: comp.massFlowKgh,
    });

    evap = runEvaporator({
      geometryCode: input.evaporatorGeometryCode,
      refrigerant: input.refrigerant,
      airInletTempC: input.airInletEvapC,
      evaporatingTempC: te,
      airflowM3h: input.airflowEvapM3h,
      refrigerantMassFlowKgh: comp.massFlowKgh,
      relativeHumidityPct: 85,
    });

    cond = runCondenser({
      geometryCode: input.condenserGeometryCode,
      refrigerant: input.refrigerant,
      airInletTempC: input.airInletCondC,
      condensingTempC: tc,
      airflowM3h: input.airflowCondM3h,
      refrigerantMassFlowKgh: comp.massFlowKgh,
    });

    // ----- Critério de equilíbrio -----
    const qEvap = evap.capacityW;
    const qComp = comp.qCompW;
    const qCondTarget = qComp + comp.powerW;
    const qCond = cond.capacityW;

    const errEvap = qComp > 0 ? Math.abs(qEvap - qComp) / qComp : 1;
    const errCond = qCondTarget > 0 ? Math.abs(qCond - qCondTarget) / qCondTarget : 1;
    lastError = Math.max(errEvap, errCond);

    if (lastError < tol) {
      converged = true;
      break;
    }

    // ----- Ajustes (ponto-fixo amortecido) -----
    const damping = 0.4;

    // Te: se qEvap > qComp → evaporador "sobra" → Te cai (refrigerante mais frio)
    // Aproximação: ΔTe ∝ (qComp - qEvap) / (mAir·cpAir) escalado.
    const cpAir = 1005;
    const rhoAir = 1.2;
    const mAirEvap = (input.airflowEvapM3h / 3600) * rhoAir;
    const mAirCond = (input.airflowCondM3h / 3600) * rhoAir;

    if (mAirEvap > 0) {
      const dTe = ((qComp - qEvap) / (mAirEvap * cpAir)) * damping;
      te = clamp(te + dTe, teMin, teMax);
    }
    if (mAirCond > 0) {
      const dTc = ((qCondTarget - qCond) / (mAirCond * cpAir)) * damping;
      tc = clamp(tc + dTc, tcMin, tcMax);
    }
  }

  if (!converged) {
    warnings.push(
      `Solver não convergiu em ${maxIter} iterações (erro residual ${(lastError * 100).toFixed(1)}%).`,
    );
  }

  // Capacidade real = mínimo entre evap e comp (gargalo termodinâmico).
  const capacityRealW = Math.min(evap.capacityW, comp.qCompW);
  const cop = comp.powerW > 0 ? capacityRealW / comp.powerW : 0;

  // Capacidades nominais (referência teórica) para utilização:
  // - comp em Te=-10, Tc=45
  // - evap/cond em DT 10K — proxy: usamos a capacidade computada como denominador máximo.
  const compNominal = runCompressor({
    model: input.compressorModel,
    refrigerant: input.refrigerant,
    evaporatingTempC: -10,
    condensingTempC: 45,
  });

  const utilizationComp = computeUtilization(comp.qCompW, compNominal.qCompW || comp.qCompW);
  const utilizationEvap = computeUtilization(capacityRealW, evap.capacityW || capacityRealW);
  const utilizationCond = computeUtilization(comp.qCompW + comp.powerW, cond.capacityW || 1);

  const energyBalance =
    evap.capacityW > 0
      ? (cond.capacityW - (evap.capacityW + comp.powerW)) / evap.capacityW
      : 0;

  const bottleneck = pickBottleneck(evap.capacityW, comp.qCompW, cond.capacityW, tol);

  if (Math.abs(energyBalance) > 0.10) {
    warnings.push(
      `Balanço energético com desvio ${(energyBalance * 100).toFixed(1)}% (qCond vs qEvap+W).`,
    );
  }
  if (cop < 1.2 || cop > 4.0) {
    warnings.push(`COP fora da faixa típica (${cop.toFixed(2)}). Verifique inputs.`);
  }

  warnings.push(...comp.warnings, ...evap.warnings, ...cond.warnings);

  return {
    capacityRealW,
    compressorCapacityW: comp.qCompW,
    condenserCapacityW: cond.capacityW,
    evaporatorCapacityW: evap.capacityW,
    compressorPowerW: comp.powerW,
    cop,
    energyBalanceError: energyBalance,
    evaporatingTempC: te,
    condensingTempC: tc,
    utilizationEvap,
    utilizationCond,
    utilizationComp,
    bottleneck,
    iterations: iter,
    converged,
    evaporator: evap,
    condenser: cond,
    compressor: comp,
    warnings,
    debug: {
      tolerance: tol,
      maxIterations: maxIter,
      finalError: lastError,
      compressorNominalW: compNominal.qCompW,
    },
  };
}
