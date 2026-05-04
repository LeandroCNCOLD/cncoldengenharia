/**
 * EnrichedWarningsPanel.tsx
 * Exibe avisos/alarmes enriquecidos com explicação técnica e sugestões de correção.
 */
import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EnrichedWarning, WarningSeverity } from "../utils/warningEnricher";

interface EnrichedWarningsPanelProps {
  warnings: EnrichedWarning[];
  compact?: boolean;
}

const SEVERITY_CONFIG: Record<
  WarningSeverity,
  { icon: typeof AlertTriangle; color: string; bg: string; border: string; label: string }
> = {
  error: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-500/8",
    border: "border-red-500/30",
    label: "Erro",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-500/8",
    border: "border-yellow-500/30",
    label: "Aviso",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/8",
    border: "border-blue-500/30",
    label: "Info",
  },
};

function WarningCard({ warning }: { warning: EnrichedWarning }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[warning.severity];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${cfg.color}`}>{warning.title}</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${cfg.color} border-current`}
            >
              {cfg.label}
            </Badge>
          </div>
          {!expanded && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {warning.explanation}
            </p>
          )}
          {expanded && (
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Por que está errado
                </p>
                <p className="mt-0.5 text-xs text-foreground/80">{warning.explanation}</p>
              </div>
              <div className={`rounded-md border ${cfg.border} bg-background/60 p-2`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Wrench className={`h-3 w-3 ${cfg.color}`} />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Como corrigir
                  </p>
                </div>
                <p className="text-xs text-foreground/90">{warning.suggestion}</p>
              </div>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function EnrichedWarningsPanel({ warnings, compact = false }: EnrichedWarningsPanelProps) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/8 px-3 py-2">
        <Info className="h-4 w-4 text-green-500" />
        <span className="text-xs text-green-600 dark:text-green-400">
          Nenhum aviso — parâmetros dentro dos limites recomendados.
        </span>
      </div>
    );
  }

  const errors = warnings.filter((w) => w.severity === "error");
  const warningsOnly = warnings.filter((w) => w.severity === "warning");
  const infos = warnings.filter((w) => w.severity === "info");

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {errors.length > 0 && (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <AlertCircle className="h-3 w-3" />
            {errors.length} erro{errors.length > 1 ? "s" : ""}
          </Badge>
        )}
        {warningsOnly.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px] border-yellow-500 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            {warningsOnly.length} aviso{warningsOnly.length > 1 ? "s" : ""}
          </Badge>
        )}
        {infos.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px] border-blue-500 text-blue-600 dark:text-blue-400">
            <Info className="h-3 w-3" />
            {infos.length} info
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Avisos e Alarmes
        </h4>
        <div className="flex gap-1.5">
          {errors.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {errors.length} erro{errors.length > 1 ? "s" : ""}
            </Badge>
          )}
          {warningsOnly.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600 dark:text-yellow-400">
              {warningsOnly.length} aviso{warningsOnly.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {[...errors, ...warningsOnly, ...infos].map((w, i) => (
          <WarningCard key={i} warning={w} />
        ))}
      </div>
    </div>
  );
}
