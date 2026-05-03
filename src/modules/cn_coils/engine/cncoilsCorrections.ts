// Correção polinomial CN Coils de até 7ª ordem.
// factor = a0 + a1·V + a2·V² + ... + a7·V⁷  (V em m/s)
// Aplicada SOBRE Q_base, nunca sobre U ou NTU.

import type { AirVelocityCorrectionItem } from "../types/cncoils.types";

export interface CorrectionResult {
  factor: number;
  warnings: string[];
  vUsedMs: number;
}

function selectCorrectionEntry(
  entries: AirVelocityCorrectionItem[],
  airVelocityMs: number,
): AirVelocityCorrectionItem | undefined {
  const inRange = entries.find(
    (entry) =>
      Number.isFinite(entry.vMin) &&
      Number.isFinite(entry.vMax) &&
      airVelocityMs >= entry.vMin &&
      airVelocityMs <= entry.vMax,
  );
  if (inRange) return inRange;

  return entries
    .filter((entry) => Number.isFinite(entry.vMin) && Number.isFinite(entry.vMax))
    .sort((a, b) => {
      const distanceA =
        airVelocityMs < a.vMin ? a.vMin - airVelocityMs : airVelocityMs - a.vMax;
      const distanceB =
        airVelocityMs < b.vMin ? b.vMin - airVelocityMs : airVelocityMs - b.vMax;
      return distanceA - distanceB;
    })[0] ?? entries[0];
}

export function applyAirVelocityCorrection(
  geometryId: string,
  airVelocityMs: number,
  catalog: AirVelocityCorrectionItem[],
): CorrectionResult {
  const warnings: string[] = [];
  let entries = catalog.filter((c) => c.geometryId === geometryId);

  if (entries.length === 0) {
    // O catálogo CN Coils original agrupa todas as geometrias ItipoB=1 sob
    // geometryId "1". Esse é o fallback esperado, não uma condição de alerta.
    entries = catalog.filter((c) => c.geometryId === "1");
  }

  const item = selectCorrectionEntry(entries, airVelocityMs);
  if (!item) {
    warnings.push("Catálogo de coeficientes CN Coils ausente ou vazio.");
    return { factor: 1.0, warnings, vUsedMs: airVelocityMs };
  }
  if (!Array.isArray(item.coefficients) || item.coefficients.length === 0) {
    warnings.push("Catálogo de coeficientes CN Coils ausente ou vazio.");
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

  // Σ a_i · V^i. O export CN Coils traz 7 coeficientes polinomiais e uma coluna
  // extra final próxima de 1; usá-la como termo V^7 explode o fator.
  const coeffs = item.coefficients.slice(0, 7);
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
