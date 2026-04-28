import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getEquipmentProject } from "@/lib/coldpro/equipment-projects";
import {
  EQUIPMENT_APPLICATION_LABELS,
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_PROJECT_STATUS_LABELS,
} from "@/lib/coldpro/labels";
import { EvaporatorTab } from "@/components/coldpro/evaporator-tab";
import { PlaceholderTab } from "@/components/coldpro/placeholder-tab";

export const Route = createFileRoute("/_app/coldpro/equipamentos/$id")({
  component: EquipmentDetailPage,
});

function EquipmentDetailPage() {
  const { id } = useParams({ from: "/_app/coldpro/equipamentos/$id" });
  const { data: project, isLoading } = useQuery({
    queryKey: ["equipment-project", id],
    queryFn: () => getEquipmentProject(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!project) return <p className="text-sm text-destructive">Equipamento não encontrado.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/coldpro/equipamentos">
            <ArrowLeft className="mr-1 h-4 w-4" /> Equipamentos
          </Link>
        </Button>
        <PageHeader
          title={project.commercial_name}
          description={
            <span className="text-sm">
              {project.code} · {EQUIPMENT_KIND_LABELS[project.equipment_kind]} ·{" "}
              {EQUIPMENT_APPLICATION_LABELS[project.application]}
              {project.refrigerant ? ` · ${project.refrigerant}` : ""}
            </span>
          }
          actions={
            <Badge variant="secondary">
              {EQUIPMENT_PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          }
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="components">Componentes</TabsTrigger>
          <TabsTrigger value="evaporator">Evaporador</TabsTrigger>
          <TabsTrigger value="condenser">Condensador</TabsTrigger>
          <TabsTrigger value="compressor">Compressor</TabsTrigger>
          <TabsTrigger value="simulation">Simulação</TabsTrigger>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
              <Info label="Código">{project.code}</Info>
              <Info label="Família">{project.family ?? "—"}</Info>
              <Info label="Fluido">{project.refrigerant ?? "—"}</Info>
              <Info label="Temperatura alvo">
                {project.target_temperature != null ? `${project.target_temperature} °C` : "—"}
              </Info>
              <Info label="Capacidade alvo">
                {project.target_capacity != null ? `${project.target_capacity} W` : "—"}
              </Info>
              <Info label="Observações">{project.notes ?? "—"}</Info>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <PlaceholderTab
            title="Lista geral de componentes"
            description="Em breve: visão consolidada de todos os componentes (evap, cond, compressor, ventilador, válvulas, painel, etc.)."
          />
        </TabsContent>

        <TabsContent value="evaporator" className="mt-6">
          <EvaporatorTab equipmentProjectId={project.id} />
        </TabsContent>

        <TabsContent value="condenser" className="mt-6">
          <PlaceholderTab
            title="Condensador"
            description="Em breve: cadastro, importação Unilab e simulação do condensador."
          />
        </TabsContent>

        <TabsContent value="compressor" className="mt-6">
          <PlaceholderTab
            title="Compressor"
            description="Em breve: cadastro de compressor com coeficientes ARI/AHRI e curvas."
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          <PlaceholderTab
            title="Simulação do equipamento"
            description="Será liberada após validar evaporador, condensador e compressor."
          />
        </TabsContent>

        <TabsContent value="catalog" className="mt-6">
          <PlaceholderTab title="Catálogo" description="Em breve." />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <PlaceholderTab title="Histórico" description="Em breve." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
