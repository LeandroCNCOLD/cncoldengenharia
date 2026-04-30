/**
 * Aba Catálogo — ficha técnica resumida do equipamento.
 * Geração de PDF é próximo passo.
 */
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

import { PendingFeatureDrawer } from "@/components/coldpro/pending-feature-drawer";
import { listEquipmentComponentLinks } from "@/lib/coldpro/equipment-component-links";
import { getEquipmentProject } from "@/lib/coldpro/equipment-projects";

interface Props {
  equipmentProjectId: string;
}

export function CatalogTab({ equipmentProjectId }: Props) {
  const {
    data: project,
    isLoading: isLoadingProject,
    isError: isProjectError,
    error: projectError,
  } = useQuery({
    queryKey: ["equipment-project", equipmentProjectId],
    queryFn: () => getEquipmentProject(equipmentProjectId),
  });

  const {
    data: links,
    isLoading: isLoadingLinks,
    isError: isLinksError,
    error: linksError,
  } = useQuery({
    queryKey: ["equip-component-links", equipmentProjectId],
    queryFn: () => listEquipmentComponentLinks(equipmentProjectId),
  });

  const {
    data: approvedMap,
    isLoading: isLoadingApprovedMap,
    isError: isApprovedMapError,
    error: approvedMapError,
  } = useQuery({
    queryKey: ["equip-approved-map", equipmentProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coil_performance_maps")
        .select("id, map_name, status, coil_type, created_at")
        .eq("equipment_project_id", equipmentProjectId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProject ? (
            <p className="text-sm text-muted-foreground">Carregando identificação…</p>
          ) : isProjectError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar identificação: {(projectError as Error).message}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Código">{project?.code ?? "—"}</Info>
              <Info label="Nome comercial">{project?.commercial_name ?? "—"}</Info>
              <Info label="Família">{project?.family ?? "—"}</Info>
              <Info label="Refrigerante">{project?.refrigerant ?? "—"}</Info>
              <Info label="Temperatura alvo">
                {project?.target_temperature != null ? `${project.target_temperature} °C` : "—"}
              </Info>
              <Info label="Capacidade alvo">
                {project?.target_capacity != null ? `${project.target_capacity} W` : "—"}
              </Info>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Componentes vinculados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLinks ? (
            <p className="text-sm text-muted-foreground">Carregando vínculos…</p>
          ) : isLinksError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar vínculos: {(linksError as Error).message}
            </p>
          ) : !links || links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum componente vinculado.</p>
          ) : (
            <ul className="divide-y rounded border">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between p-3 text-sm">
                  <span>
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {l.role}
                    </Badge>
                    {l.component?.manufacturer ?? "—"} ·{" "}
                    {l.component?.model ?? l.component?.code ?? "—"}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {l.component?.source ?? "—"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapas de performance aprovados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingApprovedMap ? (
            <p className="text-sm text-muted-foreground">Carregando mapas…</p>
          ) : isApprovedMapError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar mapas: {(approvedMapError as Error).message}
            </p>
          ) : !approvedMap || approvedMap.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum mapa aprovado.</p>
          ) : (
            <ul className="divide-y rounded border">
              {approvedMap.map((m) => (
                <li key={m.id} className="flex items-center justify-between p-3 text-sm">
                  <span>{m.map_name ?? m.id.slice(0, 8)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {m.coil_type}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PendingFeatureDrawer
        triggerLabel="Gerar ficha técnica (PDF)"
        title="Ficha técnica em PDF"
        description="Exportar a ficha do equipamento como PDF distribuível."
        variant="default"
        nextSteps={[
          "Criar server function generateEquipmentDatasheet (puppeteer não roda em Worker — usar @react-pdf/renderer ou pdf-lib).",
          "Template com identificação, componentes vinculados, mapa aprovado.",
          "Salvar em storage `coldpro-imports` ou novo bucket `equipment-datasheets`.",
        ]}
      />
      <span className="sr-only">
        <FileText />
      </span>
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
