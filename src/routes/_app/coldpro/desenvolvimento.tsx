import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, LayoutGrid } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CatalogUploadButton } from "@/components/coldpro/catalog-upload-button";
import { NewProductDialog } from "@/components/coldpro/new-product-dialog";
import { ProductKanbanBoard } from "@/components/coldpro/product-kanban-board";
import { ProductDetailDrawer } from "@/components/coldpro/product-detail-drawer";
import {
  ProductsDataTable,
  buildUnifiedRows,
  useFilteredRows,
  type UnifiedRow,
} from "@/components/coldpro/products-data-table";
import type { ProductCardData } from "@/components/coldpro/product-kanban-card";
import { listProducts } from "@/server/cnProductDevelopment.functions";
import { listCn480Catalog } from "@/server/cn480Catalog.functions";

export const Route = createFileRoute("/_app/coldpro/desenvolvimento")({
  component: DesenvolvimentoPage,
});

function DesenvolvimentoPage() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<"all" | "kanban" | "cn480">("all");
  const [selected, setSelected] = useState<ProductCardData | null>(null);
  const [kanbanOpen, setKanbanOpen] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["cn-product-dev", { showArchived }],
    queryFn: () => listProducts({ data: { includeArchived: showArchived } }),
  });

  const cn480Query = useQuery({
    queryKey: ["cn480-catalog-list"],
    queryFn: () => listCn480Catalog(),
  });

  const products = (productsQuery.data?.products ?? []) as unknown as ProductCardData[];
  const curvesByModel = productsQuery.data?.curvesByModel ?? {};
  const cn480 = cn480Query.data ?? [];

  const allRows = useMemo(
    () => buildUnifiedRows({ products, curvesByModel, cn480 }),
    [products, curvesByModel, cn480],
  );
  const filteredRows = useFilteredRows(allRows, { search, origin });

  const isLoading = productsQuery.isLoading || cn480Query.isLoading;

  function handleRowClick(row: UnifiedRow) {
    if (row.origin === "kanban") setSelected(row.raw);
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Desenvolvimento de Produtos"
        description="Tabela completa dos produtos (Kanban + Catálogo 480). Abra o Kanban para mover entre etapas."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo, linha, HP, refrigerante…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={origin} onValueChange={(v) => setOrigin(v as typeof origin)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="kanban">Kanban</SelectItem>
            <SelectItem value="cn480">Catálogo 480</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived" className="text-sm">
            Mostrar arquivados
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setKanbanOpen(true)}>
            <LayoutGrid className="mr-1 h-4 w-4" /> Abrir Kanban
          </Button>
          <NewProductDialog />
          <CatalogUploadButton onDone={() => qc.invalidateQueries({ queryKey: ["cn-product-dev"] })} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {filteredRows.length} de {allRows.length} produtos
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos…
        </div>
      ) : (
        <ProductsDataTable rows={filteredRows} onRowClick={handleRowClick} />
      )}

      <ProductDetailDrawer
        product={selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />

      <Sheet open={kanbanOpen} onOpenChange={setKanbanOpen}>
        <SheetContent side="right" className="w-full max-w-[95vw] sm:max-w-[1400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kanban de Desenvolvimento</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ProductKanbanBoard
              products={products}
              curvesByModel={curvesByModel}
              showArchived={showArchived}
              onCardClick={(p) => setSelected(p)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
