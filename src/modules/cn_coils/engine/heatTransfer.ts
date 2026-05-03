// Transferência de calor: geometria de face, LMTD e NTU-ε para escoamento
// cruzado (não misturado) — Incropera, "Fundamentals of Heat and Mass Transfer",
// Tabela 11.3.

import { mmToM, m3hToM3s, safeDivide } from "./units";

export function calculateFaceArea(heightMm: number, lengthMm: number): number {
  return mmToM(heightMm) * mmToM(lengthMm);
}

export function calculateFaceVelocity(airFlowM3H: number, faceAreaM2: number): number {
  if (faceAreaM2 <= 0) return 0;
  return safeDivide(m3hToM3s(airFlowM3H), faceAreaM2);
}

/**
 * LMTD para correntes em contracorrente / cruzado.
 * Retorna NaN-safe: se ΔT inválido, retorna 0 e cabe ao caller decidir.
 */
export function calculateLMTD(deltaT1: number, deltaT2: number): number {
  if (!Number.isFinite(deltaT1) || !Number.isFinite(deltaT2)) return 0;
  if (deltaT1 <= 0 || deltaT2 <= 0) return 0;
  if (Math.abs(deltaT1 - deltaT2) < 1e-9) return deltaT1;
  return (deltaT1 - deltaT2) / Math.log(deltaT1 / deltaT2);
}

export function calculateNTU(
  uWm2K: number,
  areaM2: number,
  cMinWk: number,
): number {
  if (cMinWk <= 0) return 0;
  return safeDivide(uWm2K * areaM2, cMinWk);
}

/**
 * Efetividade para escoamento cruzado (ambos fluidos não misturados).
 * Incropera, Tabela 11.3, Eq. 11.32:
 *   ε = 1 - exp[ (1/Cr) · NTU^0.22 · (exp(-Cr · NTU^0.78) - 1) ]
 *
 * Caso especial Cr = 0 (mudança de fase: evaporação/condensação):
 *   ε = 1 - exp(-NTU)
 *
 * NÃO usar ε = 1 - exp(-NTU) genericamente: superestima a efetividade
 * em escoamento cruzado.
 */
export function calculateCrossflowEffectiveness(ntu: number, cRatio: number): number {
  if (!Number.isFinite(ntu) || ntu <= 0) return 0;
  if (cRatio <= 0) {
    return 1 - Math.exp(-ntu);
  }
  const cr = Math.min(Math.max(cRatio, 0), 1);
  const exponent = (Math.pow(ntu, 0.22) / cr) * (Math.exp(-cr * Math.pow(ntu, 0.78)) - 1);
  const eps = 1 - Math.exp(exponent);
  if (!Number.isFinite(eps)) return 0;
  return Math.min(Math.max(eps, 0), 1);
}
