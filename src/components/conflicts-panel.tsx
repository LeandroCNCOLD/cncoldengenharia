// CN Cold Engineering — Painel de resolução de conflitos.
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FieldConflict } from "@/lib/component-readiness";
import { COMPONENT_FIELDS, type ComponentType } from "@/lib/component-schema";

interface Props {
  type: ComponentType;
  conflicts: FieldConflict[];
  fileNames: Record<string, string>; // fileId -> name
  onResolve: (key: string, chosenValue: unknown, chosenSource: string) => Promise<void>;
}

export function ConflictsPanel({ type, conflicts, fileNames, onResolve }: Props) {
  if (conflicts.length === 0) return null;
  const labels = Object.fromEntries(
    COMPONENT_FIELDS[type].map((f) => [f.key, f.label]),
  ) as Record<string, string>;

  function sourceLabel(src: string): string {
    if (src === "manual") return "Edição manual";
    if (src.startsWith("file:")) {
      const id = src.slice(5);
      return fileNames[id] ? `Arquivo: ${fileNames[id]}` : "Arquivo";
    }
    return src;
  }

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-warning-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Conflitos detectados ({conflicts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {conflicts.map((c) => (
          <div key={c.key} className="rounded-md border bg-card p-3">
            <p className="mb-2 text-sm font-medium">{labels[c.key] ?? c.key}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.values.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onResolve(c.key, v.value, v.source)}
                  className="group rounded-md border bg-background p-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted"
                >
                  <p className="text-xs text-muted-foreground">{sourceLabel(v.source)}</p>
                  <p className="font-mono text-sm">
                    {typeof v.value === "object" ? JSON.stringify(v.value) : String(v.value)}
                  </p>
                  <p className="mt-1 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Clique para escolher
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          A escolha manual prevalece e libera o componente para simulação.
        </p>
      </CardContent>
    </Card>
  );
}
