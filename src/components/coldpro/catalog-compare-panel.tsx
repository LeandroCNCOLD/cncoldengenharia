/**
 * Painel de comparação Catálogo × Simulação dentro da tela do equipamento.
 *
 * - Busca curvas do catálogo CN COLD pelo commercial_name do equipamento.
 * - Lista curvas (refrigerante × índice) e permite escolher um ponto.
 * - Mostra gráfico (recharts) com curva catálogo vs. simulada.
 * - Mostra erro % por grandeza e fatores de correção sugeridos.
 * - Botão "Salvar como calibração" persiste em coil_calibrations (draft).
 *
 * Observação: a simulação NÃO é feita aqui — usamos o último resultado
 * persistido em coil_simulations / equipment_simulations quando disponível.
 * Caso contrário, mostra alerta para rodar a simulação primeiro.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, LineChart as LineChartIcon, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { getEquipmentProject } from "@/lib/coldpro/equipment-projects";
import { getPerformanceCurvesByModel, type CatalogCurve } from "@/lib/coldpro/catalog-curves";
import {
  calibrateFromCatalogCurve,
  extractPointsFromCurve,
  type SimulatedSnapshot,
} from "@/lib/coldpro/catalog-calibration";

interface Props {
  equipmentProjectId: string;
}

export function CatalogComparePanel({ equipmentProjectId }: Props) {
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["equipment-project", equipmentProjectId],
    queryFn: () => getEquipmentProject(equipmentProjectId),
  });

  const matchKey = project?.commercial_name?.trim() ?? "";

  const { data: curves, isLoading: loadingCurves } = useQuery({
    queryKey: ["catalog-curves-by-model", matchKey],
    queryFn: () => getPerformanceCurvesByModel(matchKey),
    enabled: !!matchKey,
  });

  // Última simulação registrada (system tem prioridade; depois coil)
  const { data: lastSim } = useQuery({
    queryKey: ["equip-last-sim", equipmentProjectId],
    queryFn: async () => {
      const { data: eq } = await supabase
        .from("equipment_simulations")
        .select("outputs, created_at")
        .eq("equipment_project_id", equipmentProjectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (eq) return eq.outputs as Record<string, unknown>;

      const { data: coil } = await supabase
        .from("coil_simulations")
        .select("outputs, created_at")
        .eq("equipment_project_id", equipmentProjectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (coil?.outputs ?? null) as Record<string, unknown> | null;
    },
  });

  const [selectedCurveId, setSelectedCurveId] = useState<string | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const selectedCurve: CatalogCurve | null = useMemo(() => {
    if (!curves || curves.length === 0) return null;
    return curves.find((c) => c.id === selectedCurveId) ?? curves[0];
  }, [curves, selectedCurveId]);

  const points = useMemo(
    () => (selectedCurve ? extractPointsFromCurve(selectedCurve) : []),
    [selectedCurve],
  );
  const selectedPoint = points[selectedPointIdx] ?? points[0];

  const simulatedSnapshot: SimulatedSnapshot = useMemo(() => {
    const out = (lastSim ?? {}) as Record<string, unknown>;
    const num = (k: string) => {
      const v = out[k];
      const n = typeof v === "number" ? v : Number(v as string);
      return Number.isFinite(n) ? n : null;
    };
    return {
      capacity_w: num("capacity_w") ?? num("q_total") ?? num("qtot_w"),
      power_w: num("power_w") ?? num("input_power"),
      mass_flow_kgh: num("mass_flow_kgh") ?? num("massflow"),
      p_evap_bar: num("p_evap_bar") ?? num("suction_bar"),
      p_cond_bar: num("p_cond_bar") ?? num("discharge_bar"),
    };
  }, [lastSim]);

  const calibration = useMemo(() => {
    if (!selectedPoint) return null;
    return calibrateFromCatalogCurve(simulatedSnapshot, selectedPoint);
  }, [simulatedSnapshot, selectedPoint]);

  const chartData = useMemo(() => {
    if (!calibration) return [];
    return calibration.metrics
      .filter((m) => m.catalog != null || m.simulated != null)
      .map((m) => ({
        name: m.label,
        Catálogo: m.catalog ?? 0,
        Simulado: m.simulated ?? 0,
      }));
  }, [calibration]);

  async function handleSaveCalibration() {
    if (!calibration || !selectedCurve) return;
    setSaving(true);
    try {
      // Procura um component_item de evaporador associado ao equipamento
      // (calibração precisa de component_item_id NOT NULL).
      const { data: items } = await supabase
        .from("component_items")
        .select("id, kind")
        .eq("equipment_project_id", equipmentProjectId)
        .limit(10);
      const target = items?.find((i) => i.kind === "evaporador") ?? items?.[0];
      if (!target) {
        toast.error("Crie ao menos um componente no equipamento antes de salvar a calibração.");
        return;
      }

      const { error } = await supabase.from("coil_calibrations").insert({
        component_item_id: target.id,
        coil_type: target.kind === "condensador" ? "condenser" : "evaporator",
        engine: "physical_simple",
        engine_name: "physical_simple",
        capacity_correction_factor: calibration.factors.capacityCorrectionFactor,
        heat_transfer_factor: calibration.factors.capacityCorrectionFactor,
        air_dp_correction_factor: 1,
        ref_dp_correction_factor: 1,
        ua_correction_factor: 1,
        confidence_score: calibration.divergent ? 0.4 : 0.75,
        status: "draft",
        calibration_name: `Catálogo · ${selectedCurve.modelo} · ${selectedCurve.refrigerante ?? "—"} #${selectedCurve.curva_indice ?? "?"}`,
        reference_source: `cn_catalog_performance_curves:${selectedCurve.id}`,
        reference_json: selectedPoint as Record<string, unknown>,
        result_before_json: simulatedSnapshot as Record<string, unknown>,
        deviation_before: { metrics: calibration.metrics, avgErrorPct: calibration.averageErrorPct },
        meets_targets: !calibration.divergent,
        notes: `Erro médio: ${calibration.averageErrorPct?.toFixed(2) ?? "—"}%`,
      } as never);

      if (error) throw error;
      toast.success("Calibração salva como rascunho.");
      queryClient.invalidateQueries({ queryKey: ["coil-calibrations"] });
    } catch (err) {
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------- UI --------------------------- */

  if (!matchKey) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sem nome comercial</AlertTitle>
        <AlertDescription>
          Defina o nome comercial do equipamento para localizar curvas no catálogo CN COLD.
        </AlertDescription>
      </Alert>
    );
  }

  if (loadingCurves) {
    return <p className="text-sm text-muted-foreground">Buscando curvas do catálogo…</p>;
  }

  if (!curves || curves.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Nenhuma curva encontrada</AlertTitle>
        <AlertDescription>
          O catálogo CN COLD não possui curvas para o modelo "{matchKey}". Verifique o nome
          comercial ou importe o catálogo na tela Banco Técnico.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            <LineChartIcon className="mr-2 inline h-4 w-4" />
            Validação contra catálogo CN COLD
          </CardTitle>
          <Badge variant="outline">{curves.length} curva(s) encontrada(s)</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Curva</p>
              <Select
                value={selectedCurve?.id}
                onValueChange={(v) => {
                  setSelectedCurveId(v);
                  setSelectedPointIdx(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {curves.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.refrigerante ?? "—"} · #{c.curva_indice ?? "?"} · {c.total_pontos ?? "?"} pts
                      {c.origem ? ` (${c.origem})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Ponto</p>
              <Select
                value={String(selectedPointIdx)}
                onValueChange={(v) => setSelectedPointIdx(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {points.length === 0 ? (
                    <SelectItem value="0" disabled>
                      Nenhum ponto na curva
                    </SelectItem>
                  ) : (
                    points.map((_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        Ponto {i + 1}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!lastSim && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sem simulação registrada</AlertTitle>
              <AlertDescription>
                Rode uma simulação na aba "Sistema completo" ou no Coil Simulator para comparar
                com o catálogo.
              </AlertDescription>
            </Alert>
          )}

          {calibration && calibration.divergent && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Modelo divergente do catálogo</AlertTitle>
              <AlertDescription>
                Erro médio {calibration.averageErrorPct?.toFixed(1)}% (limite 10%).
              </AlertDescription>
            </Alert>
          )}

          {calibration && !calibration.divergent && calibration.averageErrorPct != null && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Dentro da tolerância</AlertTitle>
              <AlertDescription>
                Erro médio {calibration.averageErrorPct.toFixed(1)}%.
              </AlertDescription>
            </Alert>
          )}

          {chartData.length > 0 && (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Catálogo" fill="hsl(var(--primary))" />
                  <Bar dataKey="Simulado" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {calibration && (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="p-2 text-left">Grandeza</th>
                    <th className="p-2 text-right">Catálogo</th>
                    <th className="p-2 text-right">Simulado</th>
                    <th className="p-2 text-right">Erro %</th>
                    <th className="p-2 text-right">Fator correção</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.metrics.map((m) => (
                    <tr key={m.key} className="border-t">
                      <td className="p-2">{m.label}</td>
                      <td className="p-2 text-right">{m.catalog?.toFixed(2) ?? "—"}</td>
                      <td className="p-2 text-right">{m.simulated?.toFixed(2) ?? "—"}</td>
                      <td
                        className={`p-2 text-right ${
                          m.errorPct != null && Math.abs(m.errorPct) > 10
                            ? "text-destructive"
                            : ""
                        }`}
                      >
                        {m.errorPct != null ? `${m.errorPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {m.correctionFactor != null ? m.correctionFactor.toFixed(3) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveCalibration}
              disabled={!calibration || saving || !lastSim}
              size="sm"
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Salvando…" : "Salvar como calibração"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
