import { Sparkles } from "lucide-react";

interface AIAssistantButtonProps {
  onClick: () => void;
  label?: string;
}

export function AIAssistantButton({ onClick, label = "IA Assistente" }: AIAssistantButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#1E6FD9]/20 bg-[#1E6FD9]/10 px-2.5 py-1.5 text-xs font-medium text-[#1E6FD9] transition hover:bg-[#1E6FD9]/15"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
