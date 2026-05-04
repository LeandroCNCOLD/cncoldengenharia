import type { ReactNode } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceInputsSidebarProps {
  /** Conteúdo dos grupos de parâmetros (geralmente um Accordion). */
  children: ReactNode;
  onCalculate: () => void;
  onReset?: () => void;
  isCalculating?: boolean;
  canCalculate?: boolean;
  calculateLabel?: string;
}

/**
 * Sidebar genérica para inputs de workspace.
 * Não confundir com `WorkspaceSidebar` legado (acoplado ao CnCoilsWorkspacePage).
 */
export function WorkspaceInputsSidebar({
  children,
  onCalculate,
  onReset,
  isCalculating,
  canCalculate = true,
  calculateLabel = "Calcular",
}: WorkspaceInputsSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
      <div className="shrink-0 space-y-2 border-t border-border bg-card/80 p-3">
        <Button
          onClick={onCalculate}
          disabled={!canCalculate || isCalculating}
          className="w-full gap-1.5"
        >
          {isCalculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isCalculating ? "Calculando…" : calculateLabel}
        </Button>
        {onReset && (
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={isCalculating}
            className="w-full gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar
          </Button>
        )}
      </div>
    </div>
  );
}
