import { useEffect, useState } from "react";
import { Send, X, Trash2, Sparkles } from "lucide-react";
import { useAIAssistant } from "../../hooks/useAIAssistant";
import { useSessionStore } from "../../stores/useSessionStore";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface AIAssistantPanelProps {
  onClose: () => void;
}

export function AIAssistantPanel({ onClose }: AIAssistantPanelProps) {
  const { messages, isLoading, sendMessage, clearMessages, setContext } = useAIAssistant();
  const activeSession = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === s.activeSessionId),
  );
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (activeSession) {
      setContext(
        `Sessão "${activeSession.name}" (modo ${activeSession.mode}). ` +
          `Inputs: ${JSON.stringify(activeSession.systemInput)}.`,
      );
    } else {
      setContext("");
    }
  }, [activeSession, setContext]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    await sendMessage(text);
  };

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#1E6FD9]" />
          <h2 className="text-sm font-semibold text-slate-900">IA Assistente</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearMessages}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Limpar conversa"
            title="Limpar conversa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
            Pergunte sobre parâmetros, gargalos ou interpretação do motor.
            {activeSession && (
              <p className="mt-2 text-slate-400">
                Contexto: <span className="font-medium">{activeSession.name}</span>
              </p>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[#1E6FD9] text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <LoadingSpinner size="sm" label="Pensando…" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={2}
            placeholder="Mensagem para o assistente…"
            className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!draft.trim() || isLoading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#1E6FD9] text-white transition hover:bg-[#1858b0] disabled:bg-slate-300"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
