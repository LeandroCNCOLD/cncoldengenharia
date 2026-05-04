import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Snowflake, Bot, Calculator } from "lucide-react";
import { toast } from "sonner";

import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { useFrostAnalysis } from "../hooks/useFrostAnalysis";
import { useUncertaintyAnalysis } from "../hooks/useUncertaintyAnalysis";
import { useOperatingMap } from "../hooks/useOperatingMap";
import { usePdfExport } from "../hooks/usePdfExport";

import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { ResultCard } from "../components/ResultCard";
import { ActionBar } from "../components/ActionBar";
import { CyclePHDiagram } from "../components/CyclePHDiagram";
import { CoilEnvelopeTab } from "../components/CoilEnvelopeTab";
import { CoilsInSeriesPanel } from "../components/CoilsInSeriesPanel";
import { FrostAnalysisTab } from "../components/FrostAnalysisTab";
import { FrostAnalysisPanel } from "../components/FrostAnalysisPanel";
import { OperatingMapChart } from "../components/OperatingMapChart";
import { OptimizationPanel } from "../components/OptimizationPanel";
import { UncertaintyPanel, UncertaintyBadge } from "../components/UncertaintyBadge";
import { CompressorPickerModal } from "../components/CompressorPickerModal";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { DrawingTab } from "../components/drawing/DrawingTab";
import { WorkspaceAIChat } from "../components/WorkspaceAIChat";
import { DetailedWorkspacePanel } from "../components/DetailedWorkspacePanel";
import { enrichWarnings } from "../utils/warningEnricher";
import type { AIContext } from "../components/WorkspaceAIChat";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { CycleResult, CycleSystemConfig } from "../engines/cycle/cycleTypes";
import type { CoilCycleInputs, CoilCycleResult } from "../engines/coil/coilCycleAdapter";

// ── Refrigerantes ────────────────────────────────────────────────────────────
const REFRIGERANT_OPTIONS = ["R404A", "R22", "R134a", "R410A", "R507", "R448A", "R449A"];

type CalcMode = "verify" | "design";
type EngineMode = "v1" | "v2";
type CompressorMode = "ari" | "constant" | "manual";

export const WORKSPACE_TABS = {
  DETAILED: "detalhado",
  RESULTS: "resultados",
  CYCLE_PH: "ciclo_ph",
  ENVELOPE: "envelope_q_te",
  GEADA: "geada",
  GEADA_AVANCADA: "geada_avancada",
  MAPA_OPERACIONAL: "mapa_operacional",
  INCERTEZA: "incerteza",
  OTIMIZACAO: "otimizacao",
  SERIE: "serie",
  DESENHO: "desenho",
  RELATORIO: "relatorio",
} as const;

const fmt = (v: number, d = 2) =>
  Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";

const DEFAULT_CONFIG: CycleSystemConfig = {
  id: "evap-unified-01",
  name: "Evaporador DX — Unificado",
  refrigerantId: "R404A",
  compressor: {
    id: "BITZER_2KES05",
    model: "2KES-05",
    manufacturer: "BITZER",
    refrigerant: "R404A",
    modelType: "bitzer_native",
    bitzerNative: {
      displacement_m3h: 4.06,
      coeff_lambda: [1.08, -0.0069, 4.66e-5],
      coeff_current: [-0.116, 0.00605, -9.54e-5],
      coeff_specific_power: [0.565, 0.0155, 1.99e-4],
      rpm: 1450,
    },
  },
  evaporator: {
    physical: {
      rows: 3,
      finnedLengthMm: 1200,
      finnedHeightMm: 400,
      finPitchMm: 2.1,
      tubePitchTransversalMm: 25,
      tubePitchLongitudinalMm: 22,
      tubeExternalDiameterMm: 9.52,
      tubeInternalDiameterMm: 8.5,
      tubesPerRow: 12,
      circuits: 4,
      finThicknessMm: 0.12,
      finType: "plain",
    },
    airInletTempC: 25,
    airRelativeHumidity: 0.6,
    airFlowM3H: 5000,
    superheatK: 5,
    subcoolingK: 5,
    htCatalog: {},
    tubeMaterialConductivity: 385,
  },
  condenser: {
    physical: {
      rows: 2,
      finnedLengthMm: 800,
      finnedHeightMm: 600,
      finPitchMm: 3,
      tubePitchTransversalMm: 25.4,
      tubePitchLongitudinalMm: 22,
      tubeExternalDiameterMm: 9.52,
      tubeInternalDiameterMm: 8.5,
      tubesPerRow: 24,
      circuits: 4,
      finThicknessMm: 0.1,
      finType: "plain",
    },
    airInletTempC: 32,
    airRelativeHumidity: 0.5,
    airFlowM3H: 8000,
    superheatK: 0,
    subcoolingK: 5,
    htCatalog: {},
    tubeMaterialConductivity: 385,
  },
  expansionDevice: { type: "txv", superheatTarget_K: 5 },
  solver: {
    Te_initial_C: -10,
    Tc_initial_C: 40,
    tolerance: 0.01,
    maxIterations: 30,
    relaxation: 0.4,
  },
};

