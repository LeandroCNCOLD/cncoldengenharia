// AI Assistant — service layer (stub tipado no client).
//
// O backend (server function chamando Lovable AI Gateway) ainda não foi
// criado nesta rodada. A assinatura abaixo é a contratual; quando o
// `aiAssistant.functions.ts` existir, basta importar `askAssistant` de lá
// dentro do `sendMessage` e remover o throw.

import type {
  AIAssistantMessage,
  AIAssistantRequest,
  AIAssistantResponse,
} from "../types/frontend.types";
import { ServiceError } from "../types/frontend.types";

function generateMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createUserMessage(content: string): AIAssistantMessage {
  return {
    id: generateMessageId(),
    role: "user",
    content,
    createdAt: Date.now(),
  };
}

export function createAssistantMessage(content: string): AIAssistantMessage {
  return {
    id: generateMessageId(),
    role: "assistant",
    content,
    createdAt: Date.now(),
  };
}

export interface AIAssistantStatus {
  readonly available: boolean;
  readonly reason: string | null;
}

export function getAIAssistantStatus(): AIAssistantStatus {
  return {
    available: false,
    reason: "Backend do assistente ainda não foi conectado.",
  };
}

export async function sendMessage(
  _request: AIAssistantRequest,
): Promise<AIAssistantResponse> {
  throw new ServiceError(
    "NOT_IMPLEMENTED",
    "AI Assistant ainda não está disponível neste build.",
  );
}
