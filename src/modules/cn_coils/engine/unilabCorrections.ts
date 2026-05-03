// Correção polinomial UNILAB de até 7ª ordem.
// factor = a0 + a1·V + a2·V² + ... + a7·V⁷  (V em m/s)
// Aplicada SOBRE Q_base, nunca sobre U ou NTU.

import type { AirVelocityCorrectionItem } from "../types/unilab.types";

export interface CorrectionResult {
  factor: number;
  warnings: string[];
  vUsedMs: number;
}

export function applyAirVelocityCorrection(
  geometryId: string,
  airVelocityMs: number,
  catalog: AirVelocityCorrectionItem[],
): CorrectionResult {
  const warnings: string[] = [];
  const item = catalog.find((c) => c.geometryId === geometryId);

  if (!item) {
    warnings.push(
      `Coeficientes de correção não encontrados para esta geometria. Usando valores neutros (1.0) — resultado é estimativa.`,
    );
    return { factor: 1.0, warnings, vUsedMs: airVelocityMs };
  }
  if (!Array.isArray(item.coefficients) || item.coefficients.length === 0) {
    warnings.push(
      `Coeficientes de correção não encontrados para esta geometria. Usando valores neutros (1.0) — resultado é estimativa.`,
    );
    return { factor: 1.0, warnings, vUsedMs: airVelocityMs };
  }
  if (item.coefficients.length > 8) {
    warnings.push(
      `Polinômio com mais de 8 coeficientes (${item.coefficients.length}). Apenas a0..a7 são considerados.`,
    );
  }

  let v = airVelocityMs;
  if (Number.isFinite(item.vMin) && v < item.vMin) {
    warnings.push(
      `Velocidade ${v.toFixed(2)} m/s abaixo da faixa válida (${item.vMin} m/s). Usando vMin no cálculo.`,
    );
    v = item.vMin;
  }
  if (Number.isFinite(item.vMax) && v > item.vMax) {
    warnings.push(
      `Velocidade ${v.toFixed(2)} m/s acima da faixa válida (${item.vMax} m/s). Usando vMax no cálculo.`,
    );
    v = item.vMax;
  }

  // Σ a_i · V^i, ignorando coeficientes com valor zero (escopo § 12).
  const coeffs = item.coefficients.slice(0, 8);
  let factor = 0;
  let powerOfV = 1;
  for (let i = 0; i < coeffs.length; i++) {
    const a = coeffs[i];
    if (a !== 0 && Number.isFinite(a)) {
      factor += a * powerOfV;
    }
    powerOfV *= v;
  }

  if (!Number.isFinite(factor) || factor <= 0) {
    warnings.push(
      `Fator calculado inválido (${factor}). Usando fator = 1.0.`,
    );
    return { factor: 1.0, warnings, vUsedMs: v };
  }
  return { factor, warnings, vUsedMs: v };
}
