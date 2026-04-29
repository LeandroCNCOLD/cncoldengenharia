import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_PROJECT_STATUS_LABELS,
} from "@/lib/coldpro/labels";

export const Route = createFileRoute("/_app/coldpro/catalogo")({
  component: CatalogPage,
});

function CatalogPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["coldpro-catalog"],
    queryFn: async () => {
      // Catálogo = projetos publicados com pelo menos um mapa aprovado
      const { data: maps } = await supabase
        .from("coil_performance_maps")
        .select("equipment_project_id, status")
        .eq("status", "approved");
      const ids = Array.from(
        new Set((maps ?? []).map((m) => m.equipment_project_id).filter(Boolean) as string[]),
      );
      if (ids.length === 0) {
        // Fallback: projetos com status published
        const { data } = await supabase
          .from("equipment_projects")
          .select("*")
          .eq("status", "validated")
          .order("updated_at", { ascending: false });
        return data ?? [];
      }
      const { data } = await supabase
        .from("equipment_projects")
        .select("*")
        .in("id", ids)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo Técnico"
        description="Equipamentos com mapa de desempenho aprovado e ficha técnica publicada."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Nenhum equipamento publicado ainda. Aprove um mapa de desempenho para
              ver o item aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{p.commercial_name}</h3>
                    <Badge variant="secondary">
                      {EQUIPMENT_PROJECT_STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.code} · {EQUIPMENT_KIND_LABELS[p.equipment_kind]}
                    {p.refrigerant ? ` · ${p.refrigerant}` : ""}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/coldpro/equipamentos/$id" params={{ id: p.id }}>
                    Abrir ficha <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
