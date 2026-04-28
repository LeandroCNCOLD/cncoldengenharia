import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Boxes, CheckCircle2, AlertCircle, Clock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPONENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ComponentStatus,
  type ComponentType,
} from "@/lib/component-schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: components } = useQuery({
    queryKey: ["dashboard-components"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, type, status, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentFiles } = useQuery({
    queryKey: ["dashboard-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_files")
        .select("id, file_name, file_kind, processing_status, uploaded_at, component_id")
        .order("uploaded_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const total = components?.length ?? 0;
  const byStatus: Record<ComponentStatus, number> = {
    incompleto: 0,
    validando: 0,
    pronto: 0,
    invalido: 0,
  };
  const byType: Record<ComponentType, number> = {
    compressor: 0,
    evaporador: 0,
    condensador: 0,
  };
  components?.forEach((c) => {
    byStatus[c.status as ComponentStatus]++;
    byType[c.type as ComponentType]++;
  });

  const kpis = [
    { label: "Total de componentes", value: total, icon: Boxes, tone: "text-primary" },
    { label: "Prontos", value: byStatus.pronto, icon: CheckCircle2, tone: "text-success" },
    { label: "Em validação", value: byStatus.validando, icon: Clock, tone: "text-warning-foreground" },
    { label: "Incompletos / inválidos", value: byStatus.incompleto + byStatus.invalido, icon: AlertCircle, tone: "text-destructive" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão operacional da base técnica."
        actions={
          <Button asChild>
            <Link to="/components/new">
              <Plus className="mr-2 h-4 w-4" /> Criar componente
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="mt-1 font-display text-3xl font-semibold">{k.value}</p>
                </div>
                <Icon className={cn("h-8 w-8", k.tone)} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(byType) as ComponentType[]).map((t) => {
              const count = byType[t];
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={t}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{COMPONENT_TYPE_LABELS[t]}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Componentes recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {!components?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum componente cadastrado ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {components.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/components/$id"
                      params={{ id: c.id }}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent/40"
                    >
                      <span className="truncate">{c.name}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          STATUS_COLORS[c.status as ComponentStatus],
                        )}
                      >
                        {STATUS_LABELS[c.status as ComponentStatus]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Uploads recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentFiles?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum arquivo enviado ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentFiles.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      {f.file_kind}
                    </span>{" "}
                    {f.file_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{f.processing_status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
