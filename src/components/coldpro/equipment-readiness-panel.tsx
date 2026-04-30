/**
 * EquipmentReadinessPanel
 *
 * - Mostra os 9 itens de getEquipmentReadiness com semáforo (ok/incomplete/blocked).
 * - Botão principal dinâmico (com base em nextAction).
 * - Ao montar, chama autoSimulateCoilsIfReady; se algum coil estiver pronto e
 *   ainda não simulado, dispara a simulação automática (uma vez por sessão).
 * - Painel consolidado: catálogo vs calculado para evap/cond, com erro %.
 */
import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Loader2,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getEquipmentReadiness,
  autoSimulateCoilsIfReady,
  type EquipmentReadinessResult,
  type ReadinessItem,
  type ReadinessLevel,
} from "@/server/equipmentReadiness.functions";
import { listEquipmentCoilSimulations } from "@/lib/coldpro/coil-simulations";
import { runCoilSimulation } from "@/lib/coldpro/run-coil-simulation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const AUTO_KEY = "cn-autosim-done:";

const STATUS_STYLES: Record<ReadinessLevel, string> = {
  ok: "bg-emerald-500",
  incomplete: "bg-amber-500",
  blocked: "bg-destructive",
};

const STATUS_LABELS: Record<ReadinessLevel, string> = {
  ok: "OK",
  incomplete: "Incompleto",
  blocked: "Bloqueado",
};

const NEXT_ACTION_BUTTONS: Record<
  EquipmentReadinessResult["nextAction"],
  { label: string; icon: typeof Sparkles; variant?: "default" | "secondary" | "outline" }
> = {
  load_from_catalog: { label: "Carregar dados do catálogo", icon: Sparkles },
  complete_components: { label: "Completar dados técnicos", icon: Wand2 },
  simulate_coils: { label: "Simular evaporador e condensador", icon: Zap },
  simulate_system: { label: "Simular sistema completo", icon: Zap },
  all_done: {
    label: "Sistema validado",
    icon: CheckCircle2,
    variant: "secondary",
  },
};

interface Props {
  equipmentProjectId: string;
  /** Quando o usuário clica no botão principal — a página decide para qual aba ir. */
  onPrimaryAction?: (action: EquipmentReadinessResult["nextAction"]) => void;
}

