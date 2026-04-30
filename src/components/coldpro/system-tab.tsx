/**
 * Aba Sistema Completo — envolve o `SystemSimulatorPanel` existente,
 * pré-preenchendo códigos de geometria a partir das bobinas vinculadas.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info as InfoIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SystemSimulatorPanel } from "@/components/coldpro/system-simulator-panel";
import { listEquipmentComponentLinks } from "@/lib/coldpro/equipment-component-links";
import type { EquipmentComponentLinkExpanded } from "@/lib/coldpro/equipment-component-links";
import {
  resolveCoilComponent,
  resolveCompressorComponent,
  resolveFanComponent,
} from "@/modules/coldpro/biblioteca/technicalComponentResolver";
import type { SystemResolvedTechnicalData } from "@/modules/coldpro/system";

interface Props {
  equipmentProjectId: string;
}

export function SystemTab({ equipmentProjectId }: Props) {
  const {
    data: items,
    isLoading: isLoadingItems,
    isError: isItemsError,
    error: itemsError,
  } = useQuery({
    queryKey: ["equip-coil-items", equipmentProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_items")
        .select("id, kind, code, model")
        .eq("equipment_project_id", equipmentProjectId);
      if (error) throw new Error(error.message);
      return data ?? [];
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

  const evap = items?.find((i) => i.kind === "evaporador");
  const cond = items?.find((i) => i.kind === "condensador");
  const compressor = links?.find((l) => l.role === "compressor");
  const fanEvap = links?.find((l) => l.role === "fan_evaporator");
  const fanCond = links?.find((l) => l.role === "fan_condenser");
  const linkedEvap = links?.find((l) => l.role === "evaporator");
  const linkedCond = links?.find((l) => l.role === "condenser");

  const {
    data: resolvedSystemData,
    isFetching: isResolvingSystemData,
    isError: isResolverError,
    error: resolverError,
  } = useQuery({
    queryKey: [
      "equip-system-resolved-components",
      compressor?.technical_component_id,
      linkedEvap?.technical_component_id,
      linkedCond?.technical_component_id,
      fanEvap?.technical_component_id,
      fanCond?.technical_component_id,
    ],
    queryFn: async () => {
      const resolved: SystemResolvedTechnicalData = {};
      const warnings: string[] = [];

      if (compressor?.technical_component_id) {
        const comp = await resolveCompressorComponent(compressor.technical_component_id);
        warnings.push(...comp.warnings);
        if (comp.data?.thermalcalc.systemCompressor) {
          resolved.compressor = comp.data.thermalcalc.systemCompressor;
        }
      }
      if (linkedEvap?.technical_component_id) {
        const evapResolved = await resolveCoilComponent(linkedEvap.technical_component_id);
        warnings.push(...evapResolved.warnings);
        if (evapResolved.data) resolved.evaporatorCoil = evapResolved.data.thermalcalc;
      }
      if (linkedCond?.technical_component_id) {
        const condResolved = await resolveCoilComponent(linkedCond.technical_component_id);
        warnings.push(...condResolved.warnings);
        if (condResolved.data) resolved.condenserCoil = condResolved.data.thermalcalc;
      }
      if (fanEvap?.technical_component_id) {
        const fan = await resolveFanComponent(fanEvap.technical_component_id);
        warnings.push(...fan.warnings);
        if (fan.data?.thermalcalc.nominalAirflowM3h) {
          resolved.fans = {
            ...resolved.fans,
            evaporator: fan.data.thermalcalc,
          };
        }
      }
      if (fanCond?.technical_component_id) {
        const fan = await resolveFanComponent(fanCond.technical_component_id);
        warnings.push(...fan.warnings);
        if (fan.data?.thermalcalc.nominalAirflowM3h) {
          resolved.fans = {
            ...resolved.fans,
            condenser: fan.data.thermalcalc,
          };
        }
      }

      return { resolved, warnings };
    },
    enabled: Boolean(
      compressor?.technical_component_id ||
      linkedEvap?.technical_component_id ||
      linkedCond?.technical_component_id ||
      fanEvap?.technical_component_id ||
      fanCond?.technical_component_id,
    ),
  });

  const missing: string[] = [];
  if (!evap) missing.push("evaporador");
  if (!cond) missing.push("condensador");
  if (!compressor) missing.push("compressor");
  if (!fanEvap) missing.push("ventilador do evaporador");
  if (!fanCond) missing.push("ventilador do condensador");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Componentes do sistema</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {isLoadingItems || isLoadingLinks ? (
            <p className="text-sm text-muted-foreground">Carregando componentes…</p>
          ) : isItemsError || isLinksError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar componentes:{" "}
              {((itemsError ?? linksError) as Error | undefined)?.message}
            </p>
          ) : (
            <>
              <Item label="Evaporador" value={evap?.code ?? evap?.model ?? null} />
              <Item label="Condensador" value={cond?.code ?? cond?.model ?? null} />
              <Item label="Compressor" value={compressor?.component?.model ?? null} />
              <Item label="Ventilador evap." value={fanEvap?.component?.model ?? null} />
              <Item label="Ventilador cond." value={fanCond?.component?.model ?? null} />
            </>
          )}
        </CardContent>
      </Card>

      {missing.length > 0 && (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Faltam: <strong>{missing.join(", ")}</strong>. A simulação roda mesmo assim com os
            defaults abaixo, mas os resultados serão indicativos.
          </AlertDescription>
        </Alert>
      )}

      <SystemSimulatorPanel
        defaultEvaporatorCode={evap?.code ?? undefined}
        defaultCondenserCode={cond?.code ?? undefined}
        resolvedTechnicalData={resolvedSystemData?.resolved}
        resolverWarnings={[
          ...(resolvedSystemData?.warnings ?? []),
          ...(isResolverError
            ? [`Erro ao resolver dados técnicos: ${(resolverError as Error).message}`]
            : []),
        ]}
        isResolvingTechnicalData={isResolvingSystemData}
      />
    </div>
  );
}

export interface SystemTabComponentLinks {
  compressor?: EquipmentComponentLinkExpanded;
  evaporator?: EquipmentComponentLinkExpanded;
  condenser?: EquipmentComponentLinkExpanded;
  fanEvaporator?: EquipmentComponentLinkExpanded;
  fanCondenser?: EquipmentComponentLinkExpanded;
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">
        {value ? value : <span className="text-destructive">— não vinculado</span>}
      </p>
    </div>
  );
}
