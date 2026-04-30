import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ExternalLink, LineChart } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ProductCardData {
  id: string;
  catalog_model: string;
  linha: string | null;
  hp: string | null;
  refrigerante: string | null;
  status: string;
  equipment_project_id: string | null;
  notes: string | null;
}

interface Props {
  product: ProductCardData;
  curveCount: number;
  onClick: () => void;
}

export function ProductKanbanCard({ product, curveCount, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group cursor-pointer border-border bg-card p-3 transition-colors hover:border-primary/40"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{product.catalog_model}</p>
            {product.equipment_project_id && (
              <Link
                to="/coldpro/equipamentos/$id"
                params={{ id: product.equipment_project_id }}
                onClick={(e) => e.stopPropagation()}
                className="text-primary hover:text-primary/80"
                aria-label="Abrir equipamento"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {product.linha && (
              <Badge variant="outline" className="text-[10px]">
                {product.linha}
              </Badge>
            )}
            {product.hp && (
              <Badge variant="outline" className="text-[10px]">
                {product.hp} HP
              </Badge>
            )}
            {product.refrigerante && (
              <Badge variant="secondary" className="text-[10px]">
                {product.refrigerante}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <LineChart className="h-3 w-3" />
            <span>{curveCount} curva(s)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
