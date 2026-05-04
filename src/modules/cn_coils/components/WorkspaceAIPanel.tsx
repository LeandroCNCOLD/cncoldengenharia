/**
 * WorkspaceAIPanel — wrapper conveniente para o WorkspaceAIChat.
 * Renderiza um botão "IA Especialista" + painel lateral fixo (fixed inset-y-0 right-0).
 * Uso:
 *   const [open, setOpen] = useState(false);
 *   <WorkspaceAIButton onClick={() => setOpen(true)} />
 *   <WorkspaceAIPanel open={open} onClose={() => setOpen(false)} context={aiContext} />
 */
import { Sparkles } from "lucide-react";
import { WorkspaceAIChat, type AIContext } from "./WorkspaceAIChat";

export function WorkspaceAIButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-500/15 transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5" />
      IA Especialista
    </button>
  );
}

interface WorkspaceAIPanelProps {
  open: boolean;
  onClose: () => void;
  context: AIContext;
}

export function WorkspaceAIPanel({ open, onClose, context }: WorkspaceAIPanelProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 shadow-2xl">
      <WorkspaceAIChat context={context} isOpen={open} onClose={onClose} />
    </div>
  );
}
