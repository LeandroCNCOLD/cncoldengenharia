import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAuth } from "@/lib/auth";
import {
  factorsFromRow,
  getActiveCalibrationForComponent,
} from "@/lib/coldpro/coil-calibrations";
import {
  listPerformanceMaps,
  savePerformanceMap,
  updatePerformanceMapStatus,
} from "@/lib/coldpro/coil-performance-maps";
import {
  DEFAULT_RANGES_COND,
  DEFAULT_RANGES_EVAP,
  approvalBlockReason,
  canApproveMap,
  generateCoilPerformanceMap,
  performanceMapToCsv,
  type PerformanceEngine,
  type PerformanceMapResult,
  type PerformanceRanges,
} from "@/modules/coldpro/coil/performanceMapGenerator";
import type { CoilSimulatorInput } from "@/modules/coldpro/coil/coilSimulatorTypes";
import { findGeometryFactor } from "@/modules/coldpro/unilabData/unilabGeometryFactorRepository";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  componentItemId: string;
  equipmentProjectId?: string | null;
  coilType: "evaporator" | "condenser";
  simulationInput: CoilSimulatorInput | null;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function statusBadge(s: string | undefined | null) {
  if (s === "approved")
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovado
      </Badge>
    );
  if (s === "archived") return <Badge variant="outline">Arquivado</Badge>;
  if (s === "generated") return <Badge variant="secondary">Gerado</Badge>;
  return <Badge variant="outline">Rascunho</Badge>;
}

function pointBadge(s: string) {
  if (s === "valid")
    return <span className="text-emerald-600">●</span>;
  if (s === "warning")
    return <span className="text-amber-600">●</span>;
  return <span className="text-destructive">●</span>;
}

