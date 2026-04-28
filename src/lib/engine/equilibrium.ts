// CN Cold Engineering — Solver de ponto de equilíbrio termodinâmico.
//
// Dado:  T_evap_alvo, T_ar_evap, T_ar_cond
// Encontra T_cond tal que:  Q_cond(T_cond) ≈ Q_evap + W_comp(T_evap, T_cond)
//
// Estratégia: varredura grossa (passo 0,5 °C) + refino bisection.

import {
  compressorCapacity,
  compressorPower,
  type AhriCoefficients,
  type OperationalRange,
} from "./ahri540";
import {
  condenserCapacity,
  evaporatorCapacity,
} from "./heat-exchanger";

export interface EquilibriumInput {
  tEvapTarget: number;
  tAirEvap: number;
  tAirCond: number;

  compressor: {
    coeffs: AhriCoefficients;
    range?: OperationalRange | null;
    capacityNominalW?: number;
  };
  evaporator: {
    ua: number;
    capacityNominalW: number;
  };
  condenser: {
    ua: number;
    capacityNominalW: number;
  };
}

export interface EquilibriumResult {
  tCondEq: number;
  qEvap: number;     // capacidade do evaporador no ponto
  qComp: number;     // capacidade do compressor no ponto
  wComp: number;     // potência elétrica do compressor [W]
  qCond: number;     // capacidade do condensador no ponto
  cop: number;       // qEvap / wComp
  balanceError: number;        // |qCond - (qEvap + wComp)| em W
  utilCompressor: number;      // qComp / max(qComp_range)
  utilEvaporator: number;      // qEvap / capNominal_evap
  utilCondenser: number;       // qCond / capNominal_cond
  bottleneck: "compressor" | "evaporador" | "condensador";
}

function balance(input: EquilibriumInput, tCond: number): {
  qEvap: number; qComp: number; wComp: number; qCond: number; err: number;
} {
  const qEvap = evaporatorCapacity(input.evaporator.ua, input.tAirEvap, input.tEvapTarget);
  const qComp = compressorCapacity(input.compressor.coeffs, input.tEvapTarget, tCond);
  const wComp = compressorPower(input.compressor.coeffs, input.tEvapTarget, tCond);
  const qCond = condenserCapacity(input.condenser.ua, tCond, input.tAirCond);
  // O equilíbrio do compressor exige Q_comp ≈ Q_evap; mas para o ponto operacional
  // a restrição dominante é o balanço térmico do condensador:
  //    Q_cond = Q_evap + W_comp
  const err = qCond - (qEvap + wComp);
  return { qEvap, qComp, wComp, qCond, err };
}

export function solveEquilibrium(input: EquilibriumInput): EquilibriumResult {
  const lower = input.tAirCond + 1;
  const upper = Math.min(85, (input.compressor.range?.t_cond_max ?? 70));

  // 1) Varredura grossa
  let bestT = lower;
  let bestAbs = Infinity;
  let bestSnap = balance(input, lower);
  for (let t = lower; t <= upper; t += 0.5) {
    const r = balance(input, t);
    const a = Math.abs(r.err);
    if (a < bestAbs) {
      bestAbs = a;
      bestT = t;
      bestSnap = r;
    }
  }

  // 2) Refino por bisection ao redor do melhor ponto
  let lo = Math.max(lower, bestT - 0.5);
  let hi = Math.min(upper, bestT + 0.5);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const rLo = balance(input, lo);
    const rMid = balance(input, mid);
    if (Math.sign(rLo.err) === Math.sign(rMid.err)) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (Math.abs(hi - lo) < 0.01) break;
  }
  const tCondEq = (lo + hi) / 2;
  const final = balance(input, tCondEq);

  // Se o refino piorou, usa o melhor da varredura
  const useFinal = Math.abs(final.err) <= bestAbs;
  const r = useFinal ? final : bestSnap;
  const tFinal = useFinal ? tCondEq : bestT;

  // Utilizações
  const compRef = input.compressor.capacityNominalW ?? r.qComp;
  const utilCompressor = compRef > 0 ? r.qEvap / compRef : 0;
  const utilEvaporator =
    input.evaporator.capacityNominalW > 0 ? r.qEvap / input.evaporator.capacityNominalW : 0;
  const utilCondenser =
    input.condenser.capacityNominalW > 0 ? r.qCond / input.condenser.capacityNominalW : 0;

  const utils = {
    compressor: utilCompressor,
    evaporador: utilEvaporator,
    condensador: utilCondenser,
  };
  const bottleneck = (Object.entries(utils).sort((a, b) => b[1] - a[1])[0][0]) as
    EquilibriumResult["bottleneck"];

  const cop = r.wComp > 0 ? r.qEvap / r.wComp : 0;

  return {
    tCondEq: tFinal,
    qEvap: r.qEvap,
    qComp: r.qComp,
    wComp: r.wComp,
    qCond: r.qCond,
    cop,
    balanceError: Math.abs(r.err),
    utilCompressor,
    utilEvaporator,
    utilCondenser,
    bottleneck,
  };
}
