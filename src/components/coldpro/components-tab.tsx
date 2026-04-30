/**
 * Aba Componentes — visão consolidada de todos os componentes vinculados ao
 * equipamento (evaporador/condensador via `component_items` + compressor,
 * ventiladores, válvula, fluido via `equipment_component_links`).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import {
  EQUIPMENT_COMPONENT_ROLE_LABELS,
  listEquipmentComponentLinks,
  removeEquipmentComponentLink,
  type EquipmentComponentRole,
} from "@/lib/coldpro/equipment-component-links";

interface Props {
  equipmentProjectId: string;
}

interface ComponentItemRow {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  status: string;
}

export function ComponentsTab({ equipmentProjectId }: Props) {
  const qc = useQueryClient();

  const {
    data: localComponents,
    isLoading: isLoadingLocalComponents,
    isError: isLocalComponentsError,
    error: localComponentsError,
  } = useQuery({
    queryKey: ["equip-local-components", equipmentProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_items")
        .select("id, kind, manufacturer, model, code, status")
        .eq("equipment_project_id", equipmentProjectId)
        .order("kind");
      if (error) throw new Error(error.message);
      return (data ?? []) as ComponentItemRow[];
    },
  });

  const {
    data: links,
    isLoading: isLoadingLinks,
    isError: isLinksError,
    error: linksError,
  } = useQuery({
    queryKey: ["equip-component-links", equipmentProjectId],
    queryFn: () => listEquipmentComponentLinks(equipmentProjectId),
  });

  const removeMut = useMutation({
    mutationFn: removeEquipmentComponentLink,
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linksByRole = new Map<EquipmentComponentRole, typeof links>();
  for (const l of links ?? []) {
    const arr = linksByRole.get(l.role) ?? [];
    arr.push(l);
    linksByRole.set(l.role, arr);
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Adicione compressor, ventiladores, válvula e fluido nas respectivas abas. Evaporador e
          condensador são cadastrados nas abas dedicadas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bobinas do equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLocalComponents ? (
            <p className="text-sm text-muted-foreground">Carregando bobinas…</p>
          ) : isLocalComponentsError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar bobinas: {(localComponentsError as Error).message}
            </p>
          ) : !localComponents || localComponents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma bobina cadastrada. Use as abas Evaporador / Condensador.
            </p>
          ) : (
            <ul className="divide-y rounded border">
              {localComponents.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {c.manufacturer ?? "—"} · {c.model ?? c.code ?? "Sem modelo"}
                    </div>
                    <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {c.kind}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Componentes vinculados da Biblioteca Técnica</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLinks ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : isLinksError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar vínculos: {(linksError as Error).message}
            </p>
          ) : !links || links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum componente vinculado. Adicione compressor / ventilador / válvula / fluido nas
              abas dedicadas.
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(linksByRole.entries()).map(([role, items]) => (
                <div key={role}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {EQUIPMENT_COMPONENT_ROLE_LABELS[role]}
                  </p>
                  <ul className="divide-y rounded border">
                    {items?.map((l) => {
                      const c = l.component;
                      return (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2 p-3 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">
                              {c?.manufacturer ?? "—"} ·{" "}
                              {c?.model ?? c?.code ?? "Componente removido"}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted-foreground">
                              {c?.entity_type && (
                                <Badge variant="outline" className="text-[10px]">
                                  {c.entity_type}
                                </Badge>
                              )}
                              {c?.source && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {c.source}
                                </Badge>
                              )}
                              {l.quantity > 1 && (
                                <Badge className="text-[10px]">×{l.quantity}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button asChild variant="ghost" size="sm">
                              <Link to="/coldpro/admin/banco-tecnico">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMut.mutate(l.id)}
                              disabled={removeMut.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