export function EvaporatorUnifiedWorkspacePage() {
  // ── Modo ──
  const [calcMode, setCalcMode] = useState<CalcMode>("verify");
  const [engineMode, setEngineMode] = useState<EngineMode>("v1");

  // ── Geometria ──
  const [geomHeight, setGeomHeight] = useState(400);
  const [geomWidth, setGeomWidth] = useState(1200);
  const [geomDepth, setGeomDepth] = useState(87);
  const [finPitch, setFinPitch] = useState(2.1);
  const [tubeDiam, setTubeDiam] = useState(9.52);
  const [circuits, setCircuits] = useState(4);
  const [rows, setRows] = useState(3);
  const [tubesPerRow, setTubesPerRow] = useState(12);

  // ── Ventilação ──
  const [airFlow, setAirFlow] = useState(5000);
  const [airTempIn, setAirTempIn] = useState(25);
  const [airRH, setAirRH] = useState(60);
  const [fanMode, setFanMode] = useState<"manual" | "catalog">("manual");
  const [staticPressure, setStaticPressure] = useState(0);
  const [safetyFactor, setSafetyFactor] = useState(0);

  // ── Fluido ──
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(40);
  const [superheat, setSuperheat] = useState(5);
  const [subcooling, setSubcooling] = useState(5);
  const [massFlow, setMassFlow] = useState(0);
  const [compressorPickerOpen, setCompressorPickerOpen] = useState(false);

  // ── Operação ──
  const [compressorMode, setCompressorMode] = useState<CompressorMode>("ari");
  const [frequency, setFrequency] = useState(60);
  const [voltage, setVoltage] = useState(380);

  // Velocidade frontal calculada (m/s)
  const frontalVelocity = useMemo(() => {
    const area = (geomHeight / 1000) * (geomWidth / 1000); // m²
    if (area <= 0) return 0;
    return airFlow / 3600 / area;
  }, [airFlow, geomHeight, geomWidth]);

  // ── Config para CycleEngine ──
  const config = useMemo<CycleSystemConfig>(
    () => ({
      ...DEFAULT_CONFIG,
      refrigerantId,
      compressor: { ...DEFAULT_CONFIG.compressor, refrigerant: refrigerantId },
      evaporator: {
        ...DEFAULT_CONFIG.evaporator,
        physical: {
          ...DEFAULT_CONFIG.evaporator.physical,
          rows,
          finnedHeightMm: geomHeight,
          finnedLengthMm: geomWidth,
          finPitchMm: finPitch,
          tubeExternalDiameterMm: tubeDiam,
          tubeInternalDiameterMm: Math.max(1, tubeDiam - 1),
          tubesPerRow,
          circuits,
        },
        airFlowM3H: airFlow,
        airInletTempC: airTempIn,
        airRelativeHumidity: airRH / 100,
        superheatK: superheat,
      },
      condenser: { ...DEFAULT_CONFIG.condenser, subcoolingK: subcooling },
      solver: { ...DEFAULT_CONFIG.solver, Te_initial_C: te, Tc_initial_C: tc },
    }),
    [
      refrigerantId,
      rows,
      geomHeight,
      geomWidth,
      finPitch,
      tubeDiam,
      tubesPerRow,
      circuits,
      airFlow,
      airTempIn,
      airRH,
      superheat,
      subcooling,
      te,
      tc,
    ],
  );

  const simState = useCycleSimulation(config, { mode: "manual" });
  const cycleResult: CycleResult | null =
    simState.status === "success" ? simState.result : null;

  // ── IA Chat state ──
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState("Detalhado");

  const openAI = useCallback((tabName: string) => {
    setAiTab(tabName);
    setAiOpen(true);
  }, []);

  const aiContext = useMemo<AIContext>(() => ({
    componentType: "Evaporador DX",
    tabName: aiTab,
    refrigerant: refrigerantId,
    parameters: {
      "Altura (mm)": geomHeight,
      "Largura (mm)": geomWidth,
      "Linhas": rows,
      "Tubos/linha": tubesPerRow,
      "Circuitos": circuits,
      "Passo aleta (mm)": finPitch,
      "Vazão ar (m³/h)": airFlow,
      "T entrada DB (°C)": airTempIn,
      "UR entrada (%)": airRH,
      "Te inicial (°C)": te,
      "Tc inicial (°C)": tc,
      "SH (K)": superheat,
      "SC (K)": subcooling,
    },
    results: cycleResult ? ({
      "Capacidade total (kW)": (cycleResult.Q_evap_W / 1000).toFixed(2),
      "COP": cycleResult.COP.toFixed(2),
      "Te equilíbrio (°C)": cycleResult.Te_C.toFixed(1),
      "Tc equilíbrio (°C)": cycleResult.Tc_C.toFixed(1),
      "T saída ar (°C)": cycleResult.evaporatorResult.airOutletTempC.toFixed(1),
      "ΔP ar (Pa)": cycleResult.evaporatorResult.airPressureDropPa.toFixed(0),
    } as Record<string, string>) : undefined,
    warnings: cycleResult ? enrichWarnings(cycleResult.warnings) : [],
  }), [aiTab, refrigerantId, geomHeight, geomWidth, rows, tubesPerRow, circuits, finPitch, airFlow, airTempIn, airRH, te, tc, superheat, subcooling, cycleResult]);
  const { isGenerating: isExportingPdf, exportPdf } = usePdfExport();

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    simState.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setCalcMode("verify");
    setEngineMode("v1");
    setGeomHeight(400); setGeomWidth(1200); setGeomDepth(87);
    setFinPitch(2.1); setTubeDiam(9.52); setCircuits(4);
    setRows(3); setTubesPerRow(12);
    setAirFlow(5000); setAirTempIn(25); setAirRH(60);
    setStaticPressure(0); setSafetyFactor(0);
    setRefrigerantId("R404A"); setTe(-10); setTc(40);
    setSuperheat(5); setSubcooling(5); setMassFlow(0);
    setCompressorMode("ari"); setFrequency(60); setVoltage(380);
  };

  const handleSave = () => toast.success("Projeto salvo (em memória).");
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };
  const handleExportPdf = () => {
    if (!cycleResult) {
      toast.error("Execute o cálculo antes de exportar o PDF.");
      return;
    }
    exportPdf(
      <WorkspacePdfReport
        componentType="evaporator"
        title="Evaporador DX — Unificado"
        inputs={{
          Refrigerante: refrigerantId,
          "Te inicial": `${te} °C`,
          "Tc inicial": `${tc} °C`,
          "Vazão de ar": `${airFlow.toLocaleString("pt-BR")} m³/h`,
        }}
        results={{
          "Capacidade real": `${fmt(cycleResult.Q_evap_W / 1000, 2)} kW`,
          COP: fmt(cycleResult.COP, 2),
          "Te eq": `${fmt(cycleResult.Te_C, 1)} °C`,
          "Tc eq": `${fmt(cycleResult.Tc_C, 1)} °C`,
        }}
        warnings={cycleResult.warnings}
      />,
      `evaporador-unificado-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };
  const handleExportCsv = () => toast.info("Exportação CSV em desenvolvimento.");
  const handleExportExcel = () => toast.info("Exportação Excel em desenvolvimento.");

  const badges = [refrigerantId, `Te: ${fmt(te, 0)}°C`, `Tc: ${fmt(tc, 0)}°C`];
  const isCalculating = simState.status === "running";

  // ── Sidebar ──
  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => simState.trigger()}
      onReset={handleReset}
      isCalculating={isCalculating}
    >
      <Accordion type="multiple" defaultValue={["mode", "vent", "fluid", "ops"]} className="w-full">
        {/* 1. MODO */}
        <AccordionItem value="mode">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Modo de Cálculo
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
              <RadioGroup
                value={calcMode}
                onValueChange={(v) => setCalcMode(v as CalcMode)}
                className="mt-1 flex gap-3"
              >
                <label className="flex items-center gap-1.5 text-xs">
                  <RadioGroupItem value="verify" /> Verificar
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <RadioGroupItem value="design" /> Desenho
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Motor</Label>
              <RadioGroup
                value={engineMode}
                onValueChange={(v) => setEngineMode(v as EngineMode)}
                className="mt-1 flex flex-col gap-1"
              >
                <label className="flex items-center gap-1.5 text-xs">
                  <RadioGroupItem value="v1" /> V1 NTU-ε
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <RadioGroupItem value="v2" /> V2 ASHRAE
                </label>
              </RadioGroup>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. GEOMETRIA */}
        <AccordionItem value="geom">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Geometria do Aletado
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumField label="Altura (mm)" value={geomHeight} onChange={setGeomHeight} />
            <NumField label="Largura (mm)" value={geomWidth} onChange={setGeomWidth} />
            <NumField label="Profundidade (mm)" value={geomDepth} onChange={setGeomDepth} />
            <NumField label="Passo de aleta (mm)" value={finPitch} step={0.1} onChange={setFinPitch} />
            <NumField label="Diâmetro do tubo (mm)" value={tubeDiam} step={0.01} onChange={setTubeDiam} />
            <NumField label="Nº de circuitos" value={circuits} onChange={setCircuits} />
            <NumField label="Linhas de tubos" value={rows} onChange={setRows} />
            <NumField label="Tubos por linha" value={tubesPerRow} onChange={setTubesPerRow} />
            <Button size="sm" variant="outline" className="w-full h-8 text-xs">
              Configurar Geometria…
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 3. VENTILAÇÃO */}
        <AccordionItem value="vent">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Lado Ventilação
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumField label="Vazão de ar (m³/h)" value={airFlow} onChange={setAirFlow} />
            <NumField label="Temp. entrada DB (°C)" value={airTempIn} step={0.5} onChange={setAirTempIn} />
            <NumField label="UR entrada (%)" value={airRH} onChange={setAirRH} />
            <div>
              <Label className="text-[10px] text-muted-foreground">Ventilador</Label>
              <Select value={fanMode} onValueChange={(v) => setFanMode(v as "manual" | "catalog")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="catalog">Selecionar catálogo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Velocidade frontal (m/s)</Label>
              <Input readOnly value={fmt(frontalVelocity, 2)} className="h-8 text-xs bg-muted/40" />
            </div>
            <NumField label="Pressão estática (Pa)" value={staticPressure} onChange={setStaticPressure} />
            <NumField label="Fator de segurança (%)" value={safetyFactor} onChange={setSafetyFactor} />
          </AccordionContent>
        </AccordionItem>

        {/* 4. FLUIDO */}
        <AccordionItem value="fluid">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Lado Fluido / Refrigerante
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Fluido</Label>
              <Select value={refrigerantId} onValueChange={setRefrigerantId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REFRIGERANT_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={() => setCompressorPickerOpen(true)}
            >
              Selecionar compressor…
            </Button>
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <Label>Te</Label>
                <span className="font-mono text-foreground">{fmt(te, 1)} °C</span>
              </div>
              <Slider value={[te]} min={-40} max={15} step={1} onValueChange={(v) => setTe(v[0])} />
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <Label>Tc</Label>
                <span className="font-mono text-foreground">{fmt(tc, 1)} °C</span>
              </div>
              <Slider value={[tc]} min={20} max={60} step={1} onValueChange={(v) => setTc(v[0])} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="SH (K)" value={superheat} onChange={setSuperheat} />
              <NumField label="SC (K)" value={subcooling} onChange={setSubcooling} />
            </div>
            <NumField label="Vazão fluido (kg/h)" value={massFlow} onChange={setMassFlow} />
          </AccordionContent>
        </AccordionItem>

        {/* 5. OPERAÇÃO */}
        <AccordionItem value="ops">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Condições Operacionais
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <div className="flex gap-1">
              {(["ari", "constant", "manual"] as CompressorMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={compressorMode === m ? "default" : "outline"}
                  className="flex-1 h-7 text-[10px] px-1"
                  onClick={() => setCompressorMode(m)}
                >
                  {m === "ari" ? "ARI 540" : m === "constant" ? "Const." : "Manual"}
                </Button>
              ))}
            </div>
            <NumField label="Frequência (Hz)" value={frequency} onChange={setFrequency} />
            <NumField label="Tensão (V)" value={voltage} onChange={setVoltage} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </WorkspaceInputsSidebar>
  );

  const header = (
    <WorkspaceHeader
      title="Evaporador DX — Ciclo de Refrigeração"
      icon={<Snowflake className="h-5 w-5" />}
      badges={badges}
      onSave={handleSave}
      onShare={handleShare}
      onExportPdf={handleExportPdf}
      isExportingPdf={isExportingPdf}
    />
  );

  return (
    <WorkspaceLayout header={header} sidebar={sidebar}>
      <div className="flex h-full flex-col">
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
          {isCalculating && !cycleResult ? (
            <LoadingResults />
          ) : simState.status === "error" ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
              <p className="font-semibold text-red-500">Erro no CycleEngine</p>
              <p className="mt-2 text-sm text-muted-foreground">{simState.message}</p>
            </div>
          ) : (
            <UnifiedTabs
              config={config}
              cycleResult={cycleResult}
              frontalVelocity={frontalVelocity}
              safetyFactor={safetyFactor}
              onExportPdf={handleExportPdf}
              isExportingPdf={isExportingPdf}
              onOpenAI={openAI}
              geomHeight={geomHeight}
              geomWidth={geomWidth}
              geomDepth={geomDepth}
              rows={rows}
              tubesPerRow={tubesPerRow}
              tubeDiam={tubeDiam}
              finPitch={finPitch}
              circuits={circuits}
              refrigerantId={refrigerantId}
            />
          )}
          </div>
          {aiOpen && (
            <div className="w-80 shrink-0 overflow-hidden">
              <WorkspaceAIChat
                context={aiContext}
                isOpen={aiOpen}
                onClose={() => setAiOpen(false)}
              />
            </div>
          )}
        </div>

        <ActionBar
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          onShare={handleShare}
          hasResults={!!cycleResult}
          isExportingPdf={isExportingPdf}
        />
      </div>

      <CompressorPickerModal
        open={compressorPickerOpen}
        onClose={() => setCompressorPickerOpen(false)}
      />
    </WorkspaceLayout>
  );
}

// ── NumField helper ─────────────────────────────────────────────────────────
function NumField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-xs"
      />
    </div>
  );
}

function LoadingResults() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function UnifiedTabs({
  config,
  cycleResult,
  frontalVelocity,
  safetyFactor,
  onExportPdf,
  isExportingPdf,
  onOpenAI,
  geomHeight,
  geomWidth,
  geomDepth,
  rows,
  tubesPerRow,
  tubeDiam,
  finPitch,
  circuits,
  refrigerantId,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult | null;
  frontalVelocity: number;
  safetyFactor: number;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onOpenAI: (tabName: string) => void;
  geomHeight: number;
  geomWidth: number;
  geomDepth: number;
  rows: number;
  tubesPerRow: number;
  tubeDiam: number;
  finPitch: number;
  circuits: number;
  refrigerantId: string;
}) {
  const enrichedWarnings = useMemo(
    () => (cycleResult ? enrichWarnings(cycleResult.warnings) : []),
    [cycleResult],
  );
  const hasErrors = enrichedWarnings.some((w) => w.severity === "error");

  // Botão IA reutilizável por aba
  function AIButton({ tab }: { tab: string }) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
        onClick={() => onOpenAI(tab)}
      >
        <Bot className="h-3.5 w-3.5" />
        IA Especialista
      </Button>
    );
  }

  return (
    <Tabs defaultValue={WORKSPACE_TABS.DETAILED} className="w-full">
      <TabsList className="flex w-full overflow-x-auto whitespace-nowrap scrollbar-none pb-px h-auto">
        {/* Aba Detalhado — PRIMEIRA, em vermelho como fonte da verdade */}
        <TabsTrigger
          value={WORKSPACE_TABS.DETAILED}
          className="shrink-0 text-xs font-semibold data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:text-red-500 data-[state=inactive]:border-red-500/40"
        >
          🏭 Detalhado
          {hasErrors && (
            <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-red-500 data-[state=active]:bg-white" />
          )}
        </TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.RESULTS} className="shrink-0 text-xs">📋 Resultados</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.CYCLE_PH} className="shrink-0 text-xs">🔄 Ciclo P-H</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.ENVELOPE} className="shrink-0 text-xs">📊 Envelope Q×Te</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.GEADA} className="shrink-0 text-xs">❄️ Geada</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.GEADA_AVANCADA} className="shrink-0 text-xs">🧊 Geada Avançada</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.MAPA_OPERACIONAL} className="shrink-0 text-xs">📈 Mapa Operacional</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.INCERTEZA} className="shrink-0 text-xs">📐 Incerteza</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.OTIMIZACAO} className="shrink-0 text-xs">⚙️ Otimização</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.SERIE} className="shrink-0 text-xs">🔗 Série</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.DESENHO} className="shrink-0 text-xs font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white">🏗️ Desenho</TabsTrigger>
        <TabsTrigger value={WORKSPACE_TABS.RELATORIO} className="shrink-0 text-xs">📄 Relatório</TabsTrigger>
      </TabsList>

      <TabsContent value={WORKSPACE_TABS.RESULTS} className="mt-3">
        {cycleResult ? (
          <ResultsGrid
            config={config}
            result={cycleResult}
            frontalVelocity={frontalVelocity}
            safetyFactor={safetyFactor}
          />
        ) : (
          <EmptyState />
        )}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.CYCLE_PH} className="mt-3">
        {cycleResult ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <CyclePHDiagram
                result={cycleResult}
                refrigerantId={config.refrigerantId}
                width={620}
                height={360}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ResultCard label="Te" value={fmt(cycleResult.Te_C, 1)} unit="°C" />
              <ResultCard label="Tc" value={fmt(cycleResult.Tc_C, 1)} unit="°C" />
              <ResultCard label="COP" value={fmt(cycleResult.COP, 2)} variant="success" />
              <ResultCard
                label="EER"
                value={fmt(cycleResult.COP * 3.412, 2)}
                unit="BTU/W·h"
              />
            </div>
          </div>
        ) : <EmptyState />}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.ENVELOPE} className="mt-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <CoilEnvelopeTab equipmentId={config.id} />
        </div>
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.GEADA} className="mt-3">
        {cycleResult ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <FrostAnalysisTab
              Te={cycleResult.Te_C}
              Tair_in={config.evaporator.airInletTempC}
              RH={config.evaporator.airRelativeHumidity}
              Q_nominal={cycleResult.Q_evap_W}
              geometry={config.id}
            />
          </div>
        ) : <EmptyState />}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.GEADA_AVANCADA} className="mt-3">
        {cycleResult ? <FrostTab config={config} cycleResult={cycleResult} /> : <EmptyState />}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.MAPA_OPERACIONAL} className="mt-3">
        {cycleResult ? <OperatingMapTab config={config} cycleResult={cycleResult} /> : <EmptyState />}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.INCERTEZA} className="mt-3">
        {cycleResult ? <UncertaintyTab config={config} cycleResult={cycleResult} /> : <EmptyState />}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.OTIMIZACAO} className="mt-3">
        {cycleResult ? <OptimizationTab config={config} cycleResult={cycleResult} /> : <EmptyState />}
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.SERIE} className="mt-3">
        {cycleResult ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <CoilsInSeriesPanel
              primaryCoilResult={{
                deltaP_Pa: cycleResult.evaporatorResult.airPressureDropPa,
                Q_kcalh: cycleResult.evaporatorResult.totalCapacityW * 0.86,
                T_ar_saida: cycleResult.evaporatorResult.airOutletTempC,
              }}
            />
          </div>
        ) : <EmptyState />}
      </TabsContent>

      {/* ── Aba Detalhado — PRIMEIRA, fonte da verdade ── */}
      <TabsContent value={WORKSPACE_TABS.DETAILED} className="mt-3">
        <div className="space-y-3">
          <div className="flex justify-end">
            <AIButton tab="Detalhado" />
          </div>
          <DetailedWorkspacePanel />
        </div>
      </TabsContent>

      <TabsContent value={WORKSPACE_TABS.DESENHO} className="mt-3">
        <DrawingTab
          heightMm={geomHeight}
          widthMm={geomWidth}
          depthMm={geomDepth}
          rows={rows}
          tubesPerRow={tubesPerRow}
          tubeOuterDiamMm={tubeDiam}
          finPitchMm={finPitch}
          circuits={circuits}
          refrigerantId={refrigerantId}
          cycleResult={cycleResult}
          projectName={`Evaporador DX — ${refrigerantId}`}
        />
      </TabsContent>
      <TabsContent value={WORKSPACE_TABS.RELATORIO} className="mt-3">
        <ReportTab
          config={config}
          result={cycleResult}
          frontalVelocity={frontalVelocity}
          safetyFactor={safetyFactor}
          onExportPdf={onExportPdf}
          isExportingPdf={isExportingPdf}
          onOpenAI={() => onOpenAI("Relatório")}
        />
      </TabsContent>
    </Tabs>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Calculator className="h-12 w-12 opacity-30" />
      <p className="text-sm">Configure os parâmetros e clique em <strong>Calcular</strong></p>
    </div>
  );
}

// ── Tab 1: Results Grid (20 cards) ──────────────────────────────────────────
function ResultsGrid({
  config,
  result,
  frontalVelocity,
  safetyFactor,
}: {
  config: CycleSystemConfig;
  result: CycleResult;
  frontalVelocity: number;
  safetyFactor: number;
}) {
  const evap = result.evaporatorResult;
  const Q_total_kW = evap.totalCapacityW / 1000;
  const Q_sens_kW = evap.sensibleCapacityW / 1000;
  const Q_lat_kW = evap.latentCapacityW / 1000;
  const SHR = evap.totalCapacityW > 0 ? evap.sensibleCapacityW / evap.totalCapacityW : 0;
  const EER = result.COP * 3.412;
  const area = evaporatorAreaM2(config);
  const dT_LMTD = Math.max(1, config.evaporator.airInletTempC - result.Te_C);
  const UA = evap.totalCapacityW / dT_LMTD;
  const NTU = UA / Math.max(1, ((config.evaporator.airFlowM3H * 1.2) / 3600) * 1005);
  const effectiveness = 1 - Math.exp(-NTU);

  // WB approx (simple psychrometric estimate)
  const Twb_out = evap.airOutletTempC - 1.5;

  const v_fluid = result.m_dot_kgS / 50; // rough placeholder

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <ResultCard label="Capacidade Total" value={fmt(Q_total_kW, 2)} unit="kW" hint={`${fmt(Q_total_kW * 860, 0)} kcal/h`} variant="success" />
      <ResultCard label="Cap. Sensível" value={fmt(Q_sens_kW, 2)} unit="kW" />
      <ResultCard label="Cap. Latente" value={fmt(Q_lat_kW, 2)} unit="kW" />
      <ResultCard label="SHR" value={fmt(SHR, 3)} hint="Sensible Heat Ratio" />
      <ResultCard label="COP" value={fmt(result.COP, 2)} variant="success" />
      <ResultCard label="EER" value={fmt(EER, 2)} unit="BTU/W·h" />
      <ResultCard label="Te equilíbrio" value={fmt(result.Te_C, 1)} unit="°C" />
      <ResultCard label="Tc equilíbrio" value={fmt(result.Tc_C, 1)} unit="°C" />
      <ResultCard label="T saída ar (DB)" value={fmt(evap.airOutletTempC, 1)} unit="°C" />
      <ResultCard label="UR saída" value={fmt(evap.airOutletRH * 100, 1)} unit="%" />
      <ResultCard label="T saída ar (WB)" value={fmt(Twb_out, 1)} unit="°C" />
      <ResultCard label="Vel. frontal" value={fmt(frontalVelocity, 2)} unit="m/s" />
      <ResultCard label="ΔP ar" value={fmt(evap.airPressureDropPa, 0)} unit="Pa" />
      <ResultCard label="Vel. fluido" value={fmt(v_fluid, 2)} unit="m/s" />
      <ResultCard label="ΔP fluido" value={fmt(evap.fluidPressureDropKPa, 2)} unit="kPa" />
      <ResultCard label="Superfície troca" value={fmt(area, 2)} unit="m²" />
      <ResultCard label="UA" value={fmt(UA, 0)} unit="W/K" />
      <ResultCard label="NTU" value={fmt(NTU, 2)} />
      <ResultCard label="Efetividade" value={fmt(effectiveness * 100, 1)} unit="%" />
      <ResultCard label="Fator segurança" value={fmt(safetyFactor, 0)} unit="%" />
    </div>
  );
}

// ── Tab 11: Report ──────────────────────────────────────────────────────────
function ReportTab({
  config,
  result,
  frontalVelocity,
  safetyFactor,
  onExportPdf,
  isExportingPdf,
  onOpenAI,
}: {
  config: CycleSystemConfig;
  result: CycleResult | null;
  frontalVelocity: number;
  safetyFactor: number;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onOpenAI?: () => void;
}) {
  const [projectName, setProjectName] = useState("Projeto Evaporador DX");
  const date = new Date().toLocaleDateString("pt-BR");
  const p = config.evaporator.physical;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <Label className="text-xs text-muted-foreground">Nome do projeto</Label>
          <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        </div>
        <Badge variant="secondary">{date}</Badge>
        {onOpenAI && (
          <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10" onClick={onOpenAI}>
            <Bot className="h-3.5 w-3.5" />
            IA Especialista
          </Button>
        )}
        <Button onClick={onExportPdf} disabled={isExportingPdf || !result}>
          📄 Exportar PDF
        </Button>
      </div>

      {result ? (
        <>
          <ResultsGrid
            config={config}
            result={result}
            frontalVelocity={frontalVelocity}
            safetyFactor={safetyFactor}
          />

          <div className="rounded-lg border border-border bg-background p-4">
            <h3 className="mb-2 text-sm font-semibold">Diagrama P-H</h3>
            <CyclePHDiagram
              result={result}
              refrigerantId={config.refrigerantId}
              width={620}
              height={360}
            />
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <h3 className="mb-2 text-sm font-semibold">Geometria</h3>
            <table className="w-full text-xs">
              <tbody>
                <Row k="Linhas" v={p.rows} />
                <Row k="Tubos por linha" v={p.tubesPerRow} />
                <Row k="Circuitos" v={p.circuits} />
                <Row k="Altura (mm)" v={p.finnedHeightMm} />
                <Row k="Largura (mm)" v={p.finnedLengthMm} />
                <Row k="Passo aleta (mm)" v={p.finPitchMm} />
                <Row k="Diâmetro tubo ext. (mm)" v={p.tubeExternalDiameterMm} />
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: number | string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-1 text-muted-foreground">{k}</td>
      <td className="py-1 text-right font-mono">{v}</td>
    </tr>
  );
}

// ── Helpers (reuse logic from CycleWorkspacePage) ───────────────────────────
function buildEvaporatorInputs(config: CycleSystemConfig, mDot: number): CoilCycleInputs {
  return {
    ...config.evaporator,
    refrigerantId: config.refrigerantId,
    evaporatingTempC: config.solver?.Te_initial_C ?? -10,
    condensingTempC: config.solver?.Tc_initial_C ?? 40,
    refrigerantMassFlowKgS: mDot,
    componentType: "evaporator",
  };
}

function buildEvaporatorNominal(result: CycleResult): CoilCycleResult {
  return {
    totalCapacityW: result.evaporatorResult.totalCapacityW,
    sensibleCapacityW: result.evaporatorResult.sensibleCapacityW,
    latentCapacityW: result.evaporatorResult.latentCapacityW,
    airOutletTempC: result.evaporatorResult.airOutletTempC,
    airOutletRH: result.evaporatorResult.airOutletRH,
    airPressureDropPa: result.evaporatorResult.airPressureDropPa,
    fluidPressureDropKPa: result.evaporatorResult.fluidPressureDropKPa,
    overallU_WM2K: result.evaporatorResult.overallU_WM2K,
    safetyFactor: result.evaporatorResult.safetyFactor,
    refrigerantOutletTempC: result.Te_C,
    inletQuality: result.statePoints.point4_valveOut.quality,
    warnings: result.warnings,
    success: true,
  };
}

function evaporatorAreaM2(config: CycleSystemConfig): number {
  const p = config.evaporator.physical;
  return (
    p.rows *
    (p.finnedLengthMm / 1000) *
    (p.finnedHeightMm / 1000) *
    p.tubesPerRow *
    Math.PI *
    (p.tubeExternalDiameterMm / 1000)
  );
}

function UncertaintyTab({ config, cycleResult }: { config: CycleSystemConfig; cycleResult: CycleResult }) {
  const inputs = useMemo(() => buildEvaporatorInputs(config, cycleResult.m_dot_kgS), [config, cycleResult.m_dot_kgS]);
  const nominal = useMemo(() => buildEvaporatorNominal(cycleResult), [cycleResult]);
  const { result, isLoading } = useUncertaintyAnalysis({
    inputs,
    nominalResult: nominal,
    debounceMs: 1500,
    enabled: true,
    config: { samples: 200 },
  });
  if (isLoading || !result) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="animate-pulse text-sm text-muted-foreground">
          Calculando intervalos de confiança…
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Bandas de incerteza nominais</h3>
        <UncertaintyBadge band={result.totalCapacityW} format={(v) => fmt(v / 1000, 2)} unit="kW" />
      </div>
      <UncertaintyPanel result={result} isLoading={false} />
    </div>
  );
}

function FrostTab({ config, cycleResult }: { config: CycleSystemConfig; cycleResult: CycleResult }) {
  const operationTimeH = 6;
  const frost = useFrostAnalysis({
    cycleResult,
    refrigerantId: config.refrigerantId,
    airInletTempC: config.evaporator.airInletTempC,
    airRelativeHumidity: config.evaporator.airRelativeHumidity,
    airMassFlowKgS: (config.evaporator.airFlowM3H * 1.2) / 3600,
    evaporatorExternalAreaM2: evaporatorAreaM2(config),
    config: { operationTimeH, defrostMethod: "electric" },
  });
  if (!frost) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Análise de geada disponível apenas com ciclo convergido.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <FrostAnalysisPanel result={frost} nominalCapacityW={cycleResult.Q_evap_W} operationTimeH={operationTimeH} />
    </div>
  );
}

function OperatingMapTab({ config, cycleResult }: { config: CycleSystemConfig; cycleResult: CycleResult }) {
  const baseInputs = useMemo(() => buildEvaporatorInputs(config, cycleResult.m_dot_kgS), [config, cycleResult.m_dot_kgS]);
  const { result, isLoading, error, generate } = useOperatingMap(baseInputs);
  useEffect(() => {
    generate({
      evapTempRange: { min: -30, max: 5, step: 5 },
      condensingTemps: [40, 45, 50, 55],
      airInletTempC: config.evaporator.airInletTempC,
      airFlowM3H: config.evaporator.airFlowM3H,
      designPoint: { evapTempC: cycleResult.Te_C, condensingTempC: cycleResult.Tc_C, capacityW: cycleResult.Q_evap_W },
    });
  }, [generate, config, cycleResult.Te_C, cycleResult.Tc_C, cycleResult.Q_evap_W]);
  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>;
  if (isLoading || !result) {
    return <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground animate-pulse">Gerando mapa…</div>;
  }
  return <div className="rounded-lg border border-border bg-card p-4"><OperatingMapChart result={result} /></div>;
}

function OptimizationTab({ config, cycleResult }: { config: CycleSystemConfig; cycleResult: CycleResult }) {
  const baseInputs = useMemo(() => buildEvaporatorInputs(config, cycleResult.m_dot_kgS), [config, cycleResult.m_dot_kgS]);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <OptimizationPanel
        baseInputs={baseInputs}
        currentCapacityW={cycleResult.Q_evap_W}
        onApplyGeometry={() => {}}
      />
    </div>
  );
}
