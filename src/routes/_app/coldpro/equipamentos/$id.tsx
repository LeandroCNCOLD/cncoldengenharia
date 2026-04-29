import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calculator } from "lucide-react";

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
import { CondenserTab } from "@/components/coldpro/condenser-tab";
import { PlaceholderTab } from "@/components/coldpro/placeholder-tab";
import { SizingTab } from "@/components/coldpro/sizing-tab";

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
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/coldpro/equipamentos/$id/coil-simulator" params={{ id: project.id }}>
                  <Calculator className="mr-1 h-4 w-4" /> Coil Simulator
                </Link>
              </Button>
              <Badge variant="secondary">
                {EQUIPMENT_PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </div>
          }
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="sizing">Dimensionamento</TabsTrigger>
          <TabsTrigger value="components">Componentes</TabsTrigger>
          <TabsTrigger value="evaporator">Evaporador</TabsTrigger>
          <TabsTrigger value="condenser">Condensador</TabsTrigger>
          <TabsTrigger value="compressor">Compressor</TabsTrigger>
          <TabsTrigger value="fans">Ventiladores</TabsTrigger>
          <TabsTrigger value="valve">Válvula</TabsTrigger>
          <TabsTrigger value="simulation">Sistema completo</TabsTrigger>
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

        <TabsContent value="sizing" className="mt-6">
          <SizingTab project={project} />
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
          <CondenserTab equipmentProjectId={project.id} />
        </TabsContent>

        <TabsContent value="compressor" className="mt-6">
          <PlaceholderTab
            title="Compressor"
            description="Em breve: cadastro de compressor com coeficientes ARI/AHRI e curvas."
          />
        </TabsContent>

        <TabsContent value="fans" className="mt-6">
          <PlaceholderTab
            title="Ventiladores"
            description="Em breve: seleção de ventilador a partir do banco fan_models e curvas de pressão x vazão."
          />
        </TabsContent>

        <TabsContent value="valve" className="mt-6">
          <PlaceholderTab
            title="Válvula de expansão"
            description="Em breve: dimensionamento de válvula termostática ou eletrônica."
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          <PlaceholderTab
            title="Sistema completo"
            description="Solver de equilíbrio Qcond ≈ Qevap + Wcomp. Liberado após validar todos os componentes."
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
