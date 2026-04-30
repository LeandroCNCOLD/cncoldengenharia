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
import {
  approveProduct,
  archiveProduct,
  ensureEquipmentProject,
  getProductFullDetails,
  unarchiveProduct,
} from "@/server/cnProductDevelopment.functions";
import type { ProductCardData } from "./product-kanban-card";

interface Props {
  product: ProductCardData | null;
  onOpenChange: (open: boolean) => void;
}

// Agrupamento dos campos técnicos vindos do raw_json do CSV importado
const FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: string; label: string; unit?: string }> }> = [
  {
    title: "Cadastro",
    fields: [
      { key: "MODELO", label: "Modelo" },
      { key: "GABINETE", label: "Gabinete" },
      { key: "HP", label: "HP" },
      { key: "REFRIGERANTE", label: "Refrigerante" },
      { key: "TENSÃO ELÉTRICA (v)", label: "Tensão elétrica" },
      { key: "ALTITUDE (m)", label: "Altitude", unit: "m" },
      { key: "source_sheet", label: "Origem (planilha)" },
    ],
  },
  {
    title: "Condições térmicas",
    fields: [
      { key: "TEMPERATURA DE EVAPORAÇÃO  (°C)", label: "Temp. evaporação", unit: "°C" },
      { key: "TEMPERATURA DE CONDENSAÇÃO  (°C)", label: "Temp. condensação", unit: "°C" },
      { key: "SUBRESFRIAMENTO (K)", label: "Subresfriamento", unit: "K" },
      { key: "SUPERAQUECIMENTO TOTAL (K)", label: "Superaq. total", unit: "K" },
      { key: "SUPERAQUECIMENTO ÚTIL (K)", label: "Superaq. útil", unit: "K" },
      { key: "UMIDADE INTERNA (%)", label: "Umidade interna", unit: "%" },
    ],
  },
  {
    title: "Capacidade & Potência",
    fields: [
      { key: "CAPACIDADE FRIGORÍFICA DO COMPRESSOR (Kcal/h)", label: "Cap. frigorífica", unit: "kcal/h" },
      { key: "POTÊNCIA ELÉTRICA REQUERIDA TOTAL (kW)", label: "Potência total", unit: "kW" },
      { key: "POTÊNCIA ELÉTRICA REQUERIDA VENTILADOR (kW)", label: "Pot. ventilador", unit: "kW" },
      { key: "POTÊNCIA ELÉTRICA REQUERIDA RESISTÊNCIA (kW)", label: "Pot. resistência", unit: "kW" },
    ],
  },
  {
    title: "Correntes elétricas",
    fields: [
      { key: "CORRENTE ELÉTRICA ESTIMADA (A)", label: "Estimada", unit: "A" },
      { key: "CORRENTE ELÉTRICA DE PARTIDA (A)", label: "Partida", unit: "A" },
      { key: "CORRENTE ELÉTRICA VENTILADORES (A)", label: "Ventiladores", unit: "A" },
      { key: "CORRENTE ELÉTRICA RESISTÊNCIA (A)", label: "Resistência", unit: "A" },
    ],
  },
  {
    title: "Evaporador & Ventilador",
    fields: [
      { key: "MODELO EVAPORADOR", label: "Modelo evaporador" },
      { key: "VENTILADOR EVAPORADOR", label: "Ventilador" },
      { key: "VAZÃO VENTILADOR EVAPORADOR (m³/h)", label: "Vazão de ar", unit: "m³/h" },
    ],
  },
];

function fmt(value: string | number | null | undefined, unit?: string) {
  if (value === null || value === undefined || value === "") return "—";
  const display = typeof value === "number" ? value.toLocaleString("pt-BR") : String(value);
  return unit ? `${display} ${unit}` : display;
}

export function ProductDetailDrawer({ product, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [archiveReason, setArchiveReason] = useState("");
  const open = !!product;
  const navigate = useNavigate();

  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ["cn-product-dev-details", product?.id],
    enabled: open && !!product,
    queryFn: () => getProductFullDetails({ data: { id: product!.id } }),
  });

  const ensureMutation = useMutation({
    mutationFn: () => ensureEquipmentProject({ data: { id: product!.id } }),
    onSuccess: ({ equipmentProjectId }) => {
      qc.invalidateQueries({ queryKey: ["cn-product-dev"] });
      onOpenChange(false);
      navigate({ to: "/coldpro/equipamentos/$id", params: { id: equipmentProjectId } });
    },
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveProduct({ data: { id: product!.id } }),
    onSuccess: () => {
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
  const tech = details?.technical ?? {};
  const curves = details?.curves ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{product.catalog_model}</SheetTitle>
          <SheetDescription>
            {product.linha && <span>{product.linha} · </span>}
            {product.hp && <span>{product.hp} HP · </span>}
            {product.refrigerante && <span>{product.refrigerante}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{product.status}</Badge>
            {curves.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <LineChart className="h-3 w-3" /> {curves.length} curva(s) · {curves[0]?.total_pontos ?? 0} pts
              </Badge>
            )}
            {product.equipment_project_id && (
              <Link
                to="/coldpro/equipamentos/$id"
                params={{ id: product.equipment_project_id }}
                className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Equipamento <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          {detailsLoading && (
            <p className="text-sm text-muted-foreground">Carregando dados técnicos…</p>
          )}

          {!detailsLoading && Object.keys(tech).length === 0 && (
            <p className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
              Nenhum dado técnico encontrado no catálogo importado para este modelo.
            </p>
          )}

          {!detailsLoading &&
            Object.keys(tech).length > 0 &&
            FIELD_GROUPS.map((group) => {
              const items = group.fields.filter((f) => tech[f.key] !== undefined && tech[f.key] !== null && tech[f.key] !== "");
              if (items.length === 0) return null;
              return (
                <div key={group.title}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{group.title}</h3>
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3">
                    {items.map((f) => (
                      <div key={f.key} className="min-w-0">
                        <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </p>
                        <p className="truncate text-sm font-medium text-foreground">
                          {fmt(tech[f.key], f.unit)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

          {curves.length > 1 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Curvas disponíveis ({curves.length})</h3>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {curves.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">
                      #{c.curva_indice ?? "?"} · {c.refrigerante ?? "—"} · {c.total_pontos ?? 0} pts
                    </span>
                    <span className="text-muted-foreground">{c.gabinete ?? ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
