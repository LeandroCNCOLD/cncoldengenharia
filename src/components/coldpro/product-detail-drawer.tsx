import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Archive, ExternalLink, LineChart, Loader2, Wrench } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  approveProduct,
  archiveProduct,
  ensureEquipmentProject,
  unarchiveProduct,
} from "@/server/cnProductDevelopment.functions";
import type { ProductCardData } from "./product-kanban-card";

interface Props {
  product: ProductCardData | null;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDrawer({ product, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [archiveReason, setArchiveReason] = useState("");
  const open = !!product;
  const navigate = useNavigate();

  const ensureMutation = useMutation({
    mutationFn: () => ensureEquipmentProject({ data: { id: product!.id } }),
    onSuccess: ({ equipmentProjectId }) => {
      qc.invalidateQueries({ queryKey: ["cn-product-dev"] });
      onOpenChange(false);
      navigate({
        to: "/coldpro/equipamentos/$id",
        params: { id: equipmentProjectId },
      });
    },
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  const { data: curves } = useQuery({
    queryKey: ["cn-curves", product?.catalog_model],
    enabled: open,
    queryFn: async () => {
      if (!product) return [];
      const { data } = await supabase
        .from("cn_catalog_performance_curves")
        .select("id, modelo, hp, refrigerante, total_pontos, corrente_estimada, corrente_partida, carga_fluido")
        .eq("modelo", product.catalog_model)
        .limit(20);
      return data ?? [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveProduct({ data: { id: product!.id } }),
    onSuccess: (res) => {
      toast.success("Produto aprovado e publicado no catálogo de produção.");
      qc.invalidateQueries({ queryKey: ["cn-product-dev"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveProduct({ data: { id: product!.id, reason: archiveReason || null } }),
    onSuccess: () => {
      toast.success("Produto arquivado.");
      qc.invalidateQueries({ queryKey: ["cn-product-dev"] });
      onOpenChange(false);
      setArchiveReason("");
    },
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveProduct({ data: { id: product!.id } }),
    onSuccess: () => {
      toast.success("Produto restaurado.");
      qc.invalidateQueries({ queryKey: ["cn-product-dev"] });
      onOpenChange(false);
    },
  });

  if (!product) return null;
  const isArchived = product.status === "arquivado";
  const isApproved = product.status === "aprovado";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{product.catalog_model}</SheetTitle>
          <SheetDescription>
            {product.linha && <span>{product.linha} · </span>}
            {product.hp && <span>{product.hp} HP · </span>}
            {product.refrigerante && <span>{product.refrigerante}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Status</h3>
            <Badge variant="secondary">{product.status}</Badge>
          </div>

          {product.equipment_project_id && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Equipamento publicado</h3>
              <Link
                to="/coldpro/equipamentos/$id"
                params={{ id: product.equipment_project_id }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Abrir equipamento <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <LineChart className="h-4 w-4" /> Curvas reais ({curves?.length ?? 0})
            </h3>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {(curves ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">
                    {c.refrigerante ?? "—"} · {c.total_pontos ?? 0} pts
                  </span>
                  <span className="text-muted-foreground">
                    {c.corrente_estimada ? `${c.corrente_estimada}A` : ""}
                  </span>
                </div>
              ))}
              {(!curves || curves.length === 0) && (
                <p className="text-xs text-muted-foreground">Sem curvas vinculadas.</p>
              )}
            </div>
          </div>

          {product.notes && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Notas</h3>
              <p className="text-sm text-muted-foreground">{product.notes}</p>
            </div>
          )}

          {!isArchived && !isApproved && (
            <div className="space-y-2">
              <Label>Motivo do arquivamento (opcional)</Label>
              <Textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                rows={2}
                placeholder="Ex: modelo descontinuado"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button
              variant="secondary"
              onClick={() => ensureMutation.mutate()}
              disabled={ensureMutation.isPending}
            >
              {ensureMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-1 h-4 w-4" />
              )}
              Abrir ferramentas de análise
            </Button>
            {!isApproved && !isArchived && (
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                Aprovar e publicar no catálogo
              </Button>
            )}
            {!isArchived && (
              <Button
                variant="outline"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                <Archive className="mr-1 h-4 w-4" /> Arquivar
              </Button>
            )}
            {isArchived && (
              <Button onClick={() => unarchiveMutation.mutate()} disabled={unarchiveMutation.isPending}>
                Restaurar para "A Analisar"
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
