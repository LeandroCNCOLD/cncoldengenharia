/**
 * Aba Histórico — eventos do equipamento (simulações, calibrações, mapas,
 * vínculos de componentes).
 */
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  equipmentProjectId: string;
}

interface HistoryEvent {
  id: string;
  kind: "simulation" | "calibration" | "perf_map" | "link" | "equipment_sim";
  label: string;
  detail: string | null;
  created_at: string;
}

async function loadHistory(equipmentProjectId: string): Promise<HistoryEvent[]> {
  const events: HistoryEvent[] = [];

  // 1. Simulações de bobina
  const { data: sims } = await supabase
    .from("coil_simulations")
    .select("id, label, coil_type, mode, created_at")
    .eq("equipment_project_id", equipmentProjectId)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const s of sims ?? []) {
    events.push({
      id: `sim-${s.id}`,
      kind: "simulation",
      label: s.label ?? `Simulação ${s.coil_type ?? ""}`.trim(),
      detail: `${s.coil_type ?? "—"} · ${s.mode}`,
      created_at: s.created_at,
    });
  }

  // 2. Calibrações
  const { data: calItems } = await supabase
    .from("component_items")
    .select("id")
    .eq("equipment_project_id", equipmentProjectId);
  const itemIds = (calItems ?? []).map((c) => c.id);
  if (itemIds.length > 0) {
    const { data: cals } = await supabase
      .from("coil_calibrations")
      .select("id, calibration_name, status, created_at, coil_type")
      .in("component_item_id", itemIds)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const c of cals ?? []) {
      events.push({
        id: `cal-${c.id}`,
        kind: "calibration",
        label: c.calibration_name ?? "Calibração",
        detail: `${c.coil_type} · ${c.status}`,
        created_at: c.created_at,
      });
    }
  }

  // 3. Mapas de performance
  const { data: maps } = await supabase
    .from("coil_performance_maps")
    .select("id, map_name, status, coil_type, created_at")
    .eq("equipment_project_id", equipmentProjectId)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const m of maps ?? []) {
    events.push({
      id: `map-${m.id}`,
      kind: "perf_map",
      label: m.map_name ?? "Mapa de performance",
      detail: `${m.coil_type} · ${m.status}`,
      created_at: m.created_at,
    });
  }

  // 4. Vínculos de componentes
  const { data: links } = await supabase
    .from("equipment_component_links")
    .select("id, role, created_at, technical_component_id")
    .eq("equipment_project_id", equipmentProjectId)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const l of links ?? []) {
    events.push({
      id: `lnk-${l.id}`,
      kind: "link",
      label: `Componente vinculado (${l.role})`,
      detail: l.technical_component_id.slice(0, 8),
      created_at: l.created_at,
    });
  }

  // 5. Simulações de equipamento
  const { data: esims } = await supabase
    .from("equipment_simulations")
    .select("id, created_at")
    .eq("equipment_project_id", equipmentProjectId)
    .order("created_at", { ascending: false })
    .limit(10);
  for (const e of esims ?? []) {
    events.push({
      id: `esim-${e.id}`,
      kind: "equipment_sim",
      label: "Simulação de sistema completo",
      detail: null,
      created_at: e.created_at,
    });
  }

  return events.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const KIND_LABEL: Record<HistoryEvent["kind"], { label: string; color: string }> = {
  simulation: { label: "Simulação", color: "bg-blue-500" },
  calibration: { label: "Calibração", color: "bg-emerald-500" },
  perf_map: { label: "Mapa", color: "bg-purple-500" },
  link: { label: "Componente", color: "bg-amber-500" },
  equipment_sim: { label: "Sistema", color: "bg-rose-500" },
};

export function HistoryTab({ equipmentProjectId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["equip-history", equipmentProjectId],
    queryFn: () => loadHistory(equipmentProjectId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Histórico do equipamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Erro ao carregar histórico: {(error as Error).message}
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <ul className="divide-y rounded border">
            {data.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{e.label}</div>
                  {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={`text-[10px] ${KIND_LABEL[e.kind].color}`}>
                    {KIND_LABEL[e.kind].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
