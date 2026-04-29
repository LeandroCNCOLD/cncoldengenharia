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
  const [edits, setEdits] = useState<Record<string, Partial<Record<EditableField, number>>>>({});

  const tableMeta = UNILAB_DB_TABLES.find((t) => t.mode === mode);

  useEffect(() => {
    if (!isAdmin || !VALID_MODES.has(mode)) return;
    let cancel = false;
    (async () => {
      setBusy(true);
      const { data, error } = await supabase
        .from("coil_geometry_factors")
        .select("*")
        .eq("mode", mode)
        .order("sigla", { ascending: true })
        .limit(2000);
      if (cancel) return;
      if (error) {
        toast.error("Erro ao carregar: " + error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
        setEdits({});
      }
      setBusy(false);
    })();
    return () => {
      cancel = true;
    };
  }, [mode, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.sigla, r.description, r.geometry_code, r.source_table]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

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
        const { error } = await supabase
          .from("coil_geometry_factors")
          .update(patch)
          .eq("id", id);
        if (error) throw error;
      }
      toast.success(`${ids.length} linha(s) atualizada(s)`);
      // refresh affected rows in local state
      setRows((prev) =>
        prev.map((r) => (edits[r.id] ? { ...r, ...edits[r.id] } : r)),
      );
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
        description={`coil_geometry_factors — mode = ${mode} (${rows.length} registros)`}
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
            <Button
              size="sm"
              onClick={saveAll}
              disabled={dirtyCount === 0 || saving}
            >
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
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado para esta tabela. Importe via "Importar Unilab".
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-220px)]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[120px]">Sigla</TableHead>
                    <TableHead className="min-w-[200px]">Descrição</TableHead>
                    <TableHead className="w-[100px]">Geom.</TableHead>
                    {EDITABLE_NUM_FIELDS.map((f) => (
                      <TableHead key={f} className="text-xs whitespace-nowrap">
                        {f}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const rowEdits = edits[row.id] ?? {};
                    const dirty = Object.keys(rowEdits).length > 0;
                    return (
                      <TableRow
                        key={row.id}
                        className={dirty ? "bg-amber-500/5" : undefined}
                      >
                        <TableCell className="font-mono text-xs">
                          {row.sigla ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.description ?? "—"}
                        </TableCell>
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
                                  (cellDirty
                                    ? "border-amber-500 bg-amber-500/10"
                                    : "")
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
