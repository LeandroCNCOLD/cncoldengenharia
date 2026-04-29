import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContextBadge } from "@/components/coldpro/context-badge";
import { supabase } from "@/integrations/supabase/client";
import {
  countApprovedComponents,
  countMappedByStatus,
  countRawRecords,
  countUnmappedRaw,
  listApprovedComponents,
  setComponentsContextBulk,
} from "@/lib/coldpro/technical-library";
import type {
  TechnicalContext,
  TechnicalEntityType,
  TechnicalSource,
} from "@/modules/coldpro/library/types";
import {
  TECHNICAL_CONTEXTS,
  TECHNICAL_SOURCES,
} from "@/modules/coldpro/library/types";
import { migrateExistingDataToUniversalLibrary } from "@/server/technicalLibraryMigration.functions";

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

function InitializeLibraryButton() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const handle = async () => {
    setRunning(true);
    setProgress("");
    const totals: Record<string, number> = {};
    try {
      // Roda em chunks: cada chamada migra até MAX_PER_RUN registros.
      // Re-chama até done=true (até ~50 iterações como salvaguarda).
      for (let i = 0; i < 50; i++) {
        const res = await migrateExistingDataToUniversalLibrary();
        for (const [k, v] of Object.entries(res.summary ?? {})) {
          totals[k] = (totals[k] ?? 0) + (v as number);
        }
        const sum = Object.values(totals).reduce((a, b) => a + b, 0);
        setProgress(`migrados: ${sum}`);
        if (res.done) break;
      }
      const parts = Object.entries(totals)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`);
      toast.success(
        parts.length
          ? `Biblioteca inicializada — ${parts.join(", ")}`
          : "Nenhum registro novo para migrar (já estava sincronizado).",
      );
      await qc.invalidateQueries({ queryKey: ["tech-universal-count"] });
    } catch (err) {
      toast.error(
        `Falha ao inicializar: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRunning(false);
      setProgress("");
    }
  };
  return (
    <Button size="sm" onClick={handle} disabled={running}>
      {running ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Database className="mr-2 h-4 w-4" />
      )}
      {running && progress
        ? `Inicializando… ${progress}`
        : "Inicializar Biblioteca Técnica"}
    </Button>
  );
}

const ENTITY_OPTIONS: Array<{ value: TechnicalEntityType | "ALL"; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "compressor", label: "Compressores" },
  { value: "fan", label: "Ventiladores" },
  { value: "evaporator_coil", label: "Coils evap." },
  { value: "condenser_coil", label: "Coils cond." },
  { value: "refrigerant", label: "Refrigerantes" },
  { value: "fluid", label: "Fluidos" },
  { value: "expansion_valve", label: "Válvulas expansão" },
  { value: "solenoid_valve", label: "Solenoides" },
  { value: "hot_gas_valve", label: "Hot gas" },
];

function ComponentsExplorer() {
  const qc = useQueryClient();
  const [entity, setEntity] = useState<TechnicalEntityType | "ALL">("ALL");
  const [source, setSource] = useState<TechnicalSource | "ALL">("ALL");
  const [context, setContext] = useState<TechnicalContext | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tech-components-list", entity, source, context, search],
    queryFn: () =>
      listApprovedComponents({
        entityType: entity === "ALL" ? undefined : entity,
        source,
        context,
        search,
        limit: 500,
      }),
  });

  const items = useMemo(() => data ?? [], [data]);
  const allChecked = items.length > 0 && checked.size === items.length;
  const someChecked = checked.size > 0 && !allChecked;

  const toggleAll = (v: boolean) =>
    setChecked(v ? new Set(items.map((i) => i.id)) : new Set());
  const toggleOne = (id: string, v: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  const markAs = async (target: TechnicalContext) => {
    if (checked.size === 0) return;
    setBulkBusy(true);
    try {
      await setComponentsContextBulk(Array.from(checked), target);
      toast.success(`${checked.size} componente(s) marcados como ${target}.`);
      setChecked(new Set());
      await refetch();
      await qc.invalidateQueries({ queryKey: ["tech-universal-count"] });
    } catch (err) {
      toast.error(
        `Falha ao atualizar: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Entidade</span>
          <Select value={entity} onValueChange={(v) => setEntity(v as never)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Source</span>
          <Select value={source} onValueChange={(v) => setSource(v as never)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as origens</SelectItem>
              {TECHNICAL_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Context</span>
          <Select value={context} onValueChange={(v) => setContext(v as never)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os contextos</SelectItem>
              {TECHNICAL_CONTEXTS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Buscar</span>
          <Input
            placeholder="manufacturer, model, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEntity("ALL");
            setSource("ALL");
            setContext("ALL");
            setSearch("");
          }}
        >
          <Filter className="mr-1 h-4 w-4" /> Limpar
        </Button>
      </div>

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-accent/40 px-4 py-2 text-sm">
          <span className="font-medium">{checked.size} selecionado(s)</span>
          <Button
            size="sm"
            onClick={() => markAs("cn_standard")}
            disabled={bulkBusy}
          >
            {bulkBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Marcar como CN Standard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAs("reference")}
            disabled={bulkBusy}
          >
            Voltar para Reference
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAs("test")}
            disabled={bulkBusy}
          >
            Marcar como Test
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setChecked(new Set())}
            disabled={bulkBusy}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhum componente encontrado para os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked.has(c.id)}
                      onCheckedChange={(v) => toggleOne(c.id, v === true)}
                    />
                  </TableCell>
                  <TableCell className="text-xs">{c.entity_type}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {c.source ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ContextBadge context={c.context} />
                  </TableCell>
                  <TableCell className="text-xs">{c.manufacturer ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.model ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
            <InitializeLibraryButton />
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
          <TabsTrigger value="components">Componentes (filtros)</TabsTrigger>
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

        <TabsContent value="components" className="mt-6">
          <ComponentsExplorer />
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
