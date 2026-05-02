import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { askAssistant, buildFieldHelpPrompt } from "../../services/aiAssistantService";
import type { AIAssistantMessage } from "../../types/frontend.types";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface FieldHelpTooltipProps {
  fieldName: string;
  value: unknown;
  context: string;
}

export function FieldHelpTooltip({ fieldName, value, context }: FieldHelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const ask = async () => {
    setOpen(true);
    if (response || loading) return;
    setLoading(true);
    try {
      const prompt = buildFieldHelpPrompt(fieldName, value, context);
      const message: AIAssistantMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      const reply = await askAssistant([message], context);
      setResponse(reply);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => void ask()}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#1E6FD9] hover:bg-[#1E6FD9]/10"
      >
        <Sparkles className="h-3 w-3" />
        Ajuda IA
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-slate-900">Sobre “{fieldName}”</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {loading ? (
            <LoadingSpinner size="sm" label="Consultando…" />
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{response}</p>
          )}
        </div>
      )}
    </div>
  );
}
