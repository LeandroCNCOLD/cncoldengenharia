export function calculateNTU(U: number, A: number, Cmin: number): number {
  if (Cmin <= 0) return 0;
  return (U * A) / Cmin;
}

export function calculateEffectivenessCrossflowUnmixed(NTU: number, Cr: number): number {
  if (NTU <= 0) return 0;

  if (Cr <= 1e-10) {
    return 1 - Math.exp(-NTU);
  }

  const term = (Math.pow(NTU, 0.22) / Cr) * (Math.exp(-Cr * Math.pow(NTU, 0.78)) - 1);
  const epsilon = 1 - Math.exp(term);

  return Math.max(0, Math.min(1, epsilon));
}

export interface NTUHeatTransferParams {
  effectiveness: number;
  Cmin: number;
  hotIn_c: number;
  coldIn_c: number;
}

export interface NTUHeatTransferResult {
  Q_w: number;
  warnings: string[];
}

export function calculateHeatTransferByNTU(params: NTUHeatTransferParams): NTUHeatTransferResult {
  const warnings: string[] = [];

  if (params.effectiveness < 0 || params.effectiveness > 1) {
    warnings.push(`effectiveness fora da faixa: ${params.effectiveness.toFixed(4)}`);
  }

  const epsilon = Math.max(0, Math.min(1, params.effectiveness));
  const Q_max = params.Cmin * Math.abs(params.hotIn_c - params.coldIn_c);
  const Q_w = epsilon * Q_max;

  return { Q_w, warnings };
}
