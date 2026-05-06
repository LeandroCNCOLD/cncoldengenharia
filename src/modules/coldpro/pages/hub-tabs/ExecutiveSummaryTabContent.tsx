/**
 * ExecutiveSummaryTabContent — Resumo Executivo
 *
 * Visão consolidada de todas as análises do Hub de Testes.
 * Mostra o status de cada análise e os principais resultados.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, Clock, Brain, BarChart3, Thermometer, Zap, Wind, Target, Activity, TrendingUp } from "lucide-react";
import { useTestHubStore } from "../../stores/useTestHubStore";
import type { CatalogEquipmentRow } from "@/modules/coldpro_catalog/data/equipmentCatalog.types";
import { CapacityDisplay, fmtCapacity } from "../../components/ui/CapacityDisplay";

interface Props {
  machine: CatalogEquipmentRow | null;
  onNavigate: (tab: string) => void;
}

export function ExecutiveSummaryTabContent({ machine, onNavigate }: Props) {
  const { compressor, condenser, evaporator, ph, montecarlo, optimization, ai, isConfigured } = useTestHubStore();

  const Q_W = compressor.cooling_capacity_w ?? 0;
  const Q_kW = Q_W / 1000;
  const W_kW = (compressor.power_w ?? Q_kW / 2.5);
  const COP = W_kW > 0 ? Q_kW / W_kW : 0;

  const analyses = [
    {
      id: "ph",
      name: "Diagrama P-H",
      icon: Activity,
      state: ph,
      summary: ph.result ? `COP ${ph.result.COP.toFixed(3)} · Tc ${ph.result.Tc_C.toFixed(1)}°C · Te ${ph.result.Te_C.toFixed(1)}°C` : null,
      tab: "ph",
    },
    {
      id: "montecarlo",
      name: "Monte Carlo",
      icon: BarChart3,
      state: montecarlo,
      summary: montecarlo.result ? `COP nominal: ${montecarlo.result.cop.nominal.toFixed(3)} · IC90%: [${montecarlo.result.cop.lower.toFixed(2)}, ${montecarlo.result.cop.upper.toFixed(2)}]` : null,
      tab: "montecarlo",
    },
    {
      id: "optimization",
      name: "Otimização",
      icon: TrendingUp,
      state: optimization,
      summary: optimization.result?.bestEquilibrium
        ? `COP ótimo: ${optimization.result.bestEquilibrium.COP.toFixed(3)} · Te_opt: ${optimization.result.bestEquilibrium.Te_C.toFixed(1)}°C`
        : null,
      tab: "optimization",
    },
    {
      id: "ai",
      name: "Análise de IA",
      icon: Brain,
      state: ai,
      summary: ai.result ? `Nota: ${ai.result.grade} (${ai.result.score}/100) — ${ai.result.summary.slice(0, 80)}...` : null,
      tab: "ai",
    },
  ];

  const completedCount = analyses.filter((a) => a.state.result != null).length;
  const overallGrade = ai.result?.grade ?? (completedCount >= 3 ? "B" : null);

  return (
    <div className="space-y-5">
      {/* Header da máquina */}
      {machine ? (
        <Card className="border-[#1E6FD9]/30 bg-gradient-to-r from-blue-50 to-slate-50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-bold text-slate-800">{machine.modelo}</p>
                <p className="text-sm text-slate-500">
                  {machine.application} · {machine.refrigerante} · {machine.linha ?? "—"} · {machine.tensaoComercial ?? `${machine.tensaoV ?? "—"}V`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {machine.capacidadeFrigorificaKcalH && (
                    <Badge variant="outline" className="text-xs">
                      {(machine.capacidadeFrigorificaKcalH).toFixed(0)} kcal/h
                    </Badge>
                  )}
                  {machine.potenciaEletricaKw && (
                    <Badge variant="outline" className="text-xs">
                      {machine.potenciaEletricaKw.toFixed(2)} kW
                    </Badge>
                  )}
                  {COP > 0 && (
                    <Badge variant="outline" className="text-xs border-emerald-400 text-emerald-600">
                      COP {COP.toFixed(3)}
                    </Badge>
                  )}
                </div>
              </div>
              {overallGrade && (
                <div className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 text-4xl font-black ${
                  overallGrade === "A" ? "border-emerald-400 bg-emerald-100 text-emerald-700" :
                  overallGrade === "B" ? "border-blue-400 bg-blue-100 text-blue-700" :
                  overallGrade === "C" ? "border-amber-400 bg-amber-100 text-amber-700" :
                  "border-red-400 bg-red-100 text-red-700"
                }`}>
                  {overallGrade}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-sm text-slate-500">Selecione uma máquina na aba Configuração para ver o resumo.</p>
          </CardContent>
        </Card>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Capacidade Frigorífica", value: Q_kW > 0 ? `${Q_kW.toFixed(2)} kW` : "—", sub: Q_kW > 0 ? `${fmtCapacity(Q_W, "kcal/h")} kcal/h · ${fmtCapacity(Q_W, "BTU/h")} BTU/h · ${fmtCapacity(Q_W, "TR")} TR` : "", icon: Thermometer, color: "text-blue-600" },
          { label: "Potência Elétrica", value: W_kW > 0 ? `${W_kW.toFixed(2)} kW` : "—", sub: machine?.correnteA ? `${machine.correnteA.toFixed(1)} A` : "", icon: Zap, color: "text-amber-600" },
          { label: "COP", value: COP > 0 ? COP.toFixed(3) : "—", sub: COP > 0 ? `EER: ${(COP * 3.412).toFixed(2)}` : "", icon: TrendingUp, color: "text-emerald-600" },
          { label: "Análises Concluídas", value: `${completedCount}/${analyses.length}`, sub: `${Math.round((completedCount / analyses.length) * 100)}% completo`, icon: CheckCircle2, color: "text-[#1E6FD9]" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
              <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
              {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Capacidade em múltiplas unidades */}
      {Q_W > 0 && (
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Capacidade Frigorífica — Conversão de Unidades</p>
            <CapacityDisplay watts={Q_W} primary="kW" />
          </CardContent>
        </Card>
      )}

      {/* Status das análises */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status das Análises</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {analyses.map((analysis) => {
              const Icon = analysis.icon;
              const hasResult = analysis.state.result != null;
              const isLoading = analysis.state.loading;
              const hasError = analysis.state.error != null;

              return (
                <div
                  key={analysis.id}
                  className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm ${
                    hasResult ? "border-emerald-200 bg-emerald-50/50" :
                    hasError ? "border-red-200 bg-red-50" :
                    "border-slate-200 bg-slate-50"
                  }`}
                  onClick={() => onNavigate(analysis.tab)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${hasResult ? "text-emerald-600" : hasError ? "text-red-500" : "text-slate-400"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-700">{analysis.name}</p>
                        {isLoading ? (
                          <Badge variant="outline" className="text-[10px] text-blue-600">Rodando...</Badge>
                        ) : hasResult ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : hasError ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                      {analysis.summary && (
                        <p className="mt-0.5 text-[10px] text-slate-500 truncate">{analysis.summary}</p>
                      )}
                      {hasError && (
                        <p className="mt-0.5 text-[10px] text-red-500">{analysis.state.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diagnóstico da IA (resumido) */}
      {ai.result && (
        <Card className="border-[#1E6FD9]/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-[#1E6FD9]" />
              <CardTitle className="text-sm">Diagnóstico da IA</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">{ai.result.summary}</p>
            {ai.result.recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="mt-2 flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1E6FD9] text-[9px] font-bold text-white">{rec.priority}</span>
                <p className="text-xs text-slate-600">{rec.action}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alertas críticos de todas as análises */}
      {[
        ...(ph.result?.warnings ?? []),
        ...(montecarlo.result?.warnings ?? []),
        ...(optimization.result?.warnings ?? []),
        ...(ai.result?.warnings ?? []),
      ].length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm text-amber-700">Alertas do Sistema</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {[
                ...(ph.result?.warnings ?? []),
                ...(montecarlo.result?.warnings ?? []),
                ...(optimization.result?.warnings ?? []),
                ...(ai.result?.warnings ?? []),
              ].slice(0, 8).map((w, i) => (
                <li key={i} className="text-xs text-amber-700">• {w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
