// CN Cold Engineering — Geração de recomendações com base no ponto de equilíbrio.

import type { EquilibriumResult } from "./equilibrium";

export type RecommendationPriority = "alta" | "media" | "baixa";

export interface Recommendation {
  priority: RecommendationPriority;
  type: string;
  title: string;
  description: string;
  impact?: string;
}

export function generateRecommendations(r: EquilibriumResult): Recommendation[] {
  const out: Recommendation[] = [];

  if (r.utilCompressor > 0.9 && r.utilEvaporator < 0.6) {
    out.push({
      priority: "alta",
      type: "aumentar_compressor",
      title: "Aumentar capacidade do compressor",
      description:
        "O compressor está saturado (>90%) enquanto o evaporador opera abaixo de 60%. " +
        "Um compressor maior libera capacidade frigorífica adicional.",
      impact: "+15% a +25% no COP",
    });
  }

  if (r.utilCondenser > 0.9) {
    out.push({
      priority: "alta",
      type: "aumentar_condensador",
      title: "Aumentar capacidade do condensador",
      description:
        "O condensador está no limite (>90%). Isso eleva T_cond, reduzindo o COP. " +
        "Considere um condensador maior ou melhor ventilação.",
      impact: "Reduz T_cond e melhora o COP",
    });
  }

  if (r.utilEvaporator > 0.9 && r.utilCompressor < 0.7) {
    out.push({
      priority: "media",
      type: "aumentar_evaporador",
      title: "Aumentar capacidade do evaporador",
      description:
        "O evaporador está no limite enquanto o compressor tem folga. " +
        "Um evaporador maior aproveita melhor o compressor.",
    });
  }

  if (r.cop < 1.5) {
    out.push({
      priority: "media",
      type: "cop_baixo",
      title: "COP abaixo do esperado",
      description:
        `COP de ${r.cop.toFixed(2)} indica baixa eficiência. ` +
        "Revise temperaturas de operação e dimensionamento dos trocadores.",
    });
  }

  if (r.balanceError > 0.05 * r.qEvap && r.qEvap > 0) {
    out.push({
      priority: "baixa",
      type: "balanco",
      title: "Erro de balanço térmico relevante",
      description:
        `Erro de ${(r.balanceError / 1000).toFixed(2)} kW (>5% da carga). ` +
        "Verifique se T_ar_cond está dentro da faixa operacional do compressor.",
    });
  }

  if (out.length === 0) {
    out.push({
      priority: "baixa",
      type: "ok",
      title: "Sistema balanceado",
      description: "As utilizações estão equilibradas e o COP é coerente. Sem ajustes urgentes.",
    });
  }

  return out;
}
