import { Badge } from "@/components/ui/badge";
import type { FieldOrigin } from "@/modules/coldpro/coil/coilEngineTypes";
import { cn } from "@/lib/utils";

const LABELS: Record<FieldOrigin, string> = {
  imported: "Importado",
  calculated: "Calculado",
  calibrated: "Calibrado",
  estimated: "Estimado",
  manual: "Manual",
};

const VARIANTS: Record<FieldOrigin, string> = {
  imported: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  calculated: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  calibrated: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  estimated: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  manual: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

export function OriginBadge({ origin, className }: { origin: FieldOrigin; className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", VARIANTS[origin], className)}>
      {LABELS[origin]}
    </Badge>
  );
}
