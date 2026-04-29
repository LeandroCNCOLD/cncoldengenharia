import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  countApprovedComponents,
  countMappedByStatus,
  countRawRecords,
  countUnmappedRaw,
} from "@/lib/coldpro/technical-library";
import type { TechnicalEntityType } from "@/modules/coldpro/library/types";

export const Route = createFileRoute("/_app/coldpro/admin/banco-tecnico")({
  component: TechBankPage,
});

/** Conta linhas em uma tabela final filtrando por approval_status (grandfather = approved). */
function ApprovedStat({
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
  const { data } = useQuery({
    queryKey: ["tech-bank-approved-count", table],
    queryFn: async () => {
      // coil_correlations não tem approval_status (não foi alterada na migration);
      // contamos tudo. As demais filtram por approved/validated.
      if (table === "coil_correlations") {
        const { count } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true });
        return count ?? 0;
      }
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["approved", "validated"]);
      return count ?? 0;
    },
  });
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-2 text-2xl font-semibold">{data ?? "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">aprovados (motor usa)</p>
      </CardContent>
    </Card>
  );
}

function UniversalLibraryCard({
  title,
  entity,
}: {
  title: string;
  entity: TechnicalEntityType;
}) {
  const { data } = useQuery({
    queryKey: ["tech-universal-count", entity],
    queryFn: () => countApprovedComponents(entity),
  });
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-2 text-2xl font-semibold">{data ?? 0}</p>
        <p className="mt-1 text-xs text-muted-foreground">na biblioteca universal</p>
      </CardContent>
    </Card>
  );
}

function PendingReviewBanner() {
  const { data: rawCount } = useQuery({
    queryKey: ["tech-raw-count"],
    queryFn: countRawRecords,
  });
  const { data: unmappedCount } = useQuery({
    queryKey: ["tech-unmapped-count"],
    queryFn: countUnmappedRaw,
  });
  const { data: mappedByStatus } = useQuery({
    queryKey: ["tech-mapped-counts"],
    queryFn: countMappedByStatus,
  });

  const pendingReview =
    (mappedByStatus?.mapped ?? 0) + (mappedByStatus?.needs_review ?? 0);

  if (!rawCount && !pendingReview && !unmappedCount) return null;

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">
            Existem dados importados aguardando mapeamento técnico.
          </p>
          <p className="text-xs text-muted-foreground">
            Raw importado: <Badge variant="outline">{rawCount ?? 0}</Badge>{" "}
            · Não mapeado: <Badge variant="outline">{unmappedCount ?? 0}</Badge>{" "}
            · Mapeado aguardando revisão:{" "}
            <Badge variant="outline">{pendingReview}</Badge>{" "}
            · Aprovado:{" "}
            <Badge variant="outline">{mappedByStatus?.approved ?? 0}</Badge>
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/coldpro/admin/revisao-tecnica">Abrir revisão</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function TechBankPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco Técnico"
        description="Biblioteca técnica oficial consumida pelo motor. Mostra apenas registros aprovados ou validados."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/unilab-import">Importar Unilab</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/coldpro/admin/revisao-tecnica">Revisão Técnica</Link>
            </Button>
          </div>
        }
      />

      <PendingReviewBanner />

      <Tabs defaultValue="universal">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="universal">Biblioteca Universal</TabsTrigger>
          <TabsTrigger value="geometries">Geometrias</TabsTrigger>
          <TabsTrigger value="factors">Fatores</TabsTrigger>
          <TabsTrigger value="fluids">Fluidos</TabsTrigger>
          <TabsTrigger value="compressors">Compressores</TabsTrigger>
          <TabsTrigger value="fans">Ventiladores</TabsTrigger>
          <TabsTrigger value="correlations">Correlações</TabsTrigger>
        </TabsList>

        <TabsContent value="universal" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UniversalLibraryCard title="Compressores" entity="compressor" />
          <UniversalLibraryCard title="Ventiladores" entity="fan" />
          <UniversalLibraryCard title="Válvulas expansão" entity="expansion_valve" />
          <UniversalLibraryCard title="Solenoides" entity="solenoid_valve" />
          <UniversalLibraryCard title="Hot gas" entity="hot_gas_valve" />
          <UniversalLibraryCard title="Coils evap." entity="evaporator_coil" />
          <UniversalLibraryCard title="Coils cond." entity="condenser_coil" />
          <UniversalLibraryCard title="Refrigerantes" entity="refrigerant" />
        </TabsContent>

        <TabsContent value="geometries" className="mt-6 grid gap-4 sm:grid-cols-2">
          <ApprovedStat title="Geometrias Unilab" table="unilab_geometries" />
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Use a tela{" "}
              <Link
                to="/admin/database/$mode"
                params={{ mode: "cooling" }}
                className="underline"
              >
                Banco de Dados → modo
              </Link>{" "}
              para inspecionar registros raw por modo.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factors" className="mt-6 grid gap-4 sm:grid-cols-2">
          <ApprovedStat title="Fatores de geometria" table="unilab_geometries_factors" />
        </TabsContent>

        <TabsContent value="fluids" className="mt-6 grid gap-4 sm:grid-cols-2">
          <ApprovedStat title="Fluidos refrigerantes (props)" table="coil_fluids" />
          <ApprovedStat title="Refrigerantes (cadastro)" table="refrigerants" />
        </TabsContent>

        <TabsContent value="compressors" className="mt-6 grid gap-4 sm:grid-cols-2">
          <ApprovedStat title="Modelos de compressores" table="compressor_models" />
        </TabsContent>

        <TabsContent value="fans" className="mt-6 grid gap-4 sm:grid-cols-2">
          <ApprovedStat title="Modelos de ventiladores" table="fan_models" />
        </TabsContent>

        <TabsContent value="correlations" className="mt-6 grid gap-4 sm:grid-cols-2">
          <ApprovedStat title="Correlações cadastradas" table="coil_correlations" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
