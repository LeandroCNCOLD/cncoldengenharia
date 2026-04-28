import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPONENT_FIELDS,
  COMPONENT_TYPE_LABELS,
  type ComponentType,
} from "@/lib/component-schema";
import { computeReadiness, type FieldConflict } from "@/lib/component-readiness";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/simulation")({
  component: SimulationPage,
});

function SimulationPage() {
  const { data } = useQuery({
    queryKey: ["simulation-list"],
    queryFn: async () => {
      const { data: comps } = await supabase
        .from("components")
        .select("id, name, type, manufacturer, status, conflicts")
        .order("name");
      const { data: cdata } = await supabase
        .from("component_data")
        .select("component_id, fields");
      const dataMap = new Map(
        (cdata ?? []).map((d) => [d.component_id, (d.fields ?? {}) as Record<string, unknown>]),
      );
      return (comps ?? []).map((c) => {
        const conflicts = (c.conflicts ?? []) as unknown as FieldConflict[];
        const r = computeReadiness(
          c.type as ComponentType,
          dataMap.get(c.id) ?? {},
          conflicts,
        );
        return { ...c, readiness: r };
      });
    },
  });

  const ready = (data ?? []).filter((c) => c.readiness.ready);
  const blocked = (data ?? []).filter((c) => !c.readiness.ready);

  return (
    <div>
      <PageHeader
        title="Simulação"
        description="Componentes disponíveis para uso nos motores térmicos."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-success">
            <CheckCircle2 className="h-4 w-4" /> Prontos ({ready.length})
          </h2>
          {ready.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhum componente pronto ainda. Complete os dados para liberar.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {ready.map((c) => (
                <Link key={c.id} to="/components/$id" params={{ id: c.id }}>
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {COMPONENT_TYPE_LABELS[c.type as ComponentType]}
                          {c.manufacturer ? ` · ${c.manufacturer}` : ""}
                        </p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-warning-foreground">
            <AlertCircle className="h-4 w-4 text-warning" /> Bloqueados ({blocked.length})
          </h2>
          {blocked.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhum componente bloqueado.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {blocked.map((c) => (
                <Link key={c.id} to="/components/$id" params={{ id: c.id }}>
                  <Card className={cn("transition-colors hover:border-primary/50")}>
                    <CardContent className="space-y-1 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{c.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {COMPONENT_TYPE_LABELS[c.type as ComponentType]}
                        </span>
                      </div>
                      <ul className="ml-4 list-disc text-xs text-muted-foreground">
                        {c.readiness.blockReasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <Card className="mt-6 border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Os motores térmicos (compressor, evaporador, condensador), o solver de
            equilíbrio e a simulação dinâmica serão habilitados nas próximas etapas.
            Esta tela já reflete a base de componentes prontos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
