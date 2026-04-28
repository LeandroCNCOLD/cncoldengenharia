import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Network } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/systems")({
  component: SystemsPage,
});

function SystemsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["systems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("systems")
        .select(
          "id, name, description, created_at, compressor:compressor_id(name), evaporator:evaporator_id(name), condenser:condenser_id(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Sistemas"
        description="Combinações de compressor, evaporador e condensador prontas para simular."
        actions={
          <Link to="/systems/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Novo sistema
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Carregando…
          </CardContent>
        </Card>
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Network className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum sistema montado ainda</p>
              <p className="text-sm text-muted-foreground">
                Combine um compressor, um evaporador e um condensador prontos.
              </p>
            </div>
            <Link to="/systems/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Criar primeiro sistema
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data!.map((s) => (
            <Link key={s.id} to="/systems/$id" params={{ id: s.id }}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Comp.</p>
                      <p className="truncate">{(s.compressor as any)?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Evap.</p>
                      <p className="truncate">{(s.evaporator as any)?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cond.</p>
                      <p className="truncate">{(s.condenser as any)?.name ?? "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
