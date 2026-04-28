import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPONENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ComponentStatus,
  type ComponentType,
} from "@/lib/component-schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/components")({
  component: ComponentsPage,
});

function ComponentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["components-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, type, manufacturer, fluid, status, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Componentes"
        description="Gestão de compressores, evaporadores e condensadores."
        actions={
          <Button asChild>
            <Link to="/components/new">
              <Plus className="mr-2 h-4 w-4" /> Criar componente
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.length ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Nenhum componente cadastrado.</p>
              <Button asChild className="mt-4">
                <Link to="/components/new">Criar primeiro componente</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Fluido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        to="/components/$id"
                        params={{ id: c.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{COMPONENT_TYPE_LABELS[c.type as ComponentType]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.manufacturer || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.fluid || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          STATUS_COLORS[c.status as ComponentStatus],
                        )}
                      >
                        {STATUS_LABELS[c.status as ComponentStatus]}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
