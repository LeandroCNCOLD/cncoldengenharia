// ============================================================
// TIPOS EXCLUSIVOS DO FRONTEND — não duplicar tipos do motor
// Importar tipos do motor sempre de '@/modules/coldpro_v2'
// ============================================================

import type {
  SystemComponentsInput,
  SystemEquilibriumResult,
  ProductPerformanceCurveResult,
  PolynomialGenerationResult,
  OperatingMapResult,
  ProductTechnicalRecord,
} from "@/modules/coldpro_v2";

// Modo de operação do usuário
export type UserMode = "basic" | "intermediate" | "professional";

// Sessão de cálculo — agrupa todos os resultados de uma sessão de trabalho
export interface CalculationSession {
  id: string;
  name: string;
  createdAt: string;
  mode: UserMode;
  systemInput: Partial<SystemComponentsInput>;
  lastEquilibriumResult?: SystemEquilibriumResult;
  lastCurveResult?: ProductPerformanceCurveResult;
  lastPolynomialResult?: PolynomialGenerationResult;
  lastMapResult?: OperatingMapResult;
  lastRecord?: ProductTechnicalRecord;
}

// Status de validação de um campo individual
export type FieldValidationStatus = "idle" | "valid" | "warning" | "error";

export interface FieldValidation {
  status: FieldValidationStatus;
  message?: string;
}

// Mensagem do assistente de IA
export interface AIAssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  context?: string;
  timestamp: string;
}

// Status de auditoria de um produto do catálogo
export type AuditStatus = "approved" | "needs_review" | "critical";

// Resultado da auditoria de um produto individual
export interface CatalogAuditItem {
  productId: string;
  model: string;
  family: string;
  declaredCapacity_w: number;
  simulatedCapacity_w: number | null;
  deviation_pct: number | null;
  auditStatus: AuditStatus;
  bottlenecks: string[];
  suggestions: string[];
  technicalOpinion: string;
  simulationWarnings: string[];
}

// Produto do catálogo CN COLD (para auditoria)
// Sem mock — será preenchido via importação CSV ou entrada manual
export interface CatalogProduct {
  id: string;
  model: string;
  family: string;
  line: string;
  refrigerant: string;
  declared_capacity_w: number;
  declared_cop: number;
  nominal_evap_temp_c: number;
  nominal_cond_temp_c: number;
  system: SystemComponentsInput;
}
