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
import { TechnicalComponentDetailDrawer } from "@/components/coldpro/technical-component-detail-drawer";
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
  TechnicalComponent,
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

/* ---------- counters ---------- */

function UniversalLibraryCard({
  title,
  entity,
}: {
  title: string;
  entity: TechnicalEntityType | TechnicalEntityType[];
}) {
  const entities = Array.isArray(entity) ? entity : [entity];
  const { data } = useQuery({
    queryKey: ["tech-universal-count", entities.join(",")],
    queryFn: async () => {
      const counts = await Promise.all(entities.map((e) => countApprovedComponents(e)));
      return counts.reduce((a, b) => a + b, 0);
    },
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
  const { data: rawCount } = useQuery({ queryKey: ["tech-raw-count"], queryFn: countRawRecords });
  const { data: unmappedCount } = useQuery({ queryKey: ["tech-unmapped-count"], queryFn: countUnmappedRaw });
  const { data: mappedByStatus } = useQuery({
    queryKey: ["tech-mapped-counts"],
    queryFn: countMappedByStatus,
  });
  const pendingReview = (mappedByStatus?.mapped ?? 0) + (mappedByStatus?.needs_review ?? 0);
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
            Raw importado: <Badge variant="outline">{rawCount ?? 0}</Badge> · Não mapeado:{" "}
            <Badge variant="outline">{unmappedCount ?? 0}</Badge> · Mapeado aguardando revisão:{" "}
            <Badge variant="outline">{pendingReview}</Badge> · Aprovado:{" "}
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
      await qc.invalidateQueries({ queryKey: ["entity-tab"] });
    } catch (err) {
      toast.error(`Falha ao inicializar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
      setProgress("");
    }
  };
  return (
    <Button size="sm" onClick={handle} disabled={running}>
      {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
      {running && progress ? `Inicializando… ${progress}` : "Inicializar Biblioteca Técnica"}
    </Button>
  );
}

/* ---------- shared entity tab ---------- */

interface EntityTabProps {
  /** Um ou mais entity_types incluídos nesta aba (ex.: ["refrigerant","fluid"]). */
  entityTypes: TechnicalEntityType[];
  /** Filtro fixo opcional (ex.: forçar source UNILAB para a aba Geometrias). */
  fixedSource?: TechnicalSource;
  /** Mensagem se vazio. */
  emptyHint?: string;
}

function EntityTab({ entityTypes, fixedSource, emptyHint }: EntityTabProps) {
  const qc = useQueryClient();
  const [source, setSource] = useState<TechnicalSource | "ALL">(fixedSource ?? "ALL");
  const [context, setContext] = useState<TechnicalContext | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [openComponent, setOpenComponent] = useState<TechnicalComponent | null>(null);

  const queryKey = ["entity-tab", entityTypes.join(","), source, context, search];

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // listApprovedComponents só aceita um entityType; consultamos cada e juntamos.
      const lists = await Promise.all(
        entityTypes.map((e) =>
          listApprovedComponents({
            entityType: e,
            source,
            context,
            search,
            limit: 500,
          }),
        ),
      );
      return lists.flat();
    },
  });

  const items = useMemo(() => data ?? [], [data]);
  const allChecked = items.length > 0 && checked.size === items.length;
  const someChecked = checked.size > 0 && !allChecked;
  const toggleAll = (v: boolean) => setChecked(v ? new Set(items.map((i) => i.id)) : new Set());
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
      toast.error(`Falha ao atualizar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
        {!fixedSource && (
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
        )}
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
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
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
            if (!fixedSource) setSource("ALL");
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
          <Button size="sm" onClick={() => markAs("cn_standard")} disabled={bulkBusy}>
            {bulkBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Marcar como CN Standard
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAs("reference")} disabled={bulkBusy}>
            Voltar para Reference
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAs("test")} disabled={bulkBusy}>
            Marcar como Test
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())} disabled={bulkBusy}>
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
                <TableHead>Source</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    {emptyHint ?? "Nenhum componente encontrado para os filtros atuais."}
                  </TableCell>
                </TableRow>
              )}
              {items.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setOpenComponent(c)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked.has(c.id)}
                      onCheckedChange={(v) => toggleOne(c.id, v === true)}
                    />
                  </TableCell>
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
                  <TableCell className="text-xs">{c.code ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.status}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => setOpenComponent(c)}>
                      Detalhe
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TechnicalComponentDetailDrawer
        component={openComponent}
        onClose={() => setOpenComponent(null)}
      />
    </div>
  );
}

/* ---------- legacy reads (Geometrias hybrid + Correlations) ---------- */

function LegacyGeometriesTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["legacy-unilab-geometries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unilab_geometries")
        .select("id, geometry_code, mode, fin_type, tube_type, tube_outer_diameter_mm, fin_pitch_mm, rows, circuits")
        .order("geometry_code")
        .limit(1000);
      return data ?? [];
    },
  });
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Tabela legada <code>unilab_geometries</code> — fonte original dos fatores Unilab.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Geometry code</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Aleta</TableHead>
              <TableHead>Tubo</TableHead>
              <TableHead>OD (mm)</TableHead>
              <TableHead>Fin pitch</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Circuits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando…
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((g) => (
              <TableRow key={g.id}>
                <TableCell className="text-xs">{g.geometry_code}</TableCell>
                <TableCell className="text-xs">{g.mode}</TableCell>
                <TableCell className="text-xs">{g.fin_type ?? "—"}</TableCell>
                <TableCell className="text-xs">{g.tube_type ?? "—"}</TableCell>
                <TableCell className="text-xs">{g.tube_outer_diameter_mm ?? "—"}</TableCell>
                <TableCell className="text-xs">{g.fin_pitch_mm ?? "—"}</TableCell>
                <TableCell className="text-xs">{g.rows ?? "—"}</TableCell>
                <TableCell className="text-xs">{g.circuits ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LegacyCorrelationsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["legacy-coil-correlations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coil_correlations")
        .select("id, name, application, fluid_side, phase, geometry_type, group_name")
        .order("name")
        .limit(500);
      return data ?? [];
    },
  });
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Tabela legada <code>coil_correlations</code> — correlações de troca térmica e perda de carga.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Aplicação</TableHead>
              <TableHead>Lado</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Geometria</TableHead>
              <TableHead>Grupo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando…
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs font-medium">{c.name}</TableCell>
                <TableCell className="text-xs">{c.application ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.fluid_side ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.phase ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.geometry_type ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.group_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------- page ---------- */

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
          <TabsTrigger value="universal">Visão geral</TabsTrigger>
          <TabsTrigger value="compressors">Compressores</TabsTrigger>
          <TabsTrigger value="fans">Ventiladores</TabsTrigger>
          <TabsTrigger value="exp_valves">Válvulas exp.</TabsTrigger>
          <TabsTrigger value="solenoids">Solenoides</TabsTrigger>
          <TabsTrigger value="hot_gas">Hot Gas</TabsTrigger>
          <TabsTrigger value="evap_coils">Coils Evap.</TabsTrigger>
          <TabsTrigger value="cond_coils">Coils Cond.</TabsTrigger>
          <TabsTrigger value="refrigerants">Refrigerantes</TabsTrigger>
          <TabsTrigger value="geometries">Geometrias</TabsTrigger>
          <TabsTrigger value="correlations">Correlações</TabsTrigger>
        </TabsList>

        <TabsContent
          value="universal"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <UniversalLibraryCard title="Compressores" entity="compressor" />
          <UniversalLibraryCard title="Ventiladores" entity="fan" />
          <UniversalLibraryCard title="Válvulas expansão" entity="expansion_valve" />
          <UniversalLibraryCard title="Solenoides" entity="solenoid_valve" />
          <UniversalLibraryCard title="Hot gas" entity="hot_gas_valve" />
          <UniversalLibraryCard title="Coils evap." entity="evaporator_coil" />
          <UniversalLibraryCard title="Coils cond." entity="condenser_coil" />
          <UniversalLibraryCard
            title="Refrigerantes / fluidos"
            entity={["refrigerant", "fluid"]}
          />
        </TabsContent>

        <TabsContent value="compressors" className="mt-6">
          <EntityTab entityTypes={["compressor"]} />
        </TabsContent>
        <TabsContent value="fans" className="mt-6">
          <EntityTab entityTypes={["fan"]} />
        </TabsContent>
        <TabsContent value="exp_valves" className="mt-6">
          <EntityTab entityTypes={["expansion_valve"]} />
        </TabsContent>
        <TabsContent value="solenoids" className="mt-6">
          <EntityTab entityTypes={["solenoid_valve"]} />
        </TabsContent>
        <TabsContent value="hot_gas" className="mt-6">
          <EntityTab entityTypes={["hot_gas_valve"]} />
        </TabsContent>
        <TabsContent value="evap_coils" className="mt-6">
          <EntityTab entityTypes={["evaporator_coil"]} />
        </TabsContent>
        <TabsContent value="cond_coils" className="mt-6">
          <EntityTab entityTypes={["condenser_coil"]} />
        </TabsContent>
        <TabsContent value="refrigerants" className="mt-6">
          <EntityTab entityTypes={["refrigerant", "fluid"]} />
        </TabsContent>

        <TabsContent value="geometries" className="mt-6 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">
              Coils com source UNILAB (Biblioteca Universal)
            </h3>
            <EntityTab
              entityTypes={["evaporator_coil", "condenser_coil"]}
              fixedSource="UNILAB"
              emptyHint="Nenhum coil UNILAB encontrado na Biblioteca Universal."
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Geometrias legadas (Unilab original)</h3>
            <LegacyGeometriesTable />
          </div>
        </TabsContent>

        <TabsContent value="correlations" className="mt-6">
          <LegacyCorrelationsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
