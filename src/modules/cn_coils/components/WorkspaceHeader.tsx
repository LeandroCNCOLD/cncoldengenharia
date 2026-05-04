import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Loader2, Save, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WorkspaceHeaderProps {
  title: string;
  icon?: ReactNode;
  badges?: string[];
  onSave?: () => void;
  onShare?: () => void;
  onExportPdf?: () => void;
  isSaving?: boolean;
  isExportingPdf?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function WorkspaceHeader({
  title,
  icon,
  badges = [],
  onSave,
  onShare,
  onExportPdf,
  isSaving,
  isExportingPdf,
  backTo = "/coldpro/cncoils",
  backLabel = "CN Coils",
}: WorkspaceHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link to={backTo}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-primary">{icon}</span> : null}
        <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
      </div>

      {badges.length > 0 && (
        <div className="hidden items-center gap-1.5 md:flex">
          {badges.map((b) => (
            <Badge key={b} variant="secondary" className="font-mono text-[10px]">
              {b}
            </Badge>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {onSave && (
          <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        )}
        {onShare && (
          <Button size="icon" variant="ghost" onClick={onShare} aria-label="Compartilhar">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
        {onExportPdf && (
          <Button size="sm" variant="outline" onClick={onExportPdf} disabled={isExportingPdf} className="gap-1.5">
            {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
        )}
      </div>
    </header>
  );
}
