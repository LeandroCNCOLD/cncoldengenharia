/**
 * AIAnalysisTabContent — Análise de IA
 *
 * Motor de diagnóstico técnico embarcado com regras termodinâmicas:
 * - Aprovação/reprovação da máquina com nota A-F
 * - Diagnóstico por categoria (compressor, condensador, evaporador, ciclo, elétrica)
 * - Recomendações priorizadas com impacto esperado
 * - Insights termodinâmicos baseados em ASHRAE/Incropera/Bitzer
 *
 * A IA não usa LLM externo — usa um motor de regras embarcado treinado
 * com a literatura técnica de refrigeração industrial.
 *
 * Referências:
 * - ASHRAE Handbook Refrigeration 2022
 * - ASHRAE Handbook Fundamentals 2021
 * - Bitzer Technical Information A-501 (2019)
 * - Incropera et al. (2011) — Fundamentals of Heat and Mass Transfer, 7th ed.
 * - AHRI Standard 540 (2020)
 * - EN 12900:2013
 */
import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2, AlertCircle, XCircle, Brain, Play, Loader2,
  BookOpen, ArrowUpRight, Star,
} from "lucide-react";
import { useTestHubStore } from "../../stores/useTestHubStore";
import { computeAIAnalysis } from "../../engines/testHubEngine";

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-600 bg-emerald-100 border-emerald-300",
  B: "text-blue-600 bg-blue-100 border-blue-300",
  C: "text-amber-600 bg-amber-100 border-amber-300",
  D: "text-orange-600 bg-orange-100 border-orange-300",
  F: "text-red-600 bg-red-100 border-red-300",
};

const SEVERITY_ICONS = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
  critical: <XCircle className="h-4 w-4 text-red-500" />,
};

const SEVERITY_BG = {
  ok: "border-emerald-100 bg-emerald-50/50",
  warning: "border-amber-200 bg-amber-50",
  critical: "border-red-200 bg-red-50",
};

export function AIAnalysisTabContent() {
  const {
    compressor, condenser, evaporator, conditions, selectedMachine,
    ai, ph, montecarlo, optimization,
    setAnalysisLoading, setAnalysisResult, setAnalysisError,
  } = useTestHubStore();

  const handleRun = useCallback(async () => {
    setAnalysisLoading("ai", true);
    try {
      const result = await computeAIAnalysis(
        compressor, condenser, evaporator, conditions,
        ph.result,
        montecarlo.result,
        optimization.result,
      );
      setAnalysisResult("ai", result);
    } catch (e) {
      setAnalysisError("ai", e instanceof Error ? e.message : "Erro desconhecido");
    }
  }, [compressor, condenser, evaporator, conditions, ph.result, montecarlo.result, optimization.result, setAnalysisLoading, setAnalysisResult, setAnalysisError]);

  const result = ai.result;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-[#1E6FD9]/30 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E6FD9]/10">
              <Brain className="h-5 w-5 text-[#1E6FD9]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Motor de Diagnóstico Técnico</p>
              <p className="text-xs text-slate-500">
                Regras embarcadas baseadas em ASHRAE, AHRI 540, EN 12900, Bitzer e Incropera.
              </p>
            </div>
          </div>
          <Button
            onClick={handleRun}
            disabled={ai.loading}
            className="bg-[#1E6FD9] text-white hover:bg-[#1558b0]"
          >
            {ai.loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" />Analisar</>
            )}
          </Button>
        </CardContent>
      </Card>

      {ai.error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700">{ai.error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <>
          {/* Nota geral */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className={`border-2 sm:col-span-1 ${GRADE_COLORS[result.grade]?.split(" ").map((c) => c.startsWith("border") ? c : "").join(" ")}`}>
              <CardContent className="flex flex-col items-center justify-center p-6">
                <span className={`text-7xl font-black ${GRADE_COLORS[result.grade]?.split(" ").find((c) => c.startsWith("text"))}`}>
                  {result.grade}
                </span>
                <p className="mt-2 text-sm font-medium text-slate-600">Nota Técnica</p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${result.score >= 80 ? "bg-emerald-500" : result.score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{result.score}/100 pontos</p>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Diagnóstico Geral</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-700">{result.summary}</p>
                {result.thermodynamicInsights.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {result.thermodynamicInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1E6FD9]" />
                        <p className="text-xs text-slate-600">{insight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Diagnósticos por categoria */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Diagnóstico por Categoria</CardTitle>
              <CardDescription className="text-xs">
                Análise técnica baseada em regras termodinâmicas e normas industriais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.diagnoses.map((diag, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${SEVERITY_BG[diag.severity]}`}>
                    <div className="flex items-start gap-3">
                      {SEVERITY_ICONS[diag.severity]}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{diag.category}</span>
                          <Badge variant="outline" className={`text-[10px] ${diag.severity === "critical" ? "border-red-400 text-red-600" : diag.severity === "warning" ? "border-amber-400 text-amber-600" : "border-emerald-400 text-emerald-600"}`}>
                            {diag.severity === "critical" ? "Crítico" : diag.severity === "warning" ? "Atenção" : "OK"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-700">{diag.finding}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{diag.explanation}</p>
                        <p className="mt-1 text-[10px] text-slate-400 italic">Ref: {diag.reference}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recomendações priorizadas */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Recomendações Priorizadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E6FD9] text-[10px] font-bold text-white">
                        {rec.priority}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800">{rec.action}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                          <p className="text-[11px] text-emerald-600">{rec.expectedImpact}</p>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400 italic">Ref: {rec.reference}</p>
                      </div>
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

      {!result && !ai.loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10">
            <Brain className="h-12 w-12 text-slate-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">Motor de Diagnóstico Técnico</p>
              <p className="mt-1 text-xs text-slate-400">
                Analisa o sistema com base em regras termodinâmicas embarcadas.
                Para melhores resultados, execute primeiro o Diagrama P-H, Monte Carlo e Otimização.
              </p>
            </div>
            <Button onClick={handleRun} className="bg-[#1E6FD9] text-white hover:bg-[#1558b0]">
              <Brain className="mr-2 h-4 w-4" />
              Iniciar Diagnóstico
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
