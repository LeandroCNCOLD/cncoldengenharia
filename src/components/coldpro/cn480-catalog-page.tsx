import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, CheckCircle2, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCn480Catalog,
  createEquipmentFromCn480,
} from "@/server/cn480Catalog.functions";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function Cn480CatalogPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listCn480Catalog);
  const createFn = useServerFn(createEquipmentFromCn480);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cn480-catalog"],
    queryFn: () => listFn({}),
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [linha, setLinha] = useState<string>(ALL);
  const [refrigerante, setRefrigerante] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openInSimulator, setOpenInSimulator] = useState(false);

  const linhas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.linha).filter((x): x is string => !!x))).sort(),
    [rows],
  );
  const refrigerantes = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.refrigerante).filter((x): x is string => !!x))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (linha !== ALL && r.linha !== linha) return false;
      if (refrigerante !== ALL && r.refrigerante !== refrigerante) return false;
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (q && !r.modelo.toLowerCase().includes(q) && !(r.compressor_label ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, search, linha, refrigerante, statusFilter]);

  async function handleCreate(modelId: string, openSim: boolean) {
    setBusyId(modelId);
    try {
      const res = await createFn({ data: { modelId } });
      if (res.warnings.length > 0) {
        for (const w of res.warnings) toast.warning(w);
      }
      toast.success(
        res.reused
          ? `Equipamento já existia para ${res.catalogModel} — abrindo.`
          : `Equipamento criado: ${res.catalogModel}.`,
      );
      qc.invalidateQueries({ queryKey: ["equipment-projects"] });
      if (openSim) {
        navigate({
          to: "/coldpro/equipamentos/$id/coil-simulator",
          params: { id: res.equipmentProjectId },
        });
      } else {
        navigate({
          to: "/coldpro/equipamentos/$id",
          params: { id: res.equipmentProjectId },
        });
      }
    } catch (e) {
      toast.error((e as Error).message ?? "Falha ao criar equipamento.");
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const ready = rows.filter((r) => r.status === "ready").length;
    const partial = rows.filter((r) => r.status === "partial").length;
    const empty = rows.filter((r) => r.status === "empty").length;
    return { ready, partial, empty, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo 480"
        description="Modelos consolidados a partir da Tabela 480. Crie equipamentos completos com 1 clique."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={counts.total} />
        <SummaryCard label="Prontos" value={counts.ready} tone="ok" />
        <SummaryCard label="Parciais" value={counts.partial} tone="warn" />
        <SummaryCard label="Vazios" value={counts.empty} tone="muted" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modelo ou compressor…"
                className="pl-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <FilterSelect
              value={linha}
              onChange={setLinha}
              placeholder="Linha"
              options={linhas}
            />
            <FilterSelect
              value={refrigerante}
              onChange={setRefrigerante}
              placeholder="Fluido"
              options={refrigerantes}
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status"
              options={["ready", "partial", "empty"]}
              labels={{ ready: "Pronto", partial: "Parcial", empty: "Vazio" }}
            />
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={openInSimulator}
                onChange={(e) => setOpenInSimulator(e.target.checked)}
              />
              Abrir no Coil Simulator após criar
            </label>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando catálogo…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum modelo encontrado para os filtros atuais.
            </p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>HP</TableHead>
                    <TableHead>Fluido</TableHead>
                    <TableHead>Compressor</TableHead>
                    <TableHead className="text-center">Evap</TableHead>
                    <TableHead className="text-center">Cond</TableHead>
                    <TableHead className="text-center">Comp</TableHead>
                    <TableHead className="text-center">Perf</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-[11px]">{r.modelo}</TableCell>
                      <TableCell className="text-xs">{r.linha ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.hp || "—"}</TableCell>
                      <TableCell className="text-xs">{r.refrigerante ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.compressor_label ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Dot ok={r.has_evaporator} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Dot ok={r.has_condenser} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Dot ok={r.has_compressor} />
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {r.perf_points > 0 ? r.perf_points : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={openInSimulator ? "outline" : "default"}
                          onClick={() => handleCreate(r.id, openInSimulator)}
                          disabled={busyId === r.id || r.status === "empty"}
                          className="gap-1"
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : openInSimulator ? (
                            <Calculator className="h-3.5 w-3.5" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          {openInSimulator ? "Abrir Simulator" : "Criar equipamento"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "muted";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold",
            tone === "ok" && "text-emerald-600",
            tone === "warn" && "text-amber-600",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        ok ? "bg-emerald-500" : "bg-muted",
      )}
      aria-label={ok ? "presente" : "ausente"}
    />
  );
}

function StatusBadge({ status }: { status: "ready" | "partial" | "empty" }) {
  if (status === "ready")
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" /> Pronto
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700">
        Parcial
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Vazio
    </Badge>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos · {placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
