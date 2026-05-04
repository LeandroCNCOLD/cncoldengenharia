import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EnvelopeStatusCardProps {
  label: string;
  icon: ReactNode;
  saved: boolean;
  model?: string | null;
  pointCount?: number;
  onReconfigure: () => void;
}

export function EnvelopeStatusCard({
  label,
  icon,
  saved,
  model,
  pointCount,
  onReconfigure,
}: EnvelopeStatusCardProps) {
  return (
    <Card className={saved ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={saved ? "text-emerald-700" : "text-slate-500"}>{icon}</span>
            <span className="font-medium">{label}</span>
          </div>
          <Badge variant={saved ? "default" : "secondary"}>
            {saved ? "✅ Envelope salvo" : "⬜ Aguardando simulação"}
          </Badge>
        </div>
        <div className="min-h-10 text-xs text-muted-foreground">
          {model && <div className="font-mono text-slate-700">{model}</div>}
          {pointCount !== undefined && (
            <div>{pointCount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pontos</div>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={onReconfigure}>
          → Reconfigurar
        </Button>
      </CardContent>
    </Card>
  );
}
