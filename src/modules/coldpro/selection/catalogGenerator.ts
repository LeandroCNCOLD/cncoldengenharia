// Gera catálogo técnico, recomendações e relatórios a partir das seleções.

import type { ApplicationType, CatalogEntry, SelectionResult } from "./selectionTypes";

function inferApplication(tevapC: number, declared?: ApplicationType): ApplicationType {
  if (declared) return declared;
  if (tevapC <= -18) return "freezing";
  if (tevapC <= 0) return "storage";
  return "cooling";
}

export function generateCatalogEntries(
  results: SelectionResult[],
  refrigerant: string,
  application?: ApplicationType,
): CatalogEntry[] {
  return results
    .filter((r) => r.rating !== "ruim")
    .map((r, idx) => {
      const kW = r.coolingCapacityW / 1000;
      const app = inferApplication(r.tevapC, application);
      return {
        id: `cnsys-${idx + 1}`,
        name: `Sistema CN Cold - ${kW.toFixed(1)} kW`,
        description: `Compressor ${r.models.compressor} + Evaporador ${r.models.evaporator} + Condensador ${r.models.condenser}`,
        combination: r.combination,
        capacityW: r.coolingCapacityW,
        powerW: r.powerInputW,
        cop: r.cop,
        tevapC: r.tevapC,
        tcondC: r.tcondC,
        refrigerant,
        application: app,
        rating: r.rating,
      };
    });
}

export function generateRecommendations(r: SelectionResult): string[] {
  const recs: string[] = [];
  switch (r.bottleneck) {
    case "evaporator":
      recs.push("Evaporador limitando: considerar modelo maior ou aumentar ΔT.");
      break;
    case "condenser":
      recs.push("Condensador limitando: aumentar ventilação ou trocar por modelo maior.");
      break;
    case "compressor":
      recs.push("Compressor limitando: avaliar compressor de maior deslocamento.");
      break;
  }
  if (r.cop < 1.5) recs.push("Eficiência baixa: revisar refrigerante ou ponto operacional.");
  if (r.evaporatorUtilization > 95) recs.push("Evaporador saturado: dimensionar acima.");
  if (r.condenserUtilization > 95) recs.push("Condensador saturado: dimensionar acima.");
  return recs;
}

export function generateTechnicalReport(r: SelectionResult): {
  summary: string;
  bottleneckAnalysis: string;
  efficiency: string;
  recommendation: string;
} {
  const summary =
    `Capacidade: ${(r.coolingCapacityW / 1000).toFixed(2)} kW @ Tevap ${r.tevapC.toFixed(1)}°C / Tcond ${r.tcondC.toFixed(1)}°C. ` +
    `Potência: ${(r.powerInputW / 1000).toFixed(2)} kW. COP: ${r.cop.toFixed(2)}.`;

  const bottleneckAnalysis =
    r.bottleneck === "balanced"
      ? "Sistema equilibrado: nenhum componente é gargalo claro."
      : `Gargalo identificado no ${r.bottleneck}.`;

  const efficiency =
    r.cop >= 2.5
      ? "Eficiência alta para a aplicação."
      : r.cop >= 1.5
        ? "Eficiência média; aceitável."
        : "Eficiência baixa; revisar dimensionamento.";

  const recs = generateRecommendations(r);
  const recommendation =
    recs.length === 0
      ? `Classificação: ${r.rating}. Combinação adequada sem ressalvas.`
      : `Classificação: ${r.rating}. ${recs.join(" ")}`;

  return { summary, bottleneckAnalysis, efficiency, recommendation };
}
