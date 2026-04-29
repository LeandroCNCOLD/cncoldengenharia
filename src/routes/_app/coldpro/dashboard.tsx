import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, FolderKanban, BookOpen, Database, ArrowRight, Activity } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listEquipmentProjects } from "@/lib/coldpro/equipment-projects";
import {
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_PROJECT_STATUS_LABELS,
} from "@/lib/coldpro/labels";

export const Route = createFileRoute("/_app/coldpro/dashboard")({
  component: ColdProDashboard,
});

function ColdProDashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["equipment-projects"],
    queryFn: listEquipmentProjects,
  });

  const { data: counts } = useQuery({
    queryKey: ["coldpro-counts"],
    queryFn: async () => {
      const [geom, comp, fan, maps] = await Promise.all([
        supabase.from("unilab_geometries").select("id", { count: "exact", head: true }),
        supabase.from("compressor_models").select("id", { count: "exact", head: true }),
        supabase.from("fan_models").select("id", { count: "exact", head: true }),
        supabase.from("coil_performance_maps").select("id", { count: "exact", head: true }),
      ]);
      return {
        geometries: geom.count ?? 0,
        compressors: comp.count ?? 0,
        fans: fan.count ?? 0,
        maps: maps.count ?? 0,
      };
    },
  });

  const active = projects.filter((p) => p.status !== "archived");
  const recent = active.slice(0, 5);

  const kpis = [
    { label: "Projetos ativos", value: active.length, icon: FolderKanban, to: "/coldpro/projetos" },
    { label: "Geometrias Unilab", value: counts?.geometries ?? "—", icon: Database, to: "/coldpro/admin/banco-tecnico" },
    { label: "Compressores", value: counts?.compressors ?? "—", icon: Boxes, to: "/coldpro/admin/banco-tecnico" },
    { label: "Mapas gerados", value: counts?.maps ?? "—", icon: Activity, to: "/coldpro/catalogo" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel ColdPro"
        description="Visão geral dos projetos, banco técnico e atividade do sistema."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{k.value}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2 h-7 text-xs">
                  <Link to={k.to}>
                    Ver detalhes <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Projetos recentes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/coldpro/projetos">
                Todos <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum projeto ainda. Crie o primeiro em Projetos.
              </p>
            ) : (
              recent.map((p) => (
                <Link
                  key={p.id}
                  to="/coldpro/equipamentos/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.commercial_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.code} · {EQUIPMENT_KIND_LABELS[p.equipment_kind]}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {EQUIPMENT_PROJECT_STATUS_LABELS[p.status]}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/coldpro/projetos">
                Novo projeto <FolderKanban className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/coldpro/catalogo">
                Catálogo técnico <BookOpen className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/admin/unilab-import">
                Importar Unilab <Database className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
