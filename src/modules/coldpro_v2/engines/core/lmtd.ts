export interface LMTDParams {
  hotIn_c: number;
  hotOut_c: number;
  coldIn_c: number;
  coldOut_c: number;
}

export interface LMTDResult {
  lmtd_k: number | null;
  warnings: string[];
}

export function calculateLMTD(params: LMTDParams): LMTDResult {
  const warnings: string[] = [];

  const deltaT1 = params.hotIn_c - params.coldOut_c;
  const deltaT2 = params.hotOut_c - params.coldIn_c;

  if (deltaT1 <= 0 || deltaT2 <= 0) {
    warnings.push("deltaT1 ou deltaT2 <= 0; LMTD não pode ser calculado");
    return { lmtd_k: null, warnings };
  }

  const ratio = deltaT1 / deltaT2;
  if (Math.abs(ratio - 1) < 1e-6) {
    return { lmtd_k: (deltaT1 + deltaT2) / 2, warnings };
  }

  const lmtd = (deltaT1 - deltaT2) / Math.log(ratio);
  return { lmtd_k: lmtd, warnings };
}

export interface HeatTransferByLMTDParams {
  u_w_m2k: number;
  area_m2: number;
  lmtd_k: number;
  correctionFactor?: number;
}

export function calculateHeatTransferByLMTD(params: HeatTransferByLMTDParams): number {
  const F = params.correctionFactor ?? 1;
  return params.u_w_m2k * params.area_m2 * params.lmtd_k * F;
}
