import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductCardData } from "./product-kanban-card";
import type { Cn480ListItem } from "@/server/cn480Catalog.functions";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  a_analisar: { label: "A Analisar", className: "bg-muted text-foreground" },
  em_analise: { label: "Em Análise", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  sugestoes_ok: { label: "Sugestões OK", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  arquivado: { label: "Arquivado", className: "bg-destructive/15 text-destructive" },
};

const CN480_STATUS: Record<string, { label: string; className: string }> = {
  ready: { label: "Catálogo · pronto", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  partial: { label: "Catálogo · parcial", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  empty: { label: "Catálogo · vazio", className: "bg-muted text-muted-foreground" },
};

export type UnifiedRow =
  | {
      origin: "kanban";
      id: string;
      modelo: string;
      linha: string | null;
      hp: string | null;
      refrigerante: string | null;
      status: string;
      curveCount: number;
      equipmentProjectId: string | null;
      raw: ProductCardData;
    }
  | {
      origin: "cn480";
      id: string;
      modelo: string;
      linha: string | null;
      hp: string | null;
      refrigerante: string | null;
      status: "ready" | "partial" | "empty";
      curveCount: number;
      equipmentProjectId: string | null;
      raw: Cn480ListItem;
    };

interface Props {
  rows: UnifiedRow[];
  onRowClick?: (row: UnifiedRow) => void;
}

export function ProductsDataTable({ rows, onRowClick }: Props) {
  const hasRows = rows.length > 0;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <TableRow>
              <TableHead className="w-[110px]">Origem</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="w-[120px]">Linha</TableHead>
              <TableHead className="w-[80px]">HP</TableHead>
              <TableHead className="w-[110px]">Refrigerante</TableHead>
              <TableHead className="w-[160px]">Status</TableHead>
              <TableHead className="w-[90px] text-right">Curvas</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasRows && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum produto.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const statusMeta =
                r.origin === "kanban"
                  ? STATUS_LABELS[r.status] ?? { label: r.status, className: "bg-muted" }
                  : CN480_STATUS[r.status];
              return (
                <TableRow
                  key={`${r.origin}:${r.id}`}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onRowClick?.(r)}
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.origin === "kanban"
                          ? "border-primary/40 text-primary"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                      }
                    >
                      {r.origin === "kanban" ? "Kanban" : "Cat. 480"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{r.modelo}</TableCell>
                  <TableCell className="text-muted-foreground">{r.linha ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.hp ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.refrigerante ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusMeta.className}>
                      {statusMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {r.curveCount}
                  </TableCell>
                  <TableCell>
                    {r.equipmentProjectId && (
                      <Link
                        to="/coldpro/equipamentos/$id"
                        params={{ id: r.equipmentProjectId }}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex text-primary hover:text-primary/80"
                        aria-label="Abrir equipamento"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function buildUnifiedRows(args: {
  products: ProductCardData[];
  curvesByModel: Record<string, number>;
  cn480: Cn480ListItem[];
}): UnifiedRow[] {
  const kanban: UnifiedRow[] = args.products.map((p) => ({
    origin: "kanban",
    id: p.id,
    modelo: p.catalog_model,
    linha: p.linha,
    hp: p.hp,
    refrigerante: p.refrigerante,
    status: p.status,
    curveCount: args.curvesByModel[p.catalog_model] ?? 0,
    equipmentProjectId: p.equipment_project_id,
    raw: p,
  }));
  const kanbanModels = new Set(kanban.map((k) => k.modelo));
  const cn480Rows: UnifiedRow[] = args.cn480
    .filter((c) => !kanbanModels.has(c.modelo))
    .map((c) => ({
      origin: "cn480",
      id: c.id,
      modelo: c.modelo,
      linha: c.linha,
      hp: c.hp,
      refrigerante: c.refrigerante,
      status: c.status,
      curveCount: c.perf_points,
      equipmentProjectId: null,
      raw: c,
    }));
  return [...kanban, ...cn480Rows];
}

export function useFilteredRows(
  rows: UnifiedRow[],
  filters: { search: string; origin: "all" | "kanban" | "cn480" },
) {
  return useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.origin !== "all" && r.origin !== filters.origin) return false;
      if (!q) return true;
      return (
        r.modelo.toLowerCase().includes(q) ||
        (r.linha ?? "").toLowerCase().includes(q) ||
        (r.refrigerante ?? "").toLowerCase().includes(q) ||
        (r.hp ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filters.search, filters.origin]);
}
