import { runEquilibrium } from "./coldproEngineService";
import { askAssistant } from "./aiAssistantService";
import type {
  CatalogProduct,
  CatalogAuditItem,
  AuditStatus,
  AIAssistantMessage,
} from "../types/frontend.types";

function determineAuditStatus(deviation_pct: number): AuditStatus {
  const abs = Math.abs(deviation_pct);
  if (abs <= 3) return "approved";
  if (abs <= 10) return "needs_review";
  return "critical";
}

export async function auditProduct(product: CatalogProduct): Promise<CatalogAuditItem> {
  const result = runEquilibrium(product.system);

  let simulatedCapacity: number | null = null;
  let deviation: number | null = null;
  let bottlenecks: string[] = [];
  let simulationWarnings: string[] = [];

  if (result.success) {
    const data = result.data as unknown as {
      thermal_balance?: { q_evap_w?: number };
      bottleneck_codes?: string[];
    };
    simulatedCapacity = data.thermal_balance?.q_evap_w ?? null;
    if (simulatedCapacity !== null) {
      deviation =
        ((simulatedCapacity - product.declared_capacity_w) / product.declared_capacity_w) * 100;
    }
    bottlenecks = data.bottleneck_codes ?? [];
    simulationWarnings = result.warnings;
  }

  const auditStatus: AuditStatus =
    deviation !== null ? determineAuditStatus(deviation) : "needs_review";

  const aiPrompt = `
Produto: ${product.model} (${product.family}, ${product.line})
Refrigerante: ${product.refrigerant}
Capacidade declarada: ${product.declared_capacity_w} W
Capacidade simulada: ${simulatedCapacity !== null ? simulatedCapacity + " W" : "não calculada"}
Desvio: ${deviation !== null ? deviation.toFixed(1) + "%" : "N/A"}
Gargalos identificados: ${bottlenecks.join(", ") || "nenhum"}
Avisos do motor: ${simulationWarnings.join("; ") || "nenhum"}

Forneça:
1. Parecer técnico em 2-3 frases
2. Sugestões de correção (se houver)
`;

  let technicalOpinion = "Parecer técnico indisponível (IA não configurada).";
  let suggestions: string[] = [];

  try {
    const msg: AIAssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: aiPrompt,
      timestamp: new Date().toISOString(),
    };
    const aiResponse = await askAssistant([msg]);
    technicalOpinion = aiResponse;
    if (aiResponse.toLowerCase().includes("sugest")) {
      suggestions = ["Ver parecer técnico completo acima"];
    }
  } catch {
    // IA indisponível — continuar sem parecer
  }

  return {
    productId: product.id,
    model: product.model,
    family: product.family,
    declaredCapacity_w: product.declared_capacity_w,
    simulatedCapacity_w: simulatedCapacity,
    deviation_pct: deviation,
    auditStatus,
    bottlenecks,
    suggestions,
    technicalOpinion,
    simulationWarnings,
  };
}

export async function auditCatalog(
  products: CatalogProduct[],
  onProgress?: (completed: number, total: number) => void,
): Promise<CatalogAuditItem[]> {
  const results: CatalogAuditItem[] = [];
  for (let i = 0; i < products.length; i++) {
    const item = await auditProduct(products[i]);
    results.push(item);
    onProgress?.(i + 1, products.length);
  }
  return results;
}
