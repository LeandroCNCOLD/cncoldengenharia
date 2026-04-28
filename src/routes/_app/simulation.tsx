import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, FlaskConical, Network, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPONENT_TYPE_LABELS,
  type ComponentType,
} from "@/lib/component-schema";
import { computeReadiness, type FieldConflict } from "@/lib/component-readiness";

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
        const r = computeReadiness(c.type as ComponentType, dataMap.get(c.id) ?? {}, conflicts);
        return { ...c, readiness: r };
      });
    },
  });

  const { data: systems } = useQuery({
    queryKey: ["systems-shortcut"],
    queryFn: async () => {
      const { data } = await supabase
        .from("systems")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const ready = (data ?? []).filter((c) => c.readiness.ready);
  const blocked = (data ?? []).filter((c) => !c.readiness.ready);

  return (
    <div>
      <PageHeader
        title="Simulação"
        description="Sistemas prontos para simular e estado dos componentes."
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            <Network className="h-4 w-4" /> Sistemas ({systems?.length ?? 0})
          </h2>
          <Link to="/systems" className="text-xs text-primary hover:underline">Ver todos</Link>
        </div>
        {(systems?.length ?? 0) === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhum sistema montado.{" "}
              <Link to="/systems/new" className="text-primary hover:underline">Criar primeiro</Link>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {systems!.map((s) => (
              <Link key={s.id} to="/systems/$id/simulate" params={{ id: s.id }}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">Simular agora</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-success">
            <CheckCircle2 className="h-4 w-4" /> Componentes prontos ({ready.length})
          </h2>
          {ready.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhum componente pronto ainda.
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
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
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
                  <Card className="transition-colors hover:border-primary/50">
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
            O motor de equilíbrio AHRI 540 já está ativo. Linhas de sucção, custos,
            simulação dinâmica e comparação serão liberados nas próximas etapas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
