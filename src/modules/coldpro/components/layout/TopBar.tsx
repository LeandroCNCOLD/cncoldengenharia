import { Bell, Settings } from "lucide-react";
import { useUserModeStore } from "../../stores/useUserModeStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { AIAssistantButton } from "../ai/AIAssistantButton";
import type { UserMode } from "../../types/frontend.types";

const MODE_LABEL: Record<UserMode, string> = {
  basic: "Básico",
  intermediate: "Intermediário",
  professional: "Profissional",
};

const MODE_BADGE: Record<UserMode, string> = {
  basic: "bg-slate-100 text-slate-700",
  intermediate: "bg-blue-100 text-[#1E6FD9]",
  professional: "bg-indigo-100 text-indigo-700",
};

interface TopBarProps {
  onToggleAI: () => void;
}

export function TopBar({ onToggleAI }: TopBarProps) {
  const mode = useUserModeStore((s) => s.mode);
  const activeSession = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === s.activeSessionId),
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-xs uppercase tracking-wider text-slate-400">Sessão</span>
        {activeSession ? (
          <span className="font-medium text-slate-800">{activeSession.name}</span>
        ) : (
          <span className="text-slate-400">Nenhuma sessão ativa</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MODE_BADGE[mode]}`}
          title="Modo do usuário"
        >
          {MODE_LABEL[mode]}
        </span>

        <AIAssistantButton onClick={onToggleAI} />

        <button
          type="button"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Configurações"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