export function EquipmentReadinessPanel({ equipmentProjectId, onPrimaryAction }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const readinessFn = useServerFn(getEquipmentReadiness);
  const autoSimFn = useServerFn(autoSimulateCoilsIfReady);

  const readinessQuery = useQuery({
    queryKey: ["equipment-readiness", equipmentProjectId],
    queryFn: () => readinessFn({ data: { equipmentProjectId } }),
    staleTime: 10_000,
  });

  // Última simulação por tipo (para o painel consolidado)
  const simsQuery = useQuery({
    queryKey: ["equipment-coil-sims", equipmentProjectId],
    queryFn: () => listEquipmentCoilSimulations(equipmentProjectId),
    staleTime: 10_000,
  });

  // ============= AUTO-SIMULATE =============
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (typeof window === "undefined") return;
    const key = `${AUTO_KEY}${equipmentProjectId}`;
    if (sessionStorage.getItem(key)) return;
    autoRanRef.current = true;

    (async () => {
      try {
        const status = await autoSimFn({ data: { equipmentProjectId } });
        const tasks: Promise<unknown>[] = [];
        if (status.evaporator.shouldRun && status.evaporator.componentItemId) {
          tasks.push(
            runCoilSimulation({
              equipmentProjectId,
              componentItemId: status.evaporator.componentItemId,
              kind: "evaporator",
              userId: user?.id,
              label: "auto",
            }),
          );
        }
        if (status.condenser.shouldRun && status.condenser.componentItemId) {
          tasks.push(
            runCoilSimulation({
              equipmentProjectId,
              componentItemId: status.condenser.componentItemId,
              kind: "condenser",
              userId: user?.id,
              label: "auto",
            }),
          );
        }
        if (tasks.length === 0) {
          sessionStorage.setItem(key, "1");
          return;
        }
        await Promise.allSettled(tasks);
        sessionStorage.setItem(key, "1");
        toast.success(
          tasks.length === 2
            ? "Simulação executada automaticamente (evaporador + condensador)."
            : "Simulação executada automaticamente.",
        );
        qc.invalidateQueries({ queryKey: ["equipment-readiness", equipmentProjectId] });
        qc.invalidateQueries({ queryKey: ["equipment-coil-sims", equipmentProjectId] });
      } catch (e) {
        console.error("auto-simulate failed", e);
      }
    })();
  }, [equipmentProjectId, autoSimFn, qc, user?.id]);

  // ============= MUTATION: rodar manualmente =============
  const runMut = useMutation({
    mutationFn: async (kind: "evaporator" | "condenser") => {
      const r = readinessQuery.data;
      if (!r) throw new Error("Readiness não carregado.");
      // Busca componentItemId via auto-sim (mais leve do que refazer o query)
      const status = await autoSimFn({ data: { equipmentProjectId } });
      const slot = kind === "evaporator" ? status.evaporator : status.condenser;
      if (!slot.componentItemId) throw new Error(`Sem ${kind} vinculado.`);
      if (!slot.ready) throw new Error(`Dados do ${kind} estão incompletos.`);
      const out = await runCoilSimulation({
        equipmentProjectId,
        componentItemId: slot.componentItemId,
        kind,
        userId: user?.id,
        label: "manual",
      });
      if (!out.ok) throw new Error(out.reason ?? "Falha na simulação.");
      return kind;
    },
    onSuccess: (kind) => {
      toast.success(`Simulação do ${kind === "evaporator" ? "evaporador" : "condensador"} concluída.`);
      qc.invalidateQueries({ queryKey: ["equipment-readiness", equipmentProjectId] });
      qc.invalidateQueries({ queryKey: ["equipment-coil-sims", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (readinessQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Avaliando status técnico…
        </CardContent>
      </Card>
    );
  }
  const r = readinessQuery.data;
  if (!r) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Não foi possível carregar o status técnico.
        </CardContent>
      </Card>
    );
  }

  const primary = NEXT_ACTION_BUTTONS[r.nextAction];
  const PrimaryIcon = primary.icon;

  // Pode simular sistema?
  const canSystem =
    r.items.find((i) => i.key === "sim_evaporator")?.status === "ok" &&
    r.items.find((i) => i.key === "sim_condenser")?.status === "ok" &&
    r.items.find((i) => i.key === "compressor")?.status === "ok";
  const systemBlockReasons = r.items.find((i) => i.key === "sim_system");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleAlert className="h-4 w-4 text-primary" />
            Status Técnico do Equipamento
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.completeness}% completo
            {r.catalogModel ? ` · catálogo: ${r.catalogModel}` : ""}
            {r.refrigerant ? ` · ${r.refrigerant}` : ""}
          </p>
          <Progress value={r.completeness} className="mt-2 h-1.5 w-64" />
        </div>
        <Button
          size="sm"
          variant={primary.variant ?? "default"}
          onClick={() => onPrimaryAction?.(r.nextAction)}
          disabled={r.nextAction === "all_done"}
          className="gap-1.5"
        >
          <PrimaryIcon className="h-4 w-4" />
          {primary.label}
          {r.nextAction !== "all_done" && <ChevronRight className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grid de itens */}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {r.items.map((item) => (
            <ReadinessRow
              key={item.key}
              item={item}
              onRun={
                item.key === "sim_evaporator" || item.key === "sim_condenser"
                  ? () => {
                      const kind = item.key === "sim_evaporator" ? "evaporator" : "condenser";
                      runMut.mutate(kind);
                    }
                  : undefined
              }
              running={
                runMut.isPending &&
                ((item.key === "sim_evaporator" && runMut.variables === "evaporator") ||
                  (item.key === "sim_condenser" && runMut.variables === "condenser"))
              }
            />
          ))}
        </ul>

        {/* Painel consolidado catálogo vs calculado */}
        <ConsolidatedPanel
          equipmentProjectId={equipmentProjectId}
          sims={simsQuery.data ?? []}
        />

        {/* Bloqueio do sistema completo */}
        {!canSystem && systemBlockReasons && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-medium">Simulação de sistema bloqueada</p>
              <p className="mt-0.5 opacity-80">{systemBlockReasons.message}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  item,
  onRun,
  running,
}: {
  item: ReadinessItem;
  onRun?: () => void;
  running?: boolean;
}) {
  return (
    <li className="flex items-start gap-2 rounded border bg-muted/30 p-2.5 text-xs">
      <span
        className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", STATUS_STYLES[item.status])}
        aria-label={STATUS_LABELS[item.status]}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-foreground">{item.label}</span>
          {onRun && item.status !== "blocked" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={onRun}
              disabled={!!running}
            >
              {running ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : item.status === "ok" ? (
                "Re-rodar"
              ) : (
                "Simular"
              )}
            </Button>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.message}</p>
        {item.missing && item.missing.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            Faltam: {item.missing.join(", ")}
          </p>
        )}
      </div>
    </li>
  );
}

