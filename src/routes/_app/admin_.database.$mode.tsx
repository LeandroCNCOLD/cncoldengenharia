import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Search, ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { UNILAB_DB_TABLES } from "@/components/app-sidebar";

export const Route = createFileRoute("/_app/admin_/database/$mode")({
  component: DatabaseTablePage,
});

const VALID_MODES = new Set(UNILAB_DB_TABLES.map((t) => t.mode));

// Editable numeric fields
const EDITABLE_NUM_FIELDS = [
  "fat_cor_al",
  "fat_coef_lato_tubo",
  "fat_rid_aum_sup",
  "fat_corr_fat_attr",
  "rid_area_pass_tubo",
  "fattore_attr_aria",
  "fattore_attr_aria_latente",
  "security_factor",
  "factor_a0",
  "factor_a1",
  "factor_a2",
  "factor_fatc",
  "fatt_pdc_concentrate",
] as const;

const PAGE_SIZE = 100;
const DATABASE_LIST_SELECT = [
  "id",
  "mode",
  "geometry_code",
  "sigla",
  "description",
  "source_table",
  ...EDITABLE_NUM_FIELDS,
].join(",");

type EditableField = (typeof EDITABLE_NUM_FIELDS)[number];

interface Row {
  id: string;
  mode: string;
  geometry_code: string | null;
  sigla: string | null;
  description: string | null;
  source_table: string | null;
  [key: string]: unknown;
}

function DatabaseTablePage() {
  const { isAdmin, loading } = useAuth();
  const { mode } = Route.useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Record<EditableField, number>>>>({});

  const tableMeta = UNILAB_DB_TABLES.find((t) => t.mode === mode);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isAdmin || !VALID_MODES.has(mode)) return;
    let cancel = false;
    (async () => {
      setBusy(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("coil_geometry_factors")
        .select(DATABASE_LIST_SELECT, { count: "exact" })
        .eq("mode", mode)
        .order("sigla", { ascending: true })
        .range(from, to);
      const q = debouncedSearch.replace(/[(),]/g, " ").trim();
      if (q) {
        const like = `%${q}%`;
        query = query.or(
          `sigla.ilike.${like},description.ilike.${like},geometry_code.ilike.${like},source_table.ilike.${like}`,
        );
      }
      const { data, error, count } = await query;
      if (cancel) return;
      if (error) {
        toast.error("Erro ao carregar: " + error.message);
        setRows([]);
        setTotalCount(null);
      } else {
        setRows((data ?? []) as Row[]);
        setTotalCount(count ?? null);
        setEdits({});
      }
      setBusy(false);
    })();
    return () => {
      cancel = true;
    };
  }, [mode, isAdmin, page, debouncedSearch]);

  const dirtyCount = Object.keys(edits).length;

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  if (!VALID_MODES.has(mode)) return <Navigate to="/admin/database" />;

  function setCell(rowId: string, field: EditableField, raw: string) {
    const num = raw === "" || raw === "-" ? NaN : Number(raw);
    setEdits((prev) => {
      const cur = { ...(prev[rowId] ?? {}) };
      if (Number.isNaN(num)) delete cur[field];
      else cur[field] = num;
      const next = { ...prev };
      if (Object.keys(cur).length === 0) delete next[rowId];
      else next[rowId] = cur;
      return next;
    });
  }

  async function saveAll() {
    const ids = Object.keys(edits);
    if (ids.length === 0) return;
    setSaving(true);
    try {
      // Update one-by-one to avoid clobbering other columns
      for (const id of ids) {
        const patch = edits[id];
        const { error } = await supabase.from("coil_geometry_factors").update(patch).eq("id", id);
        if (error) throw error;
      }
      toast.success(`${ids.length} linha(s) atualizada(s)`);
      // refresh affected rows in local state
      setRows((prev) => prev.map((r) => (edits[r.id] ? { ...r, ...edits[r.id] } : r)));
      setEdits({});
    } catch (err) {
      toast.error("Erro ao salvar: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-2">
        <Link
          to="/admin/database"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Banco de Dados
        </Link>
      </div>
      <PageHeader
        title={tableMeta?.label ?? mode}
        description={`coil_geometry_factors — mode = ${mode} (${totalCount ?? rows.length} registros)`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar sigla / descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-64 pl-7 text-sm"
              />
            </div>
            <Button size="sm" onClick={saveAll} disabled={dirtyCount === 0 || saving}>
              {saving ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              Salvar {dirtyCount > 0 ? `(${dirtyCount})` : ""}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {busy ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado para esta tabela. Importe via "Importar Unilab".
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                <span>
                  Página {page + 1} · exibindo {rows.length} de {totalCount ?? "?"}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 0 || busy}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || rows.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
              <div className="overflow-auto max-h-[calc(100vh-270px)]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-[120px]">Sigla</TableHead>
                      <TableHead className="min-w-[200px]">Descrição</TableHead>
                      <TableHead className="w-[100px]">Geom.</TableHead>
                      {EDITABLE_NUM_FIELDS.map((f) => (
                        <TableHead key={f} className="whitespace-nowrap text-xs">
                          {f}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const rowEdits = edits[row.id] ?? {};
                      const dirty = Object.keys(rowEdits).length > 0;
                      return (
                        <TableRow key={row.id} className={dirty ? "bg-amber-500/5" : undefined}>
                          <TableCell className="font-mono text-xs">{row.sigla ?? "—"}</TableCell>
                          <TableCell className="text-xs">{row.description ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.geometry_code ?? "—"}
                          </TableCell>
                          {EDITABLE_NUM_FIELDS.map((f) => {
                            const dbVal = row[f];
                            const editVal = rowEdits[f];
                            const display =
                              editVal !== undefined
                                ? String(editVal)
                                : dbVal === null || dbVal === undefined
                                  ? ""
                                  : String(dbVal);
                            const cellDirty = editVal !== undefined;
                            return (
                              <TableCell key={f} className="p-1">
                                <Input
                                  type="number"
                                  step="any"
                                  value={display}
                                  onChange={(e) => setCell(row.id, f, e.target.value)}
                                  className={
                                    "h-7 w-24 text-xs " +
                                    (cellDirty ? "border-amber-500 bg-amber-500/10" : "")
                                  }
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
