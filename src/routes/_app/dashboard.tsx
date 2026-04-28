import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Boxes } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listEquipmentProjects } from "@/lib/coldpro/equipment-projects";
import {
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_PROJECT_STATUS_LABELS,
} from "@/lib/coldpro/labels";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: projects = [] } = useQuery({
    queryKey: ["equipment-projects"],
    queryFn: listEquipmentProjects,
  });

  const total = projects.length;
  const drafts = projects.filter((p) => p.status === "draft").length;
  const inProgress = projects.filter((p) => p.status === "in_progress").length;
  const validated = projects.filter((p) => p.status === "validated").length;
  const recent = projects.slice(0, 6);

  return (
    <div className="space-y-8">
      <PageHeader
        title="ColdPro"
        description="Projetos técnicos de equipamentos de refrigeração."
        actions={
          <Button asChild>
            <Link to="/coldpro/equipamentos">
              <Boxes className="mr-2 h-4 w-4" /> Ver equipamentos
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de equipamentos" value={total} />
        <StatCard label="Rascunhos" value={drafts} />
        <StatCard label="Em projeto" value={inProgress} />
        <StatCard label="Validados" value={validated} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Equipamentos recentes</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/coldpro/equipamentos">
              <Plus className="mr-2 h-4 w-4" /> Novo equipamento
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum equipamento criado ainda.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/coldpro/equipamentos/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between py-3 text-sm hover:opacity-80"
                  >
                    <div>
                      <p className="font-medium">{p.commercial_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.code} · {EQUIPMENT_KIND_LABELS[p.equipment_kind]}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {EQUIPMENT_PROJECT_STATUS_LABELS[p.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
