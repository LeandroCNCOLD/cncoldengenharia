import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CyclePHDiagram } from "@/modules/cn_coils/components/CyclePHDiagram";
import { CheckCircle2, AlertTriangle, XCircle, FileDown, Save, RotateCcw } from "lucide-react";
import type { CycleResult } from "@/modules/cn_coils/engines/cycle/cycleTypes";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

const KCALH_TO_W = 1.163;
const W_TO_KCALH = 1 / KCALH_TO_W;

type Status = "ok" | "warn" | "crit" | "na";

function fmt(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function deviation(motor: number, catalog: number): number | null {
  if (!Number.isFinite(motor) || !Number.isFinite(catalog) || catalog === 0) return null;
  return ((motor - catalog) / catalog) * 100;
}

function classifyPct(devPct: number | null): Status {
  if (devPct === null) return "na";
  const a = Math.abs(devPct);
  if (a <= 5) return "ok";
  if (a <= 15) return "warn";
  return "crit";
}

function classifyDeltaC(deltaC: number | null): Status {
  if (deltaC === null) return "na";
  const a = Math.abs(deltaC);
  if (a <= 2) return "ok";
  if (a <= 5) return "warn";
  return "crit";
}

const STATUS_COLORS: Record<Status, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  crit: "text-red-600 dark:text-red-400",
  na: "text-muted-foreground",
};

interface MetricRow {
  label: string;
  catalog: string;
  motor: string;
  status: Status;
  devLabel: string;
}

interface Props {
  equipment: CatalogEquipmentRow | null;
  result: CycleResult | null;
  refrigerantId: string;
  isRunning: boolean;
  hasSimulated: boolean;
  onReset: () => void;
}

