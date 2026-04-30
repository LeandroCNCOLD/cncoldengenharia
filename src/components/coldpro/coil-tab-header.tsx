/**
 * Cabeçalho compacto exibido no topo das abas Evaporador/Condensador.
 * Mostra o status técnico daquele coil (do readiness), botão "Simular"
 * e o último resultado vs catálogo. Reusa as queries já invalidadas
 * pelo EquipmentReadinessPanel.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getEquipmentReadiness,
  autoSimulateCoilsIfReady,
} from "@/server/equipmentReadiness.functions";
import { listEquipmentCoilSimulations } from "@/lib/coldpro/coil-simulations";
import { runCoilSimulation } from "@/lib/coldpro/run-coil-simulation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type CoilKind = "evaporator" | "condenser";

const READINESS_KEY = (kind: CoilKind) =>
  kind === "evaporator" ? "evaporator" : "condenser";
const SIM_KEY = (kind: CoilKind) =>
  kind === "evaporator" ? "sim_evaporator" : "sim_condenser";
const ALIASES: Record<CoilKind, string[]> = {
  evaporator: ["evaporator", "evaporador"],
  condenser: ["condenser", "condensador"],
};

interface Props {
  equipmentProjectId: string;
  kind: CoilKind;
}

export function CoilTabHeader({ equipmentProjectId, kind }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const readinessFn = useServerFn(getEquipmentReadiness);
  const autoFn = useServerFn(autoSimulateCoilsIfReady);

  const readinessQuery = useQuery({
    queryKey: ["equipment-readiness", equipmentProjectId],
    queryFn: () => readinessFn({ data: { equipmentProjectId } }),
    staleTime: 10_000,
  });
  const simsQuery = useQuery({
    queryKey: ["equipment-coil-sims", equipmentProjectId],
    queryFn: () => listEquipmentCoilSimulations(equipmentProjectId),
    staleTime: 10_000,
  });

  const compItem = readinessQuery.data?.items.find((i) => i.key === READINESS_KEY(kind));
  const simItem = readinessQuery.data?.items.find((i) => i.key === SIM_KEY(kind));
  const lastSim = (simsQuery.data ?? []).find(
    (s) => s.coil_type && ALIASES[kind].includes(s.coil_type),
  );

  const runMut = useMutation({
    mutationFn: async () => {
      const status = await autoFn({ data: { equipmentProjectId } });
      const slot = kind === "evaporator" ? status.evaporator : status.condenser;
      if (!slot.componentItemId) throw new Error(`Sem ${kind} vinculado.`);
      if (!slot.ready) throw new Error("Dados incompletos para simular.");
      const out = await runCoilSimulation({
        equipmentProjectId,
        componentItemId: slot.componentItemId,
        kind,
        userId: user?.id,
        label: "manual",
      });
      if (!out.ok) throw new Error(out.reason ?? "Falha na simulação.");
    },
    onSuccess: () => {
      toast.success("Simulação concluída.");
      qc.invalidateQueries({ queryKey: ["equipment-readiness", equipmentProjectId] });
      qc.invalidateQueries({ queryKey: ["equipment-coil-sims", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calc = readNumber((lastSim?.outputs as Record<string, unknown> | null)?.capacityW);
  const cat = readNumber(
    ((lastSim?.inputs as { nominal?: { capacityW?: number } } | null)?.nominal ?? {}).capacityW,
  );
  const errPct = calc != null && cat != null && cat !== 0 ? ((calc - cat) / cat) * 100 : null;
  const errClass =
    errPct == null
      ? "text-muted-foreground"
      : Math.abs(errPct) > 10
        ? "text-destructive"
        : Math.abs(errPct) > 5
          ? "text-amber-600"
          : "text-emerald-600";

  const blocked = compItem?.status === "blocked";
  const ready = compItem?.status === "ok";
  const titleSuffix =
    kind === "evaporator" ? "do evaporador" : "do condensador";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {ready ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Pronto
              </Badge>
            ) : blocked ? (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" /> Bloqueado
              </Badge>
            ) : (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                <AlertTriangle className="mr-1 h-3 w-3" /> Incompleto
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Status técnico {titleSuffix}
            </span>
          </div>

          {compItem && (
            <p className="mt-1 text-xs text-muted-foreground">{compItem.message}</p>
          )}
          {compItem?.missing && compItem.missing.length > 0 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Faltam: {compItem.missing.join(", ")}
            </p>
          )}

          {lastSim && (
            <dl className="mt-3 grid max-w-md grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">Catálogo</dt>
                <dd className="font-mono">{fmtW(cat)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">Calculado</dt>
                <dd className="font-mono">{fmtW(calc)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">Erro %</dt>
                <dd className={cn("font-mono font-semibold", errClass)}>
                  {errPct == null
                    ? "—"
                    : `${errPct >= 0 ? "+" : ""}${errPct.toFixed(1)}%`}
                </dd>
              </div>
            </dl>
          )}
          {!lastSim && simItem && (
            <p className="mt-2 text-xs text-muted-foreground">{simItem.message}</p>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => runMut.mutate()}
          disabled={runMut.isPending || !ready}
          className="gap-1.5"
        >
          {runMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {kind === "evaporator" ? "Simular evaporador" : "Simular condensador"}
        </Button>
      </CardContent>
    </Card>
  );
}

function readNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function fmtW(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)} kW`;
  return `${v.toFixed(0)} W`;
}