// ============================================================================
// Painel consolidado catálogo vs calculado
// ============================================================================

interface SimRow {
  id: string;
  coil_type: string | null;
  inputs: unknown;
  outputs: unknown;
  created_at: string;
}

function pickLatest(sims: SimRow[], typeAliases: string[]): SimRow | null {
  for (const s of sims) {
    if (s.coil_type && typeAliases.includes(s.coil_type)) return s;
  }
  return null;
}

function getCalcCapW(sim: SimRow | null): number | null {
  if (!sim) return null;
  const out = (sim.outputs ?? {}) as { capacityW?: number };
  return typeof out.capacityW === "number" ? out.capacityW : null;
}

function getCatalogCapW(sim: SimRow | null): number | null {
  if (!sim) return null;
  const inp = (sim.inputs ?? {}) as { nominal?: { capacityW?: number } };
  return typeof inp.nominal?.capacityW === "number" ? inp.nominal!.capacityW! : null;
}

function fmtW(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)} kW`;
  return `${v.toFixed(0)} W`;
}

function ConsolidatedPanel({
  equipmentProjectId: _eq,
  sims,
}: {
  equipmentProjectId: string;
  sims: SimRow[];
}) {
  const evapSim = useMemo(
    () => pickLatest(sims, ["evaporator", "evaporador"]),
    [sims],
  );
  const condSim = useMemo(
    () => pickLatest(sims, ["condenser", "condensador"]),
    [sims],
  );

  if (!evapSim && !condSim) return null;

  const blocks = [
    { label: "Evaporador", sim: evapSim, what: "capacidade" },
    { label: "Condensador", sim: condSim, what: "rejeição de calor" },
  ];

  const anyHighError = blocks.some(({ sim }) => {
    const calc = getCalcCapW(sim);
    const cat = getCatalogCapW(sim);
    if (calc == null || cat == null || cat === 0) return false;
    return Math.abs((calc - cat) / cat) * 100 > 10;
  });

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Resultado consolidado
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {blocks.map(({ label, sim, what }) => {
          const calc = getCalcCapW(sim);
          const cat = getCatalogCapW(sim);
          const errPct =
            calc != null && cat != null && cat !== 0
              ? ((calc - cat) / cat) * 100
              : null;
          const errClass =
            errPct == null
              ? "text-muted-foreground"
              : Math.abs(errPct) > 10
                ? "text-destructive"
                : Math.abs(errPct) > 5
                  ? "text-amber-600"
                  : "text-emerald-600";
          return (
            <div key={label} className="rounded border bg-card p-3 text-xs">
              <p className="font-medium">{label}</p>
              {!sim ? (
                <p className="mt-1 text-muted-foreground">Sem simulação ainda.</p>
              ) : (
                <dl className="mt-1.5 grid grid-cols-3 gap-2">
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
              <p className="mt-1 text-[10px] text-muted-foreground">
                Compara {what} do catálogo CN com o solver térmico.
              </p>
            </div>
          );
        })}
      </div>
      {anyHighError && (
        <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold">Divergência relevante</span> entre cálculo e
            catálogo (&gt; 10%). Reveja a geometria, fatores Unilab ou ponto nominal.
          </span>
        </div>
      )}
    </div>
  );
}

// Helper Badge import unused — keep API surface
export type { ReadinessItem };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _Badge = Badge;