export function CatalogComparisonPanel({
  equipment,
  result,
  refrigerantId,
  isRunning,
  hasSimulated,
  onReset,
}: Props) {
  const metrics = useMemo<MetricRow[]>(() => {
    if (!equipment || !result) return [];

    const catQ_kcalh = equipment.capacidadeFrigorificaKcalH ?? null;
    const catW_kw =
      equipment.potenciaCompressorKw ?? equipment.potenciaEletricaKw ?? null;
    const catCop = equipment.cop ?? null;
    const catTe = equipment.tempEvaporacaoC ?? null;
    const catTc = equipment.tempCondensacaoC ?? null;

    const motorQ_W = result.Q_evap_W;
    const motorQ_kcalh = motorQ_W * W_TO_KCALH;
    const motorW_kw = result.W_comp_W / 1000;
    const motorCop = result.COP;
    const motorTe = result.Te_C;
    const motorTc = result.Tc_C;

    const devQ = catQ_kcalh ? deviation(motorQ_kcalh, catQ_kcalh) : null;
    const devW = catW_kw ? deviation(motorW_kw, catW_kw) : null;
    const devCop = catCop ? deviation(motorCop, catCop) : null;
    const devTe = catTe !== null ? motorTe - catTe : null;
    const devTc = catTc !== null ? motorTc - catTc : null;

    return [
      {
        label: "Capacidade (Q)",
        catalog: catQ_kcalh
          ? `${fmt(catQ_kcalh, 0)} kcal/h\n(${fmt(catQ_kcalh * KCALH_TO_W / 1000, 2)} kW)`
          : "—",
        motor: `${fmt(motorQ_kcalh, 0)} kcal/h\n(${fmt(motorQ_W / 1000, 2)} kW)`,
        status: classifyPct(devQ),
        devLabel: devQ === null ? "—" : pct(devQ),
      },
      {
        label: "Potência compressor",
        catalog: catW_kw ? `${fmt(catW_kw, 2)} kW` : "—",
        motor: `${fmt(motorW_kw, 2)} kW`,
        status: classifyPct(devW),
        devLabel: devW === null ? "—" : pct(devW),
      },
      {
        label: "COP",
        catalog: catCop ? fmt(catCop, 2) : "—",
        motor: fmt(motorCop, 2),
        status: classifyPct(devCop),
        devLabel: devCop === null ? "—" : pct(devCop),
      },
      {
        label: "Temp. evaporação (Te)",
        catalog: catTe !== null ? `${fmt(catTe, 1)} °C` : "—",
        motor: `${fmt(motorTe, 1)} °C`,
        status: classifyDeltaC(devTe),
        devLabel:
          devTe === null
            ? "—"
            : `${devTe > 0 ? "+" : ""}${fmt(devTe, 1)} °C`,
      },
      {
        label: "Temp. condensação (Tc)",
        catalog: catTc !== null ? `${fmt(catTc, 1)} °C` : "—",
        motor: `${fmt(motorTc, 1)} °C`,
        status: classifyDeltaC(devTc),
        devLabel:
          devTc === null
            ? "—"
            : `${devTc > 0 ? "+" : ""}${fmt(devTc, 1)} °C`,
      },
    ];
  }, [equipment, result]);

  const overall: Status = useMemo(() => {
    const statuses = metrics.map((m) => m.status).filter((s) => s !== "na");
    if (statuses.includes("crit")) return "crit";
    if (statuses.includes("warn")) return "warn";
    if (statuses.length === 0) return "na";
    return "ok";
  }, [metrics]);

  if (!equipment) {
    return (
      <Card className="h-full border-dashed">
        <CardContent className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
          A comparação aparecerá aqui após selecionar um equipamento.
        </CardContent>
      </Card>
    );
  }

  if (isRunning) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Comparando…</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!hasSimulated || !result) {
    return (
      <Card className="h-full border-dashed">
        <CardContent className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
          Clique em <strong className="mx-1">Simular</strong> para ver a
          comparação.
        </CardContent>
      </Card>
    );
  }

  const overallBadge =
    overall === "ok"
      ? { icon: <CheckCircle2 className="h-4 w-4" />, label: "Equipamento Validado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" }
      : overall === "warn"
        ? { icon: <AlertTriangle className="h-4 w-4" />, label: "Atenção — Revisar", cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300" }
        : overall === "crit"
          ? { icon: <XCircle className="h-4 w-4" />, label: "Inconsistência Detectada", cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300" }
          : { icon: null, label: "Sem dados de catálogo suficientes", cls: "bg-muted text-muted-foreground border-border" };

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Motor V2 vs Catálogo</CardTitle>
        </div>
        <Badge
          className={`flex w-fit items-center gap-1.5 border ${overallBadge.cls}`}
          variant="outline"
        >
          {overallBadge.icon}
          {overallBadge.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-md border p-2"
            >
              <p className="mb-1.5 text-xs font-semibold text-foreground">
                {m.label}
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-muted/40 p-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Catálogo</p>
                  <p className="whitespace-pre-line font-mono">{m.catalog}</p>
                </div>
                <div className="rounded bg-muted/40 p-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Motor V2</p>
                  <p className="whitespace-pre-line font-mono">{m.motor}</p>
                </div>
                <div className="rounded bg-muted/40 p-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Desvio</p>
                  <p className={`font-mono font-semibold ${STATUS_COLORS[m.status]}`}>
                    {m.devLabel}
                    {m.status === "ok" && " ✓"}
                    {m.status === "warn" && " ⚠"}
                    {m.status === "crit" && " ✗"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-background p-2">
          <p className="mb-1 text-[10px] uppercase text-muted-foreground">
            Diagrama P-h
          </p>
          <div className="overflow-x-auto">
            <CyclePHDiagram
              result={result}
              refrigerantId={refrigerantId}
              width={340}
              height={220}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => exportReport(equipment, result, metrics, overallBadge.label)}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={() => saveValidation(equipment, result, metrics, overallBadge.label)}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Nova condição
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function exportReport(
  equipment: CatalogEquipmentRow,
  result: CycleResult,
  metrics: MetricRow[],
  overall: string,
) {
  const lines = [
    `RELATÓRIO DE VALIDAÇÃO — ${equipment.modelo}`,
    `Data: ${new Date().toLocaleString("pt-BR")}`,
    `Compressor: ${equipment.compressorModelo ?? "—"}`,
    `Refrigerante: ${equipment.refrigerante}`,
    `Status: ${overall}`,
    "",
    "MÉTRICAS:",
    ...metrics.map(
      (m) =>
        `  ${m.label}\n    Catálogo: ${m.catalog.replace(/\n/g, " ")}\n    Motor V2: ${m.motor.replace(/\n/g, " ")}\n    Desvio: ${m.devLabel}`,
    ),
    "",
    `Iterações: ${result.iterations} · Convergiu: ${result.converged ? "Sim" : "Não"}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `validacao_${equipment.modelo}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function saveValidation(
  equipment: CatalogEquipmentRow,
  result: CycleResult,
  metrics: MetricRow[],
  overall: string,
) {
  try {
    const key = "coldpro:catalog-validations";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    const entry = {
      at: new Date().toISOString(),
      equipmentId: equipment.id,
      modelo: equipment.modelo,
      overall,
      Te_C: result.Te_C,
      Tc_C: result.Tc_C,
      Q_evap_W: result.Q_evap_W,
      W_comp_W: result.W_comp_W,
      COP: result.COP,
      metrics: metrics.map((m) => ({
        label: m.label,
        status: m.status,
        dev: m.devLabel,
      })),
    };
    localStorage.setItem(key, JSON.stringify([entry, ...prev].slice(0, 100)));
    alert("Validação salva no histórico local.");
  } catch (err) {
    alert(`Falha ao salvar: ${err instanceof Error ? err.message : "erro"}`);
  }
}
