/**
 * useAIChatStore — Histórico persistente de conversas com a IA Especialista.
 * A chave é uma combinação de componentType + tabName, permitindo histórico
 * separado por contexto de equipamento e aba.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PersistedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string; // ISO string for safe persistence
}

export interface ChatSession {
  id: string;
  componentType: string;
  tabName: string;
  messages: PersistedMessage[];
  lastUpdated: string;
}

interface AIChatStore {
  sessions: Record<string, ChatSession>;
  getSession: (key: string) => ChatSession | undefined;
  saveSession: (key: string, session: ChatSession) => void;
  clearSession: (key: string) => void;
  clearAll: () => void;
}

export const buildSessionKey = (componentType: string, tabName: string) =>
  `${componentType}::${tabName}`;

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      getSession: (key) => get().sessions[key],
      saveSession: (key, session) =>
        set((s) => ({ sessions: { ...s.sessions, [key]: session } })),
      clearSession: (key) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[key];
          return { sessions: next };
        }),
      clearAll: () => set({ sessions: {} }),
    }),
    { name: "cn-cold-ai-chat" },
  ),
);
