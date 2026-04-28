// Score, ranking e classificação das combinações.

import type { SelectionInput, SelectionRating, SelectionResult } from "./selectionTypes";
import { APPLICATION_RULES } from "./selectionTypes";

const CRITICAL_KEYWORDS = [
  "fora da faixa",
  "subdimensionado",
  "limitando",
  "abaixo da carga",
  "muito alto",
];

function isCriticalAlert(a: string): boolean {
  const low = a.toLowerCase();
  return CRITICAL_KEYWORDS.some((k) => low.includes(k));
}

export function computeScore(r: Omit<SelectionResult, "score" | "rating">, input: SelectionInput): number {
  let score = 100;

  if (r.coolingCapacityW < input.requiredLoadW) score -= 50;
  if (r.coolingCapacityW > input.requiredLoadW * 1.3) score -= 10;

  if (r.cop < 1.5) score -= 30;
  else if (r.cop < 2) score -= 10;

  for (const u of [r.compressorUtilization, r.evaporatorUtilization, r.condenserUtilization]) {
    if (u < 60) score -= 10;
    else if (u > 95) score -= 20;
  }

  const errPct = (r.balanceErrorW / Math.max(r.coolingCapacityW, 1)) * 100;
  if (errPct > 10) score -= 20;

  for (const a of r.alerts) if (isCriticalAlert(a)) score -= 15;

  return score;
}

export function classify(score: number): SelectionRating {
  if (score >= 80) return "ideal";
  if (score >= 60) return "bom";
  if (score >= 40) return "aceitável";
  return "ruim";
}

/** Reforça regras por aplicação: COP abaixo do mínimo nunca pode ser "ideal". */
export function enforceApplicationRules(
  r: SelectionResult,
  input: SelectionInput,
): SelectionResult {
  const minCOP =
    input.minCOP ??
    (input.applicationType ? APPLICATION_RULES[input.applicationType].minCOP : 0);
  const errPct = (r.balanceErrorW / Math.max(r.coolingCapacityW, 1)) * 100;
  const overload =
    r.compressorUtilization > 100 ||
    r.evaporatorUtilization > 100 ||
    r.condenserUtilization > 100;

  if (
    r.rating === "ideal" &&
    (r.cop < minCOP || errPct > 10 || overload)
  ) {
    return { ...r, rating: "bom" };
  }
  return r;
}

/** Ordena: score desc, COP desc, potência asc. */
export function sortResults(results: SelectionResult[]): SelectionResult[] {
  return [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.cop !== a.cop) return b.cop - a.cop;
    return a.powerInputW - b.powerInputW;
  });
}
