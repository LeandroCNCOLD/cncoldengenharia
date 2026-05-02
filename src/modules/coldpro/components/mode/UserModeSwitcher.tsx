import { useUserModeStore } from "../../stores/useUserModeStore";
import type { UserMode } from "../../types/frontend.types";

const MODES: { value: UserMode; label: string }[] = [
  { value: "basic", label: "Básico" },
  { value: "intermediate", label: "Intermediário" },
  { value: "professional", label: "Profissional" },
];

interface UserModeSwitcherProps {
  variant?: "inline" | "compact";
  className?: string;
}

export function UserModeSwitcher({ variant = "inline", className = "" }: UserModeSwitcherProps) {
  const mode = useUserModeStore((s) => s.mode);
  const setMode = useUserModeStore((s) => s.setMode);

  if (variant === "compact") {
    return (
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as UserMode)}
        className={`rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#1E6FD9] focus:outline-none ${className}`}
      >
        {MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`flex w-full flex-wrap gap-0.5 rounded border border-white/10 bg-white/5 p-0.5 ${className}`}>
      {MODES.map((m) => {
        const active = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`flex-1 min-w-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
              active
                ? "bg-[#1E6FD9] text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
            title={m.label}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
