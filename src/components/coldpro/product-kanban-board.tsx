import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ProductKanbanCard, type ProductCardData } from "./product-kanban-card";
import { updateProductStatus } from "@/server/cnProductDevelopment.functions";

const COLUMNS = [
  { id: "a_analisar", label: "A Analisar", color: "border-l-muted-foreground" },
  { id: "em_analise", label: "Em Análise", color: "border-l-blue-500" },
  { id: "sugestoes_ok", label: "Sugestões OK", color: "border-l-amber-500" },
  { id: "aprovado", label: "Aprovado", color: "border-l-emerald-500" },
  { id: "arquivado", label: "Arquivado", color: "border-l-destructive" },
] as const;

type ColumnId = typeof COLUMNS[number]["id"];

interface Props {
  products: ProductCardData[];
  curvesByModel: Record<string, number>;
  showArchived: boolean;
  onCardClick: (product: ProductCardData) => void;
}

function Column({
  id,
  label,
  color,
  items,
  curvesByModel,
  onCardClick,
}: {
  id: ColumnId;
  label: string;
  color: string;
  items: ProductCardData[];
  curvesByModel: Record<string, number>;
  onCardClick: (p: ProductCardData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className={`flex w-72 shrink-0 flex-col rounded-md border border-border bg-muted/30 ${color} border-l-4`}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-2 transition-colors ${isOver ? "bg-primary/5" : ""}`}
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((p) => (
            <ProductKanbanCard
              key={p.id}
              product={p}
              curveCount={curvesByModel[p.catalog_model] ?? 0}
              onClick={() => onCardClick(p)}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">Vazio</p>
        )}
      </div>
    </div>
  );
}

export function ProductKanbanBoard({ products, curvesByModel, showArchived, onCardClick }: Props) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => showArchived || c.id !== "arquivado"),
    [showArchived],
  );

  const grouped = useMemo(() => {
    const map: Record<string, ProductCardData[]> = {};
    for (const c of COLUMNS) map[c.id] = [];
    for (const p of products) {
      if (map[p.status]) map[p.status].push(p);
    }
    return map;
  }, [products]);

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; status: ColumnId; position: number }) =>
      updateProductStatus({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cn-product-dev"] }),
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeProduct = products.find((p) => p.id === active.id);
    if (!activeProduct) return;

    let targetCol = over.id as string;
    let targetIndex = -1;

    // se soltou em outro card, descobre a coluna desse card e índice
    if (!COLUMNS.some((c) => c.id === targetCol)) {
      const overProduct = products.find((p) => p.id === over.id);
      if (!overProduct) return;
      targetCol = overProduct.status;
      const colItems = grouped[targetCol].filter((p) => p.id !== active.id);
      targetIndex = colItems.findIndex((p) => p.id === over.id);
    }

    const colItems = grouped[targetCol].filter((p) => p.id !== active.id);
    const insertIdx = targetIndex >= 0 ? targetIndex : colItems.length;
    const before = colItems[insertIdx - 1]?.position ?? 0;
    const after = colItems[insertIdx]?.position ?? before + 2000;
    const newPos = (before + after) / 2;

    if (activeProduct.status === targetCol && Math.abs(activeProduct.position as unknown as number - newPos) < 0.001) return;

    updateMutation.mutate({ id: activeProduct.id, status: targetCol as ColumnId, position: Math.round(newPos) });
  }

  const activeProduct = activeId ? products.find((p) => p.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {visibleColumns.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            items={grouped[col.id]}
            curvesByModel={curvesByModel}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeProduct && (
          <ProductKanbanCard
            product={activeProduct}
            curveCount={curvesByModel[activeProduct.catalog_model] ?? 0}
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
