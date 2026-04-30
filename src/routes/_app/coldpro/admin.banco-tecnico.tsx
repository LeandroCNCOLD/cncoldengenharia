import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/coldpro/admin/banco-tecnico")({
  component: TechBankPage,
});

function StatBlock({
  title,
  table,
}: {
  title: string;
  table:
    | "unilab_geometries"
    | "unilab_geometries_factors"
    | "coil_fluids"
    | "compressor_models"
    | "fan_models"
    | "coil_correlations"
    | "refrigerants";
}) {
  const { data: count } = useQuery({
    queryKey: ["tech-bank-count", table],
    queryFn: async () => {
      const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{count ?? "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">registros</p>
      </CardContent>
    </Card>
  );
}

function TechBankPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco Técnico"
        description="Tabelas mestras usadas pelo motor ColdPro: geometrias, fatores, fluidos, compressores, ventiladores e correlações."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/unilab-import">Importar Unilab</Link>
          </Button>
        }
      />

      <Tabs defaultValue="geometries">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="geometries">Geometrias</TabsTrigger>
          <TabsTrigger value="factors">Fatores</TabsTrigger>
          <TabsTrigger value="fluids">Fluidos</TabsTrigger>
          <TabsTrigger value="compressors">Compressores</TabsTrigger>
          <TabsTrigger value="fans">Ventiladores</TabsTrigger>
          <TabsTrigger value="correlations">Correlações</TabsTrigger>
        </TabsList>

        <TabsContent value="geometries" className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBlock title="Geometrias Unilab" table="unilab_geometries" />
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Use a tela{" "}
              <Link to="/admin/database/$mode" params={{ mode: "cooling" }} className="underline">
                Banco de Dados → modo
              </Link>{" "}
              para inspecionar registros por modo (cooling, heating etc.).
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factors" className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBlock title="Fatores de geometria" table="unilab_geometries_factors" />
        </TabsContent>

        <TabsContent value="fluids" className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBlock title="Fluidos refrigerantes (props)" table="coil_fluids" />
          <StatBlock title="Refrigerantes (cadastro)" table="refrigerants" />
        </TabsContent>

        <TabsContent value="compressors" className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBlock title="Modelos de compressores" table="compressor_models" />
        </TabsContent>

        <TabsContent value="fans" className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBlock title="Modelos de ventiladores" table="fan_models" />
        </TabsContent>

        <TabsContent value="correlations" className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBlock title="Correlações cadastradas" table="coil_correlations" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
