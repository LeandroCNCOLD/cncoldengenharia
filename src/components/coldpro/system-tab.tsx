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

interface Props {
  equipmentProjectId: string;
}

export function SystemTab({ equipmentProjectId }: Props) {
  const { data: items } = useQuery({
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

  const { data: links } = useQuery({
    queryKey: ["equip-component-links", equipmentProjectId],
    queryFn: () => listEquipmentComponentLinks(equipmentProjectId),
  });

  const evap = items?.find((i) => i.kind === "evaporador");
  const cond = items?.find((i) => i.kind === "condensador");
  const compressor = links?.find((l) => l.role === "compressor");
  const fanEvap = links?.find((l) => l.role === "fan_evaporator");
  const fanCond = links?.find((l) => l.role === "fan_condenser");

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
          <Item label="Evaporador" value={evap?.code ?? evap?.model ?? null} />
          <Item label="Condensador" value={cond?.code ?? cond?.model ?? null} />
          <Item label="Compressor" value={compressor?.component?.model ?? null} />
          <Item label="Ventilador evap." value={fanEvap?.component?.model ?? null} />
          <Item label="Ventilador cond." value={fanCond?.component?.model ?? null} />
        </CardContent>
      </Card>

      {missing.length > 0 && (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Faltam: <strong>{missing.join(", ")}</strong>. A simulação roda mesmo assim
            com os defaults abaixo, mas os resultados serão indicativos.
          </AlertDescription>
        </Alert>
      )}

      <SystemSimulatorPanel
        defaultEvaporatorCode={evap?.code ?? undefined}
        defaultCondenserCode={cond?.code ?? undefined}
      />
    </div>
  );
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