export function PerformanceMapPanel({
  componentItemId,
  equipmentProjectId,
  coilType,
  simulationInput,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [engine, setEngine] = useState<PerformanceEngine>("hybrid");
  const defaults =
    coilType === "evaporator" ? DEFAULT_RANGES_EVAP : DEFAULT_RANGES_COND;
  const [ranges, setRanges] = useState<PerformanceRanges>(defaults);
  const [mapName, setMapName] = useState("");
  const [hideInvalid, setHideInvalid] = useState(false);
  const [allowEstimated, setAllowEstimated] = useState(false);
  const [result, setResult] = useState<PerformanceMapResult | null>(null);

  const { data: calibration, isLoading: calibrationLoading } = useQuery({
    queryKey: ["coil-cal-active", componentItemId],
    queryFn: () => getActiveCalibrationForComponent(componentItemId),
    enabled: !!componentItemId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["coil-perf-maps", componentItemId],
    queryFn: () => listPerformanceMaps(componentItemId),
    enabled: !!componentItemId,
  });

  // Lookup do fator real Unilab pela descrição da geometria do componente
  const geometryDescription = simulationInput?.geometry.description?.trim() || null;
  const { data: unilabFactor = null } = useQuery({
    queryKey: ["coil-unilab-factor", coilType, geometryDescription],
    queryFn: () =>
      findGeometryFactor(supabase, {
        mode: coilType === "evaporator" ? "direct_expansion" : "condensing",
        description: geometryDescription ?? undefined,
      }),
    enabled: !!geometryDescription,
  });

  const calRow = calibration as
    | { id: string; confidence_score?: number; status?: string; model_signature?: string | null }
    | null;
  const hasCalibration = !!calRow;

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!simulationInput) throw new Error("Sem entrada de simulação.");
      if (calibrationLoading) throw new Error("Aguarde carregar a calibração ativa.");
      if (!hasCalibration && !allowEstimated) {
        throw new Error(
          "Sem calibração ativa. Marque 'mapa estimado' para gerar mesmo assim.",
        );
      }
      const calFactors = hasCalibration
        ? factorsFromRow(
            calibration as unknown as Parameters<typeof factorsFromRow>[0],
          )
        : null;
      const calConf = Number(calRow?.confidence_score ?? 0.6);
      const r = generateCoilPerformanceMap({
        input: simulationInput,
        coilType,
        engine,
        calibration: calFactors,
        calibrationConfidence: calConf,
        ranges,
        unilabGeometryFactor: unilabFactor,
        componentItemId,
        calibrationId: calRow?.id ?? null,
        calibrationSignature: calRow?.model_signature ?? null,
      });
      setResult(r);
      if (r.blocked) {
        toast.error(r.blockReason ?? "Mapa bloqueado pelo guard rail nominal.");
      } else if (!r.nominalValidation.reproducesNominal) {
        toast.warning(r.nominalValidation.message);
      }
      return r;
    },
    onSuccess: (r) => {
      if (r.blocked) {
        toast.error("Mapa não foi gerado: ponto nominal fora da faixa.");
      } else {
        toast.success(
          `Mapa gerado: ${r.points.length} pontos · ${r.summary.validCount} válidos`,
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Gere o mapa antes de salvar.");
      if (result.blocked) throw new Error(result.blockReason ?? "Mapa bloqueado.");
      return savePerformanceMap({
        componentItemId,
        equipmentProjectId: equipmentProjectId ?? null,
        coilType,
        engine,
        calibrationId: calRow?.id ?? null,
        mapName: mapName || null,
        result,
        userId: user?.id,
      });
    },
    onSuccess: () => {
      toast.success("Mapa salvo no histórico.");
      qc.invalidateQueries({ queryKey: ["coil-perf-maps", componentItemId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => updatePerformanceMapStatus(id, "approved"),
    onSuccess: () => {
      toast.success("Mapa aprovado.");
      qc.invalidateQueries({ queryKey: ["coil-perf-maps", componentItemId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: async (id: string) => updatePerformanceMapStatus(id, "archived"),
    onSuccess: () => {
      toast.success("Mapa arquivado.");
      qc.invalidateQueries({ queryKey: ["coil-perf-maps", componentItemId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visiblePoints = useMemo(() => {
    if (!result) return [];
    return hideInvalid
      ? result.points.filter((p) => p.status !== "invalid")
      : result.points;
  }, [result, hideInvalid]);

  // Charts: collapse to mid-airflow-factor & mid-air-temp slices
  const chartCapacityVsRefT = useMemo(() => {
    if (!result) return [];
    const ffMid = result.ranges.airflowFactor.min;
    const airMid =
      (result.ranges.airInletTempC.min + result.ranges.airInletTempC.max) / 2;
    return result.points
      .filter(
        (p) =>
          Math.abs(p.airflowFactor - ffMid) < 1e-6 &&
          Math.abs(p.airInletTempC - airMid) < result.ranges.airInletTempC.step / 2,
      )
      .map((p) => ({ x: p.refTempC, capacityW: p.capacityW }));
  }, [result]);

  const chartCapacityVsFlow = useMemo(() => {
    if (!result) return [];
    const refMid =
      (result.ranges.refTempC.min + result.ranges.refTempC.max) / 2;
    const airMid =
      (result.ranges.airInletTempC.min + result.ranges.airInletTempC.max) / 2;
    return result.points
      .filter(
        (p) =>
          Math.abs(p.refTempC - refMid) < result.ranges.refTempC.step / 2 &&
          Math.abs(p.airInletTempC - airMid) < result.ranges.airInletTempC.step / 2,
      )
      .map((p) => ({
        x: Number(p.airflowFactor.toFixed(2)),
        capacityW: p.capacityW,
        airDpPa: p.airPressureDropPa ?? 0,
      }));
  }, [result]);

  const canGenerate = !!simulationInput && !calibrationLoading && (hasCalibration || allowEstimated);
  const summary = result?.summary;
  const approvable = summary
    ? canApproveMap(summary, result?.nominalValidation, result ?? undefined)
    : false;
  const blockReasonText = summary
    ? approvalBlockReason(summary, result?.nominalValidation, result ?? undefined)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Mapa de desempenho
          </span>
          <span className="flex items-center gap-2 text-xs">
            {engine === "hybrid" && (
              <Badge variant="outline" className="border-sky-500 text-sky-600">
                Híbrido
              </Badge>
            )}
            {hasCalibration ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <ShieldCheck className="mr-1 h-3 w-3" /> Calibrado
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                <AlertTriangle className="mr-1 h-3 w-3" /> Estimado
              </Badge>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config: ranges */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <RangeField
            label={
              coilType === "evaporator"
                ? "Tevap (°C)"
                : "Tcond (°C)"
            }
            value={ranges.refTempC}
            onChange={(v) => setRanges({ ...ranges, refTempC: v })}
          />
          <RangeField
            label="T ar entrada (°C)"
            value={ranges.airInletTempC}
            onChange={(v) => setRanges({ ...ranges, airInletTempC: v })}
          />
          <RangeField
            label="Fator de vazão"
            value={ranges.airflowFactor}
            onChange={(v) => setRanges({ ...ranges, airflowFactor: v })}
            stepHint={0.1}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Motor</Label>
            <select
              className="block h-9 rounded-md border bg-background px-2 text-sm"
              value={engine}
              onChange={(e) => setEngine(e.target.value as PerformanceEngine)}
            >
              <option value="hybrid">Híbrido (Unilab + correlações)</option>
              <option value="physical_simple">Físico simples</option>
              <option value="empirical">Empírico</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Nome do mapa</Label>
            <Input
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="ex.: faixa nominal Unilab"
              className="h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="allowEst"
              checked={allowEstimated}
              onCheckedChange={setAllowEstimated}
              disabled={hasCalibration}
            />
            <Label htmlFor="allowEst" className="text-xs">
              Permitir mapa estimado
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => generateMut.mutate()}
            disabled={!canGenerate || generateMut.isPending}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Gerar curva
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => saveMut.mutate()}
            disabled={!result || saveMut.isPending}
          >
            Salvar mapa
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              result &&
              downloadFile(
                `coil-map-${coilType}-${Date.now()}.csv`,
                performanceMapToCsv(result),
                "text/csv",
              )
            }
            disabled={!result}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              result &&
              downloadFile(
                `coil-map-${coilType}-${Date.now()}.json`,
                JSON.stringify(result, null, 2),
                "application/json",
              )
            }
            disabled={!result}
          >
            <Download className="mr-2 h-4 w-4" /> JSON
          </Button>
        </div>

        {!simulationInput && (
          <p className="text-xs text-muted-foreground">
            Importe o datasheet para habilitar a geração.
          </p>
        )}

        {/* Summary + filters */}
        {result && summary && (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm md:grid-cols-5">
              <Stat label="Pontos" value={String(summary.totalPoints)} />
              <Stat label="Válidos" value={String(summary.validCount)} tone="ok" />
              <Stat
                label="Avisos"
                value={String(summary.warningCount)}
                tone="warn"
              />
              <Stat
                label="Inválidos"
                value={String(summary.invalidCount)}
                tone="bad"
              />
              <div>
                <div className="text-xs text-muted-foreground">Confiança média</div>
                <Progress
                  className="mt-1"
                  value={summary.avgConfidence * 100}
                />
                <div className="mt-1 text-xs">
                  {(summary.avgConfidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ChartCard
                title={`Capacidade vs ${coilType === "evaporator" ? "Tevap" : "Tcond"}`}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartCapacityVsRefT}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="capacityW"
                      stroke="hsl(var(--primary))"
                      dot={false}
                      name="Q (W)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Capacidade & ΔP ar vs vazão">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartCapacityVsFlow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                    />
                    <RTooltip />
                    <Legend />
                    <Line
                      yAxisId="l"
                      type="monotone"
                      dataKey="capacityW"
                      stroke="hsl(var(--primary))"
                      dot={false}
                      name="Q (W)"
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="airDpPa"
                      stroke="#f59e0b"
                      dot={false}
                      name="ΔP ar (Pa)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Filter + table */}
            <div className="flex items-center gap-2">
              <Switch
                id="hideInv"
                checked={hideInvalid}
                onCheckedChange={setHideInvalid}
              />
              <Label htmlFor="hideInv" className="text-xs">
                Ocultar pontos inválidos
              </Label>
            </div>

            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6"></TableHead>
                    <TableHead>Tref</TableHead>
                    <TableHead>Tar</TableHead>
                    <TableHead>FF</TableHead>
                    <TableHead className="text-right">Q (W)</TableHead>
                    <TableHead className="text-right">kcal/h</TableHead>
                    <TableHead className="text-right">ΔP ar</TableHead>
                    <TableHead className="text-right">ΔP ref</TableHead>
                    <TableHead className="text-right">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePoints.slice(0, 300).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{pointBadge(p.status)}</TableCell>
                      <TableCell className="text-xs">{p.refTempC}</TableCell>
                      <TableCell className="text-xs">{p.airInletTempC}</TableCell>
                      <TableCell className="text-xs">
                        {p.airflowFactor.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {p.capacityW.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {p.capacityKcalh.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {p.airPressureDropPa != null
                          ? p.airPressureDropPa.toFixed(0)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {p.refrigerantPressureDropKpa != null
                          ? p.refrigerantPressureDropKpa.toFixed(1)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {(p.confidenceScore * 100).toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {visiblePoints.length > 300 && (
                <div className="border-t p-2 text-center text-xs text-muted-foreground">
                  Mostrando 300 de {visiblePoints.length} pontos. Exporte o CSV
                  para ver tudo.
                </div>
              )}
            </div>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <History className="h-3 w-3" /> Histórico
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Conf.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const row = h as unknown as {
                    id: string;
                    created_at: string;
                    map_name?: string | null;
                    status?: string;
                    is_estimated?: boolean;
                    confidence_score?: number;
                    summary_json?: { invalidCount?: number; totalPoints?: number };
                  };
                  const sum = row.summary_json ?? { invalidCount: 0, totalPoints: 1 };
                  const nv = (row.summary_json as { nominalValidation?: { reproducesNominal?: boolean } } | undefined)
                    ?.nominalValidation;
                  const reproOk = nv?.reproducesNominal !== false;
                  const ratioOk =
                    (sum.invalidCount ?? 0) /
                      Math.max(sum.totalPoints ?? 1, 1) <=
                    0.3;
                  const canApprove = ratioOk && reproOk;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">
                        {format(new Date(row.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.map_name ?? "—"}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-xs">
                        {row.is_estimated ? "Estimado" : "Calibrado"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {((Number(row.confidence_score) || 0) * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status !== "approved" && row.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canApprove || approveMut.isPending}
                            onClick={() => approveMut.mutate(row.id)}
                            title={
                              !reproOk
                                ? "Mapa não reproduz o ponto nominal Unilab — recalibre antes de aprovar."
                                : ratioOk
                                  ? "Aprovar mapa"
                                  : "Mais de 30% inválidos — não aprovável"
                            }
                          >
                            Aprovar
                          </Button>
                        )}
                        {row.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveMut.mutate(row.id)}
                          >
                            Arquivar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {result && !result.nominalValidation.reproducesNominal && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            <strong>Validação do ponto nominal falhou.</strong>{" "}
            {result.nominalValidation.message}
            {result.nominalValidation.relativeError != null && (
              <div className="mt-1 text-[11px] opacity-80">
                Datasheet:{" "}
                {result.nominalValidation.capacityDatasheetW?.toFixed(0)} W ·
                Simulado:{" "}
                {result.nominalValidation.capacitySimulatedW.toFixed(0)} W ·
                Erro:{" "}
                {(result.nominalValidation.relativeError * 100).toFixed(2)}%
              </div>
            )}
            <div className="mt-1 text-[11px] opacity-80">
              Recalibre o componente contra o datasheet Unilab antes de aprovar
              este mapa.
            </div>
          </div>
        )}

        {result && summary && !approvable && result.nominalValidation.reproducesNominal && (
          <p className="text-xs text-amber-600">
            Mais de 30% dos pontos estão inválidos — este mapa não pode ser
            aprovado. Ajuste as faixas e gere novamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RangeField({
  label,
  value,
  onChange,
  stepHint,
}: {
  label: string;
  value: { min: number; max: number; step: number };
  onChange: (v: { min: number; max: number; step: number }) => void;
  stepHint?: number;
}) {
  return (
    <div className="rounded-md border p-2">
      <div className="mb-1 text-xs font-medium">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        <NumField
          label="min"
          value={value.min}
          onChange={(n) => onChange({ ...value, min: n })}
        />
        <NumField
          label="max"
          value={value.max}
          onChange={(n) => onChange({ ...value, max: n })}
        />
        <NumField
          label="passo"
          value={value.step}
          step={stepHint ?? 1}
          onChange={(n) => onChange({ ...value, step: n })}
        />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-xs"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-destructive"
          : "";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-2">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
