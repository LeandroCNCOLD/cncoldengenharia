/**
 * AutoOptimizationTabContent — Otimização Automática
 *
 * Encontra o melhor ponto de equilíbrio do sistema e sugere ajustes:
 * - Melhor Te, Tc, superaquecimento, subresfriamento
 * - Melhor vazão de ar do evaporador e condensador
 * - Melhor combinação ventilador × coil
 * - Alternativas de compressor e válvula
 *
 * Usa o testHubEngine para calcular e o store para persistir resultados.
 *
 * Referências:
 * - ASHRAE Handbook Refrigeration 2022, Cap. 2 — System Analysis
 * - Domanski, P.A. (1999) — Theoretical Evaluation of the Vapor Compression Cycle
 * - AHRI Standard 540 (2020)
 */
import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2, AlertCircle, TrendingUp, Zap, Play, Loader2,
  ArrowRight, ArrowUpRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { useTestHubStore } from "../../stores/useTestHubStore";
import { computeOptimization } from "../../engines/testHubEngine";

export function AutoOptimizationTabContent() {
  const {
    compressor, condenser, evaporator, conditions, selectedMachine,
    optimization, setAnalysisLoading, setAnalysisResult, setAnalysisError,
  } = useTestHubStore();

  const handleRun = useCallback(async () => {
    setAnalysisLoading("optimization", true);
    try {
      const result = await computeOptimization(compressor, condenser, evaporator, conditions);
      setAnalysisResult("optimization", result);
    } catch (e) {
      setAnalysisError("optimization", e instanceof Error ? e.message : "Erro desconhecido");
    }
  }, [compressor, condenser, evaporator, conditions, setAnalysisLoading, setAnalysisResult, setAnalysisError]);

  const result = optimization.result;

  const teChartData = useMemo(() => {
    if (!result?.teRange) return [];
    return result.teRange.map((p) => ({
      Te: p.Te_C,
      Q_kW: parseFloat((p.Q_W / 1000).toFixed(2)),
      COP: parseFloat(p.COP.toFixed(3)),
    }));
  }, [result]);

  const priorityColors = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-emerald-500" };
  const priorityLabels = { high: "Alta", medium: "Média", low: "Baixa" };

  return (
    <div className="space-y-5">
      {/* Botão de execução */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Otimização Automática do Sistema</p>
            <p className="text-xs text-slate-500">
              Varre Te de -45°C a +15°C e Tc de 25°C a 65°C para encontrar o ponto ótimo de operação.
            </p>
          </div>
          <Button
            onClick={handleRun}
            disabled={optimization.loading}
            className="bg-[#1E6FD9] text-white hover:bg-[#1558b0]"
          >
            {optimization.loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Otimizando...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" />Otimizar</>
            )}
          </Button>
        </CardContent>
      </Card>

      {optimization.error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700">{optimization.error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <>
          {/* Comparação: ponto atual vs otimizado */}
          {result.bestEquilibrium && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-500">Ponto Atual (Nominal)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "Te", value: `${(compressor.evap_temp_c ?? selectedMachine?.tempEvaporacaoC ?? -10).toFixed(1)}°C` },
                      { label: "Tc", value: `${(compressor.cond_temp_c ?? selectedMachine?.tempCondensacaoC ?? 40).toFixed(1)}°C` },
                      { label: "Q_evap", value: `${((compressor.cooling_capacity_w ?? 0) / 1000).toFixed(2)} kW` },
                      { label: "COP", value: compressor.cooling_capacity_w && compressor.power_w ? (compressor.cooling_capacity_w / compressor.power_w).toFixed(3) : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-sm font-bold text-slate-700">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-300 bg-emerald-50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-emerald-700">Ponto Otimizado</CardTitle>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "Te", value: `${result.bestEquilibrium.Te_C.toFixed(1)}°C` },
                      { label: "Tc", value: `${result.bestEquilibrium.Tc_C.toFixed(1)}°C` },
                      { label: "Q_evap", value: `${(result.bestEquilibrium.Q_evap_W / 1000).toFixed(2)} kW` },
                      { label: "COP", value: result.bestEquilibrium.COP.toFixed(3) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-emerald-600">{label}</span>
                        <span className="text-sm font-bold text-emerald-800">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Gráfico Te × COP e Te × Q */}
          {teChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Varredura de Te — COP e Capacidade</CardTitle>
                <CardDescription className="text-xs">
                  Sensibilidade do sistema à temperatura de evaporação. Ponto ótimo marcado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={teChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="Te"
                      label={{ value: "Te [°C]", position: "insideBottom", offset: -10, fontSize: 11 }}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis yAxisId="cop" orientation="left" tick={{ fontSize: 10 }} label={{ value: "COP", angle: -90, position: "insideLeft", fontSize: 11 }} />
                    <YAxis yAxisId="q" orientation="right" tick={{ fontSize: 10 }} label={{ value: "Q [kW]", angle: 90, position: "insideRight", fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [v.toFixed(3), name === "COP" ? "COP" : "Q_evap [kW]"]}
                      labelFormatter={(l: number) => `Te = ${l}°C`}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="cop" type="monotone" dataKey="COP" stroke="#1E6FD9" strokeWidth={2.5} dot={false} name="COP" />
                    <Line yAxisId="q" type="monotone" dataKey="Q_kW" stroke="#10b981" strokeWidth={2.5} dot={false} name="Q_evap [kW]" />
                    {result.bestEquilibrium && (
                      <ReferenceLine
                        yAxisId="cop"
                        x={result.bestEquilibrium.Te_C}
                        stroke="#f59e0b"
                        strokeDasharray="5 3"
                        label={{ value: `Te_opt = ${result.bestEquilibrium.Te_C.toFixed(1)}°C`, fontSize: 9, fill: "#f59e0b", position: "top" }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Ajustes recomendados */}
          {result.adjustments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ajustes Recomendados</CardTitle>
                <CardDescription className="text-xs">
                  Ordenados por prioridade de impacto no desempenho do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.adjustments.map((adj, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                      <Badge className={`mt-0.5 shrink-0 text-[10px] text-white ${priorityColors[adj.priority]}`}>
                        {priorityLabels[adj.priority]}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{adj.parameter}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="font-mono text-slate-500">{adj.current}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-mono font-bold text-emerald-700">{adj.suggested}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Ganho esperado: <span className="font-medium text-emerald-600">{adj.expectedGain}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações gerais */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recomendações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1E6FD9]" />
                      <p className="text-xs text-slate-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription>
                <ul className="space-y-1 text-xs text-amber-700">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {!result && !optimization.loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10">
            <Zap className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">Clique em "Otimizar" para encontrar o melhor ponto de operação.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
