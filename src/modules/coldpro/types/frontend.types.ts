// Tipos exclusivos do frontend ColdPro.
// REGRA: nunca duplicar tipos do motor — re-exporte de @/modules/coldpro_v2.

import type {
  Equipment,
  EquipmentType,
  ProductTechnicalRecord,
  ProductPerformanceCurveResult,
  PolynomialGenerationResult,
  OperatingMapResult,
  SystemEquilibriumResult,
} from "@/modules/coldpro_v2";

// ---------------------------------------------------------------------------
// Modos de operação da UI
// ---------------------------------------------------------------------------

export type UserMode = "engineer" | "operator" | "viewer";

export type ScreenSection =
  | "dashboard"
  | "catalog"
  | "performance"
  | "polynomial"
  | "operating-map"
  | "equilibrium"
  | "technical-record"
  | "ai-assistant";

// ---------------------------------------------------------------------------
// Sessão técnica do usuário (Zustand)
// ---------------------------------------------------------------------------

export interface ActiveProductSnapshot {
  readonly id: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly type: EquipmentType | null;
  readonly equipment: Equipment | null;
  readonly record: ProductTechnicalRecord | null;
}

export interface SessionResultsCache {
  readonly performance: ProductPerformanceCurveResult | null;
  readonly polynomial: PolynomialGenerationResult | null;
  readonly operatingMap: OperatingMapResult | null;
  readonly equilibrium: SystemEquilibriumResult | null;
}

// ---------------------------------------------------------------------------
// Catálogo (frontend view)
// ---------------------------------------------------------------------------

export interface CatalogEntry {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly type: EquipmentType;
  readonly nominalCapacityW: number | null;
  readonly raw: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogFilter {
  readonly brand?: string;
  readonly type?: EquipmentType;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CatalogPage {
  readonly items: readonly CatalogEntry[];
  readonly total: number;
  readonly hasMore: boolean;
}

// ---------------------------------------------------------------------------
// AI Assistant
// ---------------------------------------------------------------------------

export type AIAssistantRole = "user" | "assistant" | "system";

export interface AIAssistantMessage {
  readonly id: string;
  readonly role: AIAssistantRole;
  readonly content: string;
  readonly createdAt: number;
}

export interface AIAssistantContext {
  readonly userMode: UserMode;
  readonly activeProductId: string | null;
  readonly section: ScreenSection | null;
}

export interface AIAssistantRequest {
  readonly prompt: string;
  readonly context: AIAssistantContext;
  readonly history?: readonly AIAssistantMessage[];
}

export interface AIAssistantResponse {
  readonly message: AIAssistantMessage;
  readonly tokensUsed: number | null;
}

// ---------------------------------------------------------------------------
// Erros estruturados do service layer
// ---------------------------------------------------------------------------

export type ServiceErrorCode =
  | "NOT_IMPLEMENTED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export class ServiceError extends Error {
  public readonly code: ServiceErrorCode;
  public readonly details: Record<string, unknown> | null;

  constructor(
    code: ServiceErrorCode,
    message: string,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
  }
}
