// Lista de Passos de Aleta disponíveis na fábrica (ferramentas de estamparia).
// Valores em milímetros — somente estes podem ser selecionados pelo usuário,
// pois cada passo corresponde a um colar/ferramenta real.
export const FIN_PITCH_TOOLS_MM: readonly number[] = [
  1.6, 1.8, 2.0, 2.1, 2.5, 3.0, 3.2, 4.0, 4.2, 5.0, 6.0, 7.0, 8.0, 10.0, 12.0,
] as const;

/**
 * Faz o "match" do passo do catálogo com o valor mais próximo da lista
 * de ferramentas disponíveis. Útil quando uma geometria do CN Coils traz
 * um passo (ex.: 2.13) que não existe na fábrica.
 */
export function snapFinPitchToTool(pitchMm: number | undefined): number {
  if (typeof pitchMm !== "number" || !Number.isFinite(pitchMm) || pitchMm <= 0) {
    return FIN_PITCH_TOOLS_MM[4]!; // default 2.5
  }
  let best = FIN_PITCH_TOOLS_MM[0]!;
  let bestDiff = Math.abs(pitchMm - best);
  for (const v of FIN_PITCH_TOOLS_MM) {
    const d = Math.abs(pitchMm - v);
    if (d < bestDiff) {
      best = v;
      bestDiff = d;
    }
  }
  return best;
}
