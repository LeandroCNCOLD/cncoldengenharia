/**
 * TestHubPage — Hub de Testes e Simulação do CN Coils
 *
 * Consolida em uma única página com abas:
 *   Aba 1 — Configuração do Sistema (componentes)
 *   Aba 2 — Equilíbrio do Sistema (systemEquilibriumEngine)
 *   Aba 3 — Curva de Desempenho (productPerformanceCurveEngine via coldpro)
 *   Aba 4 — Mapa Operacional (operatingMapEngine do cn_coils)
 *   Aba 5 — Ranking de Variações (optimizationEngine do cn_coils)
 *   Aba 6 — Análise de Degelo (frostCycleService do cn_coils)
 *
 * Os engines são os reais — sem valores hardcoded.
 * O estado é compartilhado via Zustand (useCatalogSessionStore + useCoilEnvelopeStore).
 */
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings2,
  Activity,
  TrendingUp,
  Map,
  BarChart3,
  Snowflake,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

// ─── Sub-abas importadas das páginas existentes ───────────────────────────────
import { SimulationTabContent } from "./hub-tabs/SimulationTabContent";
import { PerformanceCurveTabContent } from "./hub-tabs/PerformanceCurveTabContent";
import { OperatingMapTabContent } from "./hub-tabs/OperatingMapTabContent";
import { OptimizationTabContent } from "./hub-tabs/OptimizationTabContent";
import { FrostTabContent } from "./hub-tabs/FrostTabContent";
import { SystemConfigTabContent } from "./hub-tabs/SystemConfigTabContent";

// ─── Stores ───────────────────────────────────────────────────────────────────
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { useCoilEnvelopeStore } from "@/modules/cn_coils/store/useCoilEnvelopeStore";

type TabId =
  | "config"
  | "equilibrium"
  | "performance"
  | "map"
  | "optimization"
  | "frost";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  {
    id: "config",
    label: "Configuração",
    icon: Settings2,
    description: "Selecione compressor, evaporador, condensador e condições de operação",
  },
  {
    id: "equilibrium",
    label: "Equilíbrio",
    icon: Activity,
    description: "Balanço térmico entre compressor, evaporador e condensador",
  },
  {
    id: "performance",
    label: "Curva de Desempenho",
    icon: TrendingUp,
    description: "Capacidade, COP e potência em função de Te e Tc",
  },
  {
    id: "map",
    label: "Mapa Operacional",
    icon: Map,
    description: "Envelope de operação em múltiplas condições de Tc",
  },
  {
    id: "optimization",
    label: "Ranking de Variações",
    icon: BarChart3,
    description: "Geração automática e ranking de variações de geometria do evaporador",
  },
  {
    id: "frost",
    label: "Degelo",
    icon: Snowflake,
    description: "Análise de formação de gelo e ciclo de degelo",
  },
];

function SystemStatusBar() {
  const { selectedCompressor, selectedEvaporator, selectedCondenser } =
    useCatalogSessionStore();
  const compressorEnvelope = useCoilEnvelopeStore((s) => s.compressorEnvelope);
  const evaporatorEnvelope = useCoilEnvelopeStore((s) => s.envelopes.evaporator_dx);

  const hasCompressor = Boolean(selectedCompressor || compressorEnvelope);
  const hasEvaporator = Boolean(selectedEvaporator || evaporatorEnvelope);
  const hasCondenser = Boolean(selectedCondenser);

  const readyCount = [hasCompressor, hasEvaporator, hasCondenser].filter(Boolean).length;
  const isReady = readyCount === 3;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        {isReady ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Clock className="h-4 w-4 text-amber-500" />
        )}
        <span className="text-sm font-medium text-slate-700">
          {isReady ? "Sistema configurado" : `${readyCount}/3 componentes selecionados`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={hasCompressor ? "default" : "outline"} className="text-xs">
          Compressor
        </Badge>
        <Badge variant={hasEvaporator ? "default" : "outline"} className="text-xs">
          Evaporador
        </Badge>
        <Badge variant={hasCondenser ? "default" : "outline"} className="text-xs">
          Condensador
        </Badge>
      </div>
      {!isReady && (
        <Alert className="ml-auto flex-1 border-amber-200 bg-amber-50 py-1">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700">
            Configure os componentes na aba <strong>Configuração</strong> ou importe do{" "}
            <strong>Catálogo & Seleção</strong>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function TestHubPage() {
  const [activeTab, setActiveTab] = useState<TabId>("config");

  const activeTabDef = useMemo(
    () => TABS.find((t) => t.id === activeTab)!,
    [activeTab],
  );

  return (
    <PageContainer
      title="Hub de Testes"
      subtitle={activeTabDef.description}
    >
      <SystemStatusBar />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap gap-1 bg-slate-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E6FD9] data-[state=active]:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="config" className="mt-0">
          <SystemConfigTabContent onDone={() => setActiveTab("equilibrium")} />
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

        <TabsContent value="optimization" className="mt-0">
          <OptimizationTabContent />
        </TabsContent>

        <TabsContent value="frost" className="mt-0">
          <FrostTabContent />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
