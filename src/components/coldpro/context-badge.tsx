import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TechnicalContext } from "@/modules/coldpro/library/types";

const LABELS: Record<TechnicalContext, string> = {
  reference: "Reference",
  cn_standard: "CN Standard",
  validated: "Validated",
  test: "Test",
  legacy: "Legacy",
};

const VARIANTS: Record<TechnicalContext, string> = {
  reference: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  cn_standard: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  validated: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  test: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  legacy: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

export function ContextBadge({
  context,
  className,
}: {
  context: TechnicalContext;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", VARIANTS[context], className)}
    >
      {LABELS[context]}
    </Badge>
  );
}
