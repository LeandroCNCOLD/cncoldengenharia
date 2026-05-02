// Coeficiente global U.
//
// Estratégia confirmada com o usuário (Fase 2):
//   - Se a geometria do catálogo fornece uBaseWm2K, usar como ponto de partida.
//   - Aplicar ajuste por velocidade do ar com expoente característico de
//     correlações tipo Chang-Wang (h_ext ∝ V^0.5..0.6 → U ∝ V^β).
//   - Subtrair a resistência de parede (D_ext - D_int) / (2·λ) para o tubo
//     real escolhido pelo usuário.
//   - NUNCA usar valor fixo arbitrário para U. Sem uBase → bloqueia.
//
// O lado interno (Dittus-Boelter / Shah) NÃO é recalculado aqui porque a
// estratégia é tratar uBase como já incorporando a resistência interna típica
// da família UNILAB. A correção polinomial UNILAB cobre desvios.

import { mmToM, safeDivide } from "./units";

export interface OverallUParams {
  airVelocityMs: number;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
  tubeMaterialConductivity: number; // W/(m·K)
  finPitchMm: number;
  uBaseWm2K?: number;
  /** Velocidade de referência usada na medição de uBase. Padrão UNILAB ≈ 2.5 m/s. */
  vReferenceMs?: number;
  /** Expoente da relação U ~ V^β (tipicamente 0.5..0.6). Padrão 0.55. */
  velocityExponent?: number;
}

export interface OverallUResult {
  uWm2K: number;
  warnings: string[];
}

const DEFAULT_V_REF = 2.5;
const DEFAULT_BETA = 0.55;

export function calculateOverallU(params: OverallUParams): OverallUResult {
  const warnings: string[] = [];

  if (!params.uBaseWm2K || params.uBaseWm2K <= 0) {
    warnings.push(
      "Geometria sem uBaseWm2K no catálogo UNILAB — coeficiente U não pode ser estimado.",
    );
    return { uWm2K: 0, warnings };
  }
  if (params.tubeMaterialConductivity <= 0) {
    warnings.push("Condutividade do tubo inválida — usando uBase sem correção de parede.");
  }
  if (params.airVelocityMs <= 0) {
    warnings.push("Velocidade de face nula — coeficiente U não pode ser corrigido.");
    return { uWm2K: params.uBaseWm2K, warnings };
  }

  const vRef = params.vReferenceMs ?? DEFAULT_V_REF;
  const beta = params.velocityExponent ?? DEFAULT_BETA;

  // Ajuste por velocidade — relação empírica para aletas planas/onduladas.
  const velocityRatio = params.airVelocityMs / vRef;
  const uVelocityCorrected = params.uBaseWm2K * Math.pow(velocityRatio, beta);

  // Resistência da parede do tubo escolhido (W/m²K)^-1 referenciada à área externa.
  // R_parede = (D_ext - D_int) / (2 · λ_material), aproximação cilíndrica fina.
  const dExtM = mmToM(params.tubeOuterDiameterMm);
  const dIntM = mmToM(params.tubeInnerDiameterMm);
  let rWallM2KW = 0;
  if (params.tubeMaterialConductivity > 0 && dExtM > dIntM && dIntM > 0) {
    // (D_ext / (2·λ)) · ln(D_ext/D_int)  é a forma exata; mantemos a forma
    // simplificada do escopo, que difere em <2% para tubos finos.
    rWallM2KW = (dExtM - dIntM) / (2 * params.tubeMaterialConductivity);
  }

  // 1/U_final = 1/U_corrigido + R_parede
  const oneOverU = 1 / uVelocityCorrected + rWallM2KW;
  const uFinal = safeDivide(1, oneOverU);

  if (!Number.isFinite(uFinal) || uFinal <= 0) {
    warnings.push("Coeficiente U calculado inválido.");
    return { uWm2K: 0, warnings };
  }
  return { uWm2K: uFinal, warnings };
}
