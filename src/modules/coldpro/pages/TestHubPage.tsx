/**
 * TestHubPage — Hub de Testes e Simulação do CN Coils (v2)
 *
 * 19 abas completas com auto-disparo ao selecionar máquina do catálogo.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Settings2, Activity, TrendingUp, Map, BarChart3, Snowflake,
  AlertCircle, CheckCircle2, Clock, Zap, Brain,
  FileText, Wind, Shield, Target, GitCompare, BarChart2,
  Gauge, FlaskConical, Play, Loader2, LayoutDashboard,
} from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

import { SimulationTabContent } from "./hub-tabs/SimulationTabContent";
import { PerformanceCurveTabContent } from "./hub-tabs/PerformanceCurveTabContent";
import { OperatingMapTabContent } from "./hub-tabs/OperatingMapTabContent";
import { OptimizationTabContent } from "./hub-tabs/OptimizationTabContent";
import { FrostTabContent } from "./hub-tabs/FrostTabContent";
import { SystemConfigTabContent } from "./hub-tabs/SystemConfigTabContent";
import { PhDiagramTabContent } from "./hub-tabs/PhDiagramTabContent";
import { MonteCarloTabContent } from "./hub-tabs/MonteCarloTabContent";
import { DataSanityTabContent } from "./hub-tabs/DataSanityTabContent";
import { OperatingEnvelopeTabContent } from "./hub-tabs/OperatingEnvelopeTabContent";
import { EnergyBalanceTabContent } from "./hub-tabs/EnergyBalanceTabContent";
import { FanCoilTabContent } from "./hub-tabs/FanCoilTabContent";
import { BottleneckTabContent } from "./hub-tabs/BottleneckTabContent";
import { ScenariosTabContent } from "./hub-tabs/ScenariosTabContent";
import { MachineComparisonTabContent } from "./hub-tabs/MachineComparisonTabContent";
import { AutoOptimizationTabContent } from "./hub-tabs/AutoOptimizationTabContent";
import { AIAnalysisTabContent } from "./hub-tabs/AIAnalysisTabContent";
import { ExecutiveSummaryTabContent } from "./hub-tabs/ExecutiveSummaryTabContent";
import { TechnicalReportTabContent } from "./hub-tabs/TechnicalReportTabContent";

import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { useCoilEnvelopeStore } from "@/modules/cn_coils/store/useCoilEnvelopeStore";
import { useTestHubStore } from "../stores/useTestHubStore";
import {
  computePhDiagram,
  computeMonteCarlo,
  computeOptimization,
  computeAIAnalysis,
} from "../engines/testHubEngine";

type TabId =
  | "summary" | "config"
  | "ph" | "equilibrium" | "performance" | "map"
  | "montecarlo" | "polynomial" | "autoopt" | "envelope" | "energy" | "fancoil"
  | "sanity" | "bottleneck" | "scenarios" | "frost" | "comparison"
  | "ai" | "report";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  group: "config" | "thermo" | "advanced" | "diagnosis" | "ai";
}

const TABS: TabDef[] = [
  { id: "summary", label: "Resumo", icon: LayoutDashboard, description: "Visão consolidada de todas as análises do sistema", group: "config" },
  { id: "config", label: "Configuração", icon: Settings2, description: "Selecione compressor, evaporador, condensador e condições de operação", group: "config" },
  { id: "ph", label: "P-H Diagram", icon: Activity, description: "Ciclo de Mollier com 4 pontos, curva de saturação e isóbaras", group: "thermo" },
  { id: "equilibrium", label: "Equilíbrio", icon: Gauge, description: "Balanço térmico entre compressor, evaporador e condensador", group: "thermo" },
  { id: "performance", label: "Desempenho", icon: TrendingUp, description: "Capacidade, COP e potência em função de Te e Tc", group: "thermo" },
  { id: "map", label: "Mapa Op.", icon: Map, description: "Envelope de operação em múltiplas condições de Tc", group: "thermo" },
  { id: "montecarlo", label: "Monte Carlo", icon: FlaskConical, description: "Análise de incerteza com 500 amostras e bandas de confiança IC 90%", group: "advanced" },
  { id: "polynomial", label: "Polinômios", icon: BarChart2, description: "Coeficientes ARI 540 / EN 12900 com tabela e gráfico de superfície", group: "advanced" },
  { id: "autoopt", label: "Otimização", icon: Target, description: "Melhor ponto de equilíbrio com sugestões de ajuste priorizadas", group: "advanced" },
  { id: "envelope", label: "Envelope", icon: Shield, description: "Limites operacionais de Te, Tc, razão de compressão e temperatura de descarga", group: "advanced" },
  { id: "energy", label: "Balanço E.", icon: Zap, description: "Validação do balanço de energia: Q_cond ≈ Q_evap + W_comp", group: "advanced" },
  { id: "fancoil", label: "Vent×Coil", icon: Wind, description: "Curva do ventilador, ponto de operação real e eficiência do coil", group: "advanced" },
  { id: "sanity", label: "Sanidade", icon: CheckCircle2, description: "Validação completa de todos os dados de entrada do sistema", group: "diagnosis" },
  { id: "bottleneck", label: "Gargalo", icon: AlertCircle, description: "Identificação do componente limitante do sistema", group: "diagnosis" },
  { id: "scenarios", label: "Cenários", icon: BarChart3, description: "9 cenários operacionais reais com análise comparativa", group: "diagnosis" },
  { id: "frost", label: "Degelo", icon: Snowflake, description: "Análise de formação de gelo e ciclo de degelo", group: "diagnosis" },
  { id: "comparison", label: "Comparar", icon: GitCompare, description: "Alternativas do catálogo com comparação de capacidade e COP", group: "diagnosis" },
  { id: "ai", label: "IA", icon: Brain, description: "Diagnóstico técnico com motor de regras termodinâmicas embarcadas", group: "ai" },
  { id: "report", label: "Relatório", icon: FileText, description: "Relatório técnico completo com exportação para clipboard e impressão", group: "ai" },
];

const GROUP_LABELS: Record<string, string> = {
  config: "Configuração",
  thermo: "Termodinâmica",
  advanced: "Análises Avançadas",
  diagnosis: "Diagnóstico",
  ai: "IA & Relatório",
};

const GROUP_COLORS: Record<string, string> = {
  config: "text-slate-500",
  thermo: "text-blue-600",
  advanced: "text-violet-600",
  diagnosis: "text-amber-600",
  ai: "text-emerald-600",
};

function SystemStatusBar({ onRunAll, isRunning }: { onRunAll: () => void; isRunning: boolean }) {
  const { selectedCompressor, selectedEvaporator, selectedCondenser } = useCatalogSessionStore();
  const compressorEnvelope = useCoilEnvelopeStore((s) => s.compressorEnvelope);
  const evaporatorEnvelope = useCoilEnvelopeStore((s) => s.envelopes.evaporator_dx);
  const { isConfigured, ph, montecarlo, optimization, ai } = useTestHubStore();

  const hasCompressor = Boolean(selectedCompressor || compressorEnvelope);
  const hasEvaporator = Boolean(selectedEvaporator || evaporatorEnvelope);
  const hasCondenser = Boolean(selectedCondenser);
  const readyCount = [hasCompressor, hasEvaporator, hasCondenser].filter(Boolean).length;
  const isReady = readyCount === 3 || isConfigured;
  const completedAnalyses = [ph.result, montecarlo.result, optimization.result, ai.result].filter(Boolean).length;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        {isReady ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Clock className="h-4 w-4 text-amber-500" />
        )}
        <span className="text-sm font-medium text-slate-700">
          {isReady ? "Sistema configurado" : `${readyCount}/3 componentes`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={hasCompressor ? "default" : "outline"} className="text-xs">Compressor</Badge>
        <Badge variant={hasEvaporator ? "default" : "outline"} className="text-xs">Evaporador</Badge>
        <Badge variant={hasCondenser ? "default" : "outline"} className="text-xs">Condensador</Badge>
      </div>
      {completedAnalyses > 0 && (
        <Badge variant="secondary" className="text-xs">{completedAnalyses}/4 análises concluídas</Badge>
      )}
      {isReady && (
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={onRunAll} disabled={isRunning} className="text-xs">
            {isRunning ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Rodando...</>
            ) : (
              <><Play className="mr-1.5 h-3.5 w-3.5" />Rodar Todas as Análises</>
            )}
          </Button>
        </div>
      )}
      {!isReady && (
        <Alert className="ml-auto flex-1 border-amber-200 bg-amber-50 py-1">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700">
            Configure os componentes na aba <strong>Configuração</strong> ou importe do <strong>Catálogo & Seleção</strong>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function TestHubPage() {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [isRunningAll, setIsRunningAll] = useState(false);

  const {
    compressor, condenser, evaporator, conditions, selectedMachine,
    ph, montecarlo, optimization, ai,
    setAnalysisLoading, setAnalysisResult, setAnalysisError,
  } = useTestHubStore();

  const activeTabDef = useMemo(() => TABS.find((t) => t.id === activeTab)!, [activeTab]);

  const runAllAnalyses = useCallback(async () => {
    setIsRunningAll(true);
    try {
      setAnalysisLoading("ph", true);
      const phResult = await computePhDiagram(compressor, evaporator, conditions);
      setAnalysisResult("ph", phResult);

      setAnalysisLoading("montecarlo", true);
      const mcResult = await computeMonteCarlo(compressor, evaporator);
      setAnalysisResult("montecarlo", mcResult);

      setAnalysisLoading("optimization", true);
      const optResult = await computeOptimization(compressor, condenser, evaporator, conditions);
      setAnalysisResult("optimization", optResult);

      setAnalysisLoading("ai", true);
      const aiResult = await computeAIAnalysis(compressor, condenser, evaporator, conditions, phResult, mcResult, optResult);
      setAnalysisResult("ai", aiResult);
    } catch (e) {
      console.error("Erro ao rodar análises:", e);
    } finally {
      setIsRunningAll(false);
    }
  }, [compressor, condenser, evaporator, conditions, setAnalysisLoading, setAnalysisResult, setAnalysisError]);

  useEffect(() => {
    if (selectedMachine && compressor.cooling_capacity_w) {
      runAllAnalyses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine?.id]);

  const tabGroups = useMemo(() => {
    const groups: Record<string, TabDef[]> = {};
    TABS.forEach((tab) => {
      if (!groups[tab.group]) groups[tab.group] = [];
      groups[tab.group]!.push(tab);
    });
    return groups;
  }, []);

  return (
    <PageContainer title="Hub de Testes" subtitle={activeTabDef.description}>
      <SystemStatusBar onRunAll={runAllAnalyses} isRunning={isRunningAll} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="space-y-4">
        <div className="space-y-1.5">
          {Object.entries(tabGroups).map(([group, tabs]) => (
            <div key={group} className="flex flex-wrap items-center gap-1">
              <span className={`mr-1 w-28 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${GROUP_COLORS[group]}`}>
                {GROUP_LABELS[group]}
              </span>
              <div className="flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isDone =
                    (tab.id === "ph" && ph.result != null) ||
                    (tab.id === "montecarlo" && montecarlo.result != null) ||
                    (tab.id === "autoopt" && optimization.result != null) ||
                    (tab.id === "ai" && ai.result != null);
                  const isLoading =
                    (tab.id === "ph" && ph.loading) ||
                    (tab.id === "montecarlo" && montecarlo.loading) ||
                    (tab.id === "autoopt" && optimization.loading) ||
                    (tab.id === "ai" && ai.loading);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                        activeTab === tab.id
                          ? "bg-white text-[#1E6FD9] shadow-sm"
                          : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
                      }`}
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                      {tab.label}
                      {isDone && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <TabsContent value="summary" className="mt-0">
          <ExecutiveSummaryTabContent machine={selectedMachine} onNavigate={(tab) => setActiveTab(tab as TabId)} />
        </TabsContent>
        <TabsContent value="config" className="mt-0">
          <SystemConfigTabContent onDone={() => setActiveTab("ph")} />
        </TabsContent>
        <TabsContent value="ph" className="mt-0">
          <PhDiagramTabContent result={ph.result} loading={ph.loading} error={ph.error} />
        </TabsContent>
        <TabsContent value="equilibrium" className="mt-0">
          <SimulationTabContent />
        </TabsContent>
        <TabsContent value="performance" className="mt-0">
          <PerformanceCurveTabContent />
        </TabsContent>
        <TabsContent value="map" className="mt-0">
          <OperatingMapTabContent />
        </TabsContent>
        <TabsContent value="montecarlo" className="mt-0">
          <MonteCarloTabContent result={montecarlo.result} loading={montecarlo.loading} error={montecarlo.error} />
        </TabsContent>
        <TabsContent value="polynomial" className="mt-0">
          <OptimizationTabContent />
        </TabsContent>
        <TabsContent value="autoopt" className="mt-0">
          <AutoOptimizationTabContent />
        </TabsContent>
        <TabsContent value="envelope" className="mt-0">
          <OperatingEnvelopeTabContent machine={selectedMachine} compressor={compressor} phResult={ph.result ?? null} />
        </TabsContent>
        <TabsContent value="energy" className="mt-0">
          <EnergyBalanceTabContent compressor={compressor} condenser={condenser} phResult={ph.result ?? null} />
        </TabsContent>
        <TabsContent value="fancoil" className="mt-0">
          <FanCoilTabContent machine={selectedMachine} evaporator={evaporator} />
        </TabsContent>
        <TabsContent value="sanity" className="mt-0">
          <DataSanityTabContent machine={selectedMachine} compressor={compressor} condenser={condenser} evaporator={evaporator} conditions={conditions} />
        </TabsContent>
        <TabsContent value="bottleneck" className="mt-0">
          <BottleneckTabContent machine={selectedMachine} compressor={compressor} condenser={condenser} evaporator={evaporator} conditions={conditions} />
        </TabsContent>
        <TabsContent value="scenarios" className="mt-0">
          <ScenariosTabContent machine={selectedMachine} compressor={compressor} condenser={condenser} evaporator={evaporator} conditions={conditions} />
        </TabsContent>
        <TabsContent value="frost" className="mt-0">
          <FrostTabContent />
        </TabsContent>
        <TabsContent value="comparison" className="mt-0">
          <MachineComparisonTabContent machine={selectedMachine} compressor={compressor} />
        </TabsContent>
        <TabsContent value="ai" className="mt-0">
          <AIAnalysisTabContent />
        </TabsContent>
        <TabsContent value="report" className="mt-0">
          <TechnicalReportTabContent machine={selectedMachine} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
