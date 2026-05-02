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
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="hidden text-[10px] uppercase tracking-wider text-slate-400 sm:inline">
          Sessão
        </span>
        {activeSession ? (
          <span className="truncate font-medium text-slate-800">{activeSession.name}</span>
        ) : (
          <span className="truncate text-slate-400">Nenhuma sessão ativa</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${MODE_BADGE[mode]}`}
          title="Modo do usuário"
        >
          {MODE_LABEL[mode]}
        </span>

        <AIAssistantButton onClick={onToggleAI} />

        <button
          type="button"
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notificações"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Configurações"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
