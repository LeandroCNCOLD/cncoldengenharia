import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CatalogUploadButton } from "@/components/coldpro/catalog-upload-button";
import { NewProductDialog } from "@/components/coldpro/new-product-dialog";
import { ProductKanbanBoard } from "@/components/coldpro/product-kanban-board";
import { ProductDetailDrawer } from "@/components/coldpro/product-detail-drawer";
import type { ProductCardData } from "@/components/coldpro/product-kanban-card";
import { listProducts } from "@/server/cnProductDevelopment.functions";

export const Route = createFileRoute("/_app/coldpro/desenvolvimento")({
  component: DesenvolvimentoPage,
});

function DesenvolvimentoPage() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductCardData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cn-product-dev", { showArchived }],
    queryFn: () => listProducts({ data: { includeArchived: showArchived } }),
  });

  const filtered = useMemo<ProductCardData[]>(() => {
    const products = (data?.products ?? []) as unknown as ProductCardData[];
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.catalog_model.toLowerCase().includes(q) ||
        p.linha?.toLowerCase().includes(q) ||
        p.refrigerante?.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Desenvolvimento de Produtos"
        subtitle="Kanban dos produtos do catálogo CN — do bruto ao publicado."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo, linha, refrigerante…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived" className="text-sm">
            Mostrar arquivados
          </Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <NewProductDialog />
          <CatalogUploadButton onDone={() => qc.invalidateQueries({ queryKey: ["cn-product-dev"] })} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos…
        </div>
      ) : (
        <ProductKanbanBoard
          products={filtered}
          curvesByModel={data?.curvesByModel ?? {}}
          showArchived={showArchived}
          onCardClick={(p) => setSelected(p)}
        />
      )}

      <ProductDetailDrawer
        product={selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
