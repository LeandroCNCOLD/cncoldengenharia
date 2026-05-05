/**
 * CondenserWorkspacePage
 * ─────────────────────────────────────────────────────────────────────────────
 * Workspace do Condensador a Ar — segue o padrão do EvaporatorUnifiedWorkspacePage.
 *
 * Layout:
 *  - Sidebar esquerda (WorkspaceInputsSidebar + Accordion)
 *  - Área principal com abas:
 *      Detalhado | Resultados | Ciclo P-H | Envelope Q×Tc | Geada | Mapa Operacional | Desenho | Relatório
 *  - Aba Detalhado: 3 colunas (WorkspaceSidebar + AirSidePanel + FluidSidePanel)
 *  - Aba Desenho: DrawingTab com 6 modos de visualização
 *  - Aba Ciclo P-H: CyclePHDiagram com curvas de saturação
 *
 * Motor:
 *  - V1 (NTU-ε legado via adapter) e V2 (ASHRAE wet-coil)
 *  - Ciclo completo via useCycleSimulation (CycleEngine)
 *  - useCondenserSimulation para cálculo standalone do condensador
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Thermometer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { ResultCard } from "../components/ResultCard";
import { ResultPanel } from "../components/ResultPanel";
import { ActionBar } from "../components/ActionBar";
import { ProjectHeaderBar } from "../components/ProjectHeaderBar";
import { CyclePHDiagram } from "../components/CyclePHDiagram";
import { CoilEnvelopeTab } from "../components/CoilEnvelopeTab";
import { OperatingMapChart } from "../components/OperatingMapChart";
import { CompressorPickerModal } from "../components/CompressorPickerModal";
import { FanPickerModal } from "../components/FanPickerModal";
import { useCnCoilsCatalogs as useCnCoilsFullCatalogs } from "../hooks/useCnCoilsCatalogCollection";
import { useEnrichedFanPickerItems } from "../hooks/useEnrichedFanPickerItems";
import { PostSaveNextStepDialog } from "../components/PostSaveNextStepDialog";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { DrawingTab } from "../components/drawing/DrawingTab";
import { WorkspaceAIChat } from "../components/WorkspaceAIChat";
import { AirSidePanel } from "../components/AirSidePanel";
import { FluidSidePanel } from "../components/FluidSidePanel";
import { GeometryBottomBar } from "../components/GeometryBottomBar";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { useCnCoilsCatalogs } from "../hooks/useCnCoilsCatalogs";
import { useCnCoilsSimulation } from "../hooks/useCnCoilsSimulation";
import { useCnCoilsSimulationV2 } from "../hooks/useCnCoilsSimulationV2";
import { enrichWarnings } from "../utils/warningEnricher";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { useCnCoilsInputBridge } from "../hooks/useCnCoilsInputBridge";
import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { useOperatingMap } from "../hooks/useOperatingMap";
import { useUncertaintyAnalysis } from "../hooks/useUncertaintyAnalysis";
import { OptimizationPanel } from "../components/OptimizationPanel";
import { UncertaintyPanel, UncertaintyBadge } from "../components/UncertaintyBadge";
import { useUnitStore, convertCapacity } from "../store/useUnitStore";
import type { CoilCycleInputs, CoilCycleResult } from "../engines/coil/coilCycleAdapter";
import type { OperatingMapConfig } from "../engines/operatingMap/operatingMapTypes";
import { usePdfExport } from "../hooks/usePdfExport";
import { useCondenserSimulation, type CondenserInputs } from "../hooks/useCondenserSimulation";
import { useCondenserEnvelopeGenerator } from "../hooks/useCondenserEnvelopeGenerator";
import { getCompressorById } from "@/modules/coldpro_catalog/data/compressorCatalog.service";
import type { CompressorCatalogRow } from "@/modules/coldpro_catalog/data/compressorCatalog.types";
import type { AIContext } from "../components/WorkspaceAIChat";
import type { EnrichedWarning } from "../utils/warningEnricher";
import type { CycleResult, CycleSystemConfig } from "../engines/cycle/cycleTypes";

// ── Tipos ────────────────────────────────────────────────────────────────────
type CalcMode = "verify" | "design";
type EngineMode = "v1" | "v2";
type CompressorMode = "ari" | "constant" | "manual";

// ── Constantes ───────────────────────────────────────────────────────────────
const REFRIGERANT_OPTIONS = [
  "R404A", "R22", "R134a", "R410A", "R507", "R448A", "R449A",
  "R32", "R290", "R600a", "R717", "R744", "R1234yf",
];

const fmt = (v: number, d = 2) =>
  Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";

const DEFAULT_CONFIG: CycleSystemConfig = {
  id: "cond-air-01",
  name: "Condensador a Ar",
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
      finnedLengthMm: 1200,
      finnedHeightMm: 600,
      finPitchMm: 2.5,
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
    Tc_initial_C: 45,
    tolerance: 0.01,
    maxIterations: 30,
    relaxation: 0.4,
  },
};

// ── Tabs ─────────────────────────────────────────────────────────────────────
export const CONDENSER_TABS = {
  DETAILED: "detalhado",
  RESULTS: "resultados",
  CYCLE_PH: "ciclo_ph",
  ENVELOPE: "envelope_q_tc",
  GEADA: "geada",
  MAPA_OPERACIONAL: "mapa_operacional",
  INCERTEZA: "incerteza",
  OTIMIZACAO: "otimizacao",
  DESENHO: "desenho",
  RELATORIO: "relatorio",
} as const;

// ── Componente principal ─────────────────────────────────────────────────────
export function CondenserWorkspacePage() {
  // ── Modo ──
  const [calcMode, setCalcMode] = useState<CalcMode>("verify");
  const [engineMode, setEngineMode] = useState<EngineMode>("v1");

  // ── Geometria ──
  const [geomHeight, setGeomHeight] = useState(600);
  const [geomWidth, setGeomWidth] = useState(1200);
  const [geomDepth, setGeomDepth] = useState(64);
  const [finPitch, setFinPitch] = useState(2.5);
  const [tubeDiam, setTubeDiam] = useState(9.52);
  const [circuits, setCircuits] = useState(4);
  const [rows, setRows] = useState(2);
  const [tubesPerRow, setTubesPerRow] = useState(24);

  // ── Ventilação ──
  const [airFlow, setAirFlow] = useState(8000);
  const [airTempIn, setAirTempIn] = useState(32);
  const [airRH, setAirRH] = useState(50);
  const [staticPressure, setStaticPressure] = useState(0);
  const [safetyFactor, setSafetyFactor] = useState(0);

  // ── Fluido / Ciclo ──
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(45);
  const [superheat, setSuperheat] = useState(5);
  const [subcooling, setSubcooling] = useState(5);
  const [massFlow, setMassFlow] = useState(0);

  // ── Ventilador (picker) ──
  const [fanPickerOpen, setFanPickerOpen] = useState(false);
  const fullCatalogs = useCnCoilsFullCatalogs();
  // Biblioteca enriquecida (EBM-Papst etc.) — fabricante, série, motor, diâmetro
  const { items: fanPickerItems } = useEnrichedFanPickerItems();
  

  // ── Compressor ──
  const [compressorPickerOpen, setCompressorPickerOpen] = useState(false);
  const [nextStepOpen, setNextStepOpen] = useState(false);
  const [compressorMode, setCompressorMode] = useState<CompressorMode>("ari");
  const [frequency, setFrequency] = useState(60);
  const [voltage, setVoltage] = useState(380);
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);
  const [selectedCompressorRow, setSelectedCompressorRow] = useState<CompressorCatalogRow | null>(null);
  useEffect(() => {
    if (!selectedCompressorId) { setSelectedCompressorRow(null); return; }
    let cancelled = false;
    void getCompressorById(selectedCompressorId).then((row) => {
      if (!cancelled) setSelectedCompressorRow(row ?? null);
    });
    return () => { cancelled = true; };
  }, [selectedCompressorId]);

  // ── Catálogos ──
  const catalogs = useCnCoilsCatalogs();

  // ── Sincroniza store ──
  useCnCoilsInputBridge("condenser_air");
  useEffect(() => {
    const store = useCnCoilsSimulationStore.getState();
    store.setPhysicalInputs({
      componentType: "condenser_air",
      finnedHeightMm: geomHeight,
      finnedLengthMm: geomWidth,
      rows,
      tubesPerRow,
      circuits,
      finPitchMm: finPitch,
      tubeOuterDiameterMm: tubeDiam,
      tubeInnerDiameterMm: Math.max(1, tubeDiam - 1),
    });
    store.setAirFlow(airFlow);
    store.setTempInDB(airTempIn);
    store.setRhIn(airRH);
    store.setFluid(refrigerantId);
    store.setFluidOperatingTemp(tc);
    store.setPairedTempC(te); // Te para condensador ("paired temp" = temp. evaporação)
    store.setSuperheat(superheat);
    store.setSubcooling(subcooling);
    store.setFluidMassFlow(massFlow);
    store.setCalcMode(calcMode);
    store.setEngineVersion(engineMode);
  }, [
    airFlow, airRH, airTempIn, calcMode, circuits, engineMode,
    finPitch, geomHeight, geomWidth, massFlow, refrigerantId,
    rows, subcooling, superheat, tc, te, tubeDiam, tubesPerRow,
  ]);

  // ── Velocidade frontal ──
  const frontalVelocity = useMemo(() => {
    const area = (geomHeight / 1000) * (geomWidth / 1000);
    if (area <= 0) return 0;
    return airFlow / 3600 / area;
  }, [airFlow, geomHeight, geomWidth]);

  // ── Config para CycleEngine ──
  const config = useMemo<CycleSystemConfig>(
    () => ({
      ...DEFAULT_CONFIG,
      refrigerantId,
      compressor: selectedCompressorRow
        ? {
            id: selectedCompressorRow.id,
            model: selectedCompressorRow.model,
            manufacturer: selectedCompressorRow.manufacturer,
            refrigerant: refrigerantId,
            modelType: "constant_efficiency" as const,
            constantEfficiency: {
              eta_vol: 0.78,
              eta_is: 0.68,
              displacement_m3h:
                selectedCompressorRow.nominal_displacement_cm3 && selectedCompressorRow.nominal_rpm
                  ? (selectedCompressorRow.nominal_displacement_cm3 * selectedCompressorRow.nominal_rpm * 60) / 1e6
                  : selectedCompressorRow.nominal_cooling_capacity_w
                    ? Math.max(2, selectedCompressorRow.nominal_cooling_capacity_w / 2500)
                    : 8,
            },
          }
        : { ...DEFAULT_CONFIG.compressor, refrigerant: refrigerantId },
      evaporator: {
        ...DEFAULT_CONFIG.evaporator,
        superheatK: superheat,
      },
      condenser: {
        ...DEFAULT_CONFIG.condenser,
        physical: {
          ...DEFAULT_CONFIG.condenser.physical,
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
        subcoolingK: subcooling,
      },
      solver: { ...DEFAULT_CONFIG.solver, Te_initial_C: te, Tc_initial_C: tc },
    }),
    [
      refrigerantId, rows, geomHeight, geomWidth, finPitch, tubeDiam,
      tubesPerRow, circuits, airFlow, airTempIn, airRH, superheat,
      subcooling, te, tc, selectedCompressorRow,
    ],
  );

  // ── CycleEngine ──
  const simState = useCycleSimulation(config, { mode: "manual" });
  const cycleResult: CycleResult | null =
    simState.status === "success" ? simState.result : null;

  // ── Motor CN Coils (standalone) ──
  const result = useCnCoilsSimulationStore((s) => s.result);
  const isSimulating = simState.status === "running";

  // ── Condensador standalone (para envelope) ──
  const physicalGeometryId = useCnCoilsSimulationStore((s) => s.physicalInputs.geometryId);
  const condenserInputs = useMemo<CondenserInputs>(() => ({
    Tc: tc,
    Tair_in: airTempIn,
    geometryId: physicalGeometryId ?? "",
    refrigerant: refrigerantId,
    subcooling,
    fanCount: 1,
    fanId: "",
    airFlowM3H: airFlow,
    rows,
    circuits,
    finnedHeightMm: geomHeight,
    finnedLengthMm: geomWidth,
    finPitchMm: finPitch,
  }), [tc, airTempIn, physicalGeometryId, refrigerantId, subcooling, airFlow, rows, circuits, geomHeight, geomWidth, finPitch]);

  const condenserSim = useCondenserSimulation({
    inputs: condenserInputs,
    geometries: catalogs.geometries,
    tubeMaterials: catalogs.tubeMaterials,
  });

  const { generateEnvelope, saveToStore, isGenerating: isGeneratingEnvelope, points: envelopePoints } =
    useCondenserEnvelopeGenerator({
      inputs: condenserInputs,
      calculate: condenserSim.calculateSnapshot,
    });

  // ── IA Chat ──
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState("Detalhado");
  const openAI = useCallback((tabName: string) => {
    setAiTab(tabName);
    setAiOpen(true);
  }, []);
  const aiContext = useMemo<AIContext>(() => ({
    componentType: "Condensador a Ar",
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
      "Capacidade cond. (kW)": fmt(cycleResult.Q_cond_W / 1000, 2),
      "COP": cycleResult.COP.toFixed(2),
      "Te equilíbrio (°C)": cycleResult.Te_C.toFixed(1),
      "Tc equilíbrio (°C)": cycleResult.Tc_C.toFixed(1),
      "T saída ar (°C)": cycleResult.condenserResult.airOutletTempC.toFixed(1),
      "ΔP ar (Pa)": cycleResult.condenserResult.airPressureDropPa.toFixed(0),
    } as Record<string, string>) : undefined,
    warnings: cycleResult ? cycleResult.warnings.map((w): EnrichedWarning => ({
      raw: w,
      severity: "info",
      title: w,
      explanation: "",
      suggestion: "",
    })) : [],
  }), [aiTab, refrigerantId, geomHeight, geomWidth, rows, tubesPerRow, circuits, finPitch, airFlow, airTempIn, airRH, te, tc, superheat, subcooling, cycleResult]);

  // ── PDF ──
  const { isGenerating: isExportingPdf, exportPdf } = usePdfExport();

  // ── Handlers ──
  const handleReset = () => {
    setCalcMode("verify"); setEngineMode("v1");
    setGeomHeight(600); setGeomWidth(1200); setGeomDepth(64);
    setFinPitch(2.5); setTubeDiam(9.52); setCircuits(4);
    setRows(2); setTubesPerRow(24);
    setAirFlow(8000); setAirTempIn(32); setAirRH(50);
    setStaticPressure(0); setSafetyFactor(0);
    setRefrigerantId("R404A"); setTe(-10); setTc(45);
    setSuperheat(5); setSubcooling(5); setMassFlow(0);
    setCompressorMode("ari"); setFrequency(60); setVoltage(380);
  };
  const handleSave = () => {
    toast.success("Projeto salvo (em memória).");
    setNextStepOpen(true);
  };
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
        componentType="condenser_air"
        title="Condensador a Ar"
        inputs={{
          Refrigerante: refrigerantId,
          "Te inicial": `${te} °C`,
          "Tc inicial": `${tc} °C`,
          "Vazão de ar": `${airFlow.toLocaleString("pt-BR")} m³/h`,
        }}
        results={{
          "Capacidade cond. (kW)": fmt(cycleResult.Q_cond_W / 1000, 2),
          COP: fmt(cycleResult.COP, 2),
          "Te eq": `${fmt(cycleResult.Te_C, 1)} °C`,
          "Tc eq": `${fmt(cycleResult.Tc_C, 1)} °C`,
        }}
        warnings={cycleResult.warnings}
      />,
      `condensador-ar-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };
  const handleExportCsv = () => toast.info("Exportação CSV em desenvolvimento.");
  const handleExportExcel = () => toast.info("Exportação Excel em desenvolvimento.");

  const badges = [refrigerantId, `Te: ${fmt(te, 0)}°C`, `Tc: ${fmt(tc, 0)}°C`];
  const canSimulate = catalogs.ready;
  const disabledReason = !catalogs.ready ? "Aguardando catálogos…" : undefined;

  // ── Sidebar ──
  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => simState.trigger()}
      onReset={handleReset}
      isCalculating={isSimulating}
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
              variant={selectedCompressorRow ? "default" : "outline"}
              className="w-full h-8 text-xs truncate"
              onClick={() => setCompressorPickerOpen(true)}
              title={selectedCompressorRow ? selectedCompressorRow.model : "Selecionar compressor"}
            >
              {selectedCompressorRow ? selectedCompressorRow.model : "Selecionar compressor…"}
            </Button>
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <Label>Te</Label>
                <input
                  type="number"
                  value={te}
                  min={-40}
                  max={15}
                  step={1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setTe(Math.max(-40, Math.min(15, v)));
                  }}
                  className="w-20 rounded border border-input bg-background px-2 py-0.5 text-right font-mono text-xs text-foreground"
                />
              </div>
              <Slider value={[te]} min={-40} max={15} step={1} onValueChange={(v) => setTe(v[0])} />
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <Label>Tc</Label>
                <input
                  type="number"
                  value={tc}
                  min={25}
                  max={65}
                  step={1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setTc(Math.max(25, Math.min(65, v)));
                  }}
                  className="w-20 rounded border border-input bg-background px-2 py-0.5 text-right font-mono text-xs text-foreground"
                />
              </div>
              <Slider value={[tc]} min={25} max={65} step={1} onValueChange={(v) => setTc(v[0])} />
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
      title="Condensador a Ar"
      icon={<Thermometer className="h-5 w-5" />}
      badges={badges}
      onSave={handleSave}
      onShare={handleShare}
      onExportPdf={handleExportPdf}
      isExportingPdf={isExportingPdf}
    />
  );

  return (
    <WorkspaceLayout header={header} sidebar={sidebar}>
      <ProjectHeaderBar workspaceType="component_workspace" />
      <div className="flex h-full flex-col">
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {isSimulating && !cycleResult ? (
              <LoadingResults />
            ) : simState.status === "error" ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
                <p className="font-semibold text-red-500">Erro no CycleEngine</p>
                <p className="mt-2 text-sm text-muted-foreground">{simState.message}</p>
              </div>
            ) : (
              <CondenserTabs
                cycleResult={cycleResult}
                config={config}
                frontalVelocity={frontalVelocity}
                safetyFactor={safetyFactor}
                geomHeight={geomHeight}
                geomWidth={geomWidth}
                geomDepth={geomDepth}
                rows={rows}
                tubesPerRow={tubesPerRow}
                tubeDiam={tubeDiam}
                finPitch={finPitch}
                circuits={circuits}
                refrigerantId={refrigerantId}
                airFlow={airFlow}
                airTempIn={airTempIn}
                airRH={airRH}
                te={te}
                tc={tc}
                superheat={superheat}
                subcooling={subcooling}
                catalogs={catalogs}
                condenserInputs={condenserInputs}
                condenserSim={condenserSim}
                envelopePoints={envelopePoints}
                generateEnvelope={generateEnvelope}
                saveEnvelopeToStore={saveToStore}
                isGeneratingEnvelope={isGeneratingEnvelope}
                canSimulate={canSimulate}
                disabledReason={disabledReason}
                onSimulate={() => simState.trigger()}
                onReset={handleReset}
                isSimulating={isSimulating}
                onFanPickerOpen={() => setFanPickerOpen(true)}
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
      <FanPickerModal
        open={fanPickerOpen}
        onClose={() => setFanPickerOpen(false)}
        fans={fanPickerItems}
        onConfirm={(item) => {
          toast.success(`Ventilador selecionado: ${[item.manufacturer, item.model].filter(Boolean).join(" ")}`);
        }}
      />
      <PostSaveNextStepDialog
        open={nextStepOpen}
        onOpenChange={setNextStepOpen}
        next="compressor"
      />
    </WorkspaceLayout>
  );
}

// ── NumField helper ──────────────────────────────────────────────────────────
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

// ── LoadingResults ───────────────────────────────────────────────────────────
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

// ── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Thermometer className="h-12 w-12 opacity-30" />
      <p className="text-sm">Configure os parâmetros e clique em <strong>Calcular</strong></p>
    </div>
  );
}

// ── CondenserTabs ────────────────────────────────────────────────────────────
type CondenserTabsProps = {
  cycleResult: CycleResult | null;
  config: CycleSystemConfig;
  frontalVelocity: number;
  safetyFactor: number;
  geomHeight: number;
  geomWidth: number;
  geomDepth: number;
  rows: number;
  tubesPerRow: number;
  tubeDiam: number;
  finPitch: number;
  circuits: number;
  refrigerantId: string;
  airFlow: number;
  airTempIn: number;
  airRH: number;
  te: number;
  tc: number;
  superheat: number;
  subcooling: number;
  catalogs: ReturnType<typeof useCnCoilsCatalogs>;
  condenserInputs: CondenserInputs;
  condenserSim: ReturnType<typeof useCondenserSimulation>;
  envelopePoints: Array<{ Tc: number; Q_cond_W: number; UA: number; LMTD: number; Tair_out: number }>;
  generateEnvelope: () => void;
  saveEnvelopeToStore: () => void;
  isGeneratingEnvelope: boolean;
  canSimulate: boolean;
  disabledReason?: string;
  onSimulate: () => void;
  onReset: () => void;
  isSimulating: boolean;
  onFanPickerOpen: () => void;
};

function CondenserTabs({
  cycleResult,
  config,
  frontalVelocity,
  safetyFactor,
  geomHeight,
  geomWidth,
  geomDepth,
  rows,
  tubesPerRow,
  tubeDiam,
  finPitch,
  circuits,
  refrigerantId,
  airFlow,
  airTempIn,
  airRH,
  te,
  tc,
  superheat,
  subcooling,
  catalogs,
  envelopePoints,
  generateEnvelope,
  saveEnvelopeToStore,
  isGeneratingEnvelope,
  canSimulate,
  disabledReason,
  onSimulate,
  onReset,
  isSimulating,
  onFanPickerOpen,
}: CondenserTabsProps) {
  const result = useCnCoilsSimulationStore((s) => s.result);
  const storeIsSimulating = useCnCoilsSimulationStore((s) => s.isSimulating);
  const storeWarnings = useCnCoilsSimulationStore((s) => s.warnings);
  // setStoreWarnings disponível se necessário para validações futuras
  const [activeTab, setActiveTab] = useState<string>(CONDENSER_TABS.DETAILED);

  // Hooks de simulação standalone (populam o store → WorkspaceSidebar/AirSidePanel/FluidSidePanel)
  const simulationDeps = useMemo(
    () => ({
      geometries: catalogs.geometries,
      tubeMaterials: catalogs.tubeMaterials,
      correctionCoefficients: catalogs.correctionCoefficients,
      pressureDropFan: catalogs.pressureDropFan,
    }),
    [catalogs.geometries, catalogs.tubeMaterials, catalogs.correctionCoefficients, catalogs.pressureDropFan],
  );
  const { run: runV1 } = useCnCoilsSimulation(simulationDeps);
  const { run: runV2 } = useCnCoilsSimulationV2({
    tubeMaterials: catalogs.tubeMaterials,
    geometries: catalogs.geometries,
    componentType: "condenser_air",
  });

  // handleSimulate: garante geometryId, roda motor standalone + dispara ciclo
  const handleSimulate = useCallback(() => {
    // Garante geometryId para o motor V2 (não precisa de catálogo)
    const store = useCnCoilsSimulationStore.getState();
    if (!store.physicalInputs.geometryId) {
      useCnCoilsSimulationStore.setState({
        physicalInputs: { ...store.physicalInputs, geometryId: "condenser-direct" },
      });
    }
    // Roda motor standalone para popular store (WorkspaceSidebar/AirSidePanel/etc.)
    const currentEngineVersion = useCnCoilsSimulationStore.getState().engineVersion;
    if (currentEngineVersion === "v2") {
      runV2();
    } else {
      runV1();
    }
    // Dispara CycleEngine (ciclo completo)
    setTimeout(onSimulate, 0);
  }, [runV1, runV2, onSimulate]);

  const enrichedWarnings = useMemo(
    () => enrichWarnings(
      storeWarnings
        .map((w) => w.message)
        .filter((m): m is string => typeof m === "string"),
    ),
    [storeWarnings],
  );

  const effectiveCanSimulate = catalogs.ready;
  const effectiveDisabledReason = !catalogs.ready ? "Aguardando catálogos…" : undefined;
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="flex w-full overflow-x-auto whitespace-nowrap scrollbar-none pb-px h-auto">
        <TabsTrigger
          value={CONDENSER_TABS.DETAILED}
          className="shrink-0 text-xs font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white"
        >
          🌡️ Detalhado
        </TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.RESULTS} className="shrink-0 text-xs">📋 Resultados</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.CYCLE_PH} className="shrink-0 text-xs">🔄 Ciclo P-H</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.ENVELOPE} className="shrink-0 text-xs">📊 Envelope Q×Tc</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.GEADA} className="shrink-0 text-xs">❄️ Geada</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.MAPA_OPERACIONAL} className="shrink-0 text-xs">📈 Mapa Operacional</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.INCERTEZA} className="shrink-0 text-xs">📐 Incerteza</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.OTIMIZACAO} className="shrink-0 text-xs">⚙️ Otimização</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.DESENHO} className="shrink-0 text-xs font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white">🏗️ Desenho</TabsTrigger>
        <TabsTrigger value={CONDENSER_TABS.RELATORIO} className="shrink-0 text-xs">📄 Relatório</TabsTrigger>
      </TabsList>

      {/* ── Aba Detalhado ── */}
      <TabsContent value={CONDENSER_TABS.DETAILED} className="mt-3">
        <div className="space-y-3">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Formulário principal / dados do ambiente
            </h3>
            <div className="grid grid-cols-1 gap-2 rounded-md shadow-sm md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
              <WorkspaceSidebar
                componentType="condenser_air"
                onSimulate={handleSimulate}
                onReset={onReset}
                canSimulate={effectiveCanSimulate}
                isSimulating={storeIsSimulating || isSimulating}
                faceAreaM2={result?.faceAreaM2}
                disabledReason={effectiveDisabledReason}
              />
              <div className="min-w-0 space-y-2 xl:contents">
                <div className="min-w-0 space-y-2 xl:border-r xl:border-border xl:pr-2">
                  <AirSidePanel result={result} onFanPickerOpen={onFanPickerOpen} />
                </div>
                <div className="min-w-0 space-y-2">
                  <FluidSidePanel
                    componentType="condenser_air"
                    refrigerants={catalogs.refrigerants}
                    disabled={!catalogs.ready}
                    result={result}
                  />
                </div>
              </div>
            </div>
          </section>
          <section className="mt-2 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Dados técnicos e premissas
            </h3>
            <GeometryBottomBar />
          </section>
          {result && (
            <section className="rounded-lg border border-border bg-card p-3">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Resultado do cálculo
              </h3>
              <ResultPanel result={result} warnings={storeWarnings} onGoalSeek={() => {}} />
            </section>
          )}
          {!catalogs.ready && (
            <DatasetStatusPanel
              loading={catalogs.loading}
              ready={catalogs.ready}
              errors={catalogs.errors}
              missing={catalogs.missing}
              compact
            />
          )}
        </div>
      </TabsContent>

      {/* ── Aba Resultados ── */}
      <TabsContent value={CONDENSER_TABS.RESULTS} className="mt-3">
        {cycleResult ? (
          <CondenserResultsGrid
            result={cycleResult}
            frontalVelocity={frontalVelocity}
            airTempIn={airTempIn}
          />
        ) : (
          <EmptyState />
        )}
      </TabsContent>

      {/* ── Aba Ciclo P-H ── */}
      <TabsContent value={CONDENSER_TABS.CYCLE_PH} className="mt-3">
        {cycleResult ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <CyclePHDiagram
                result={cycleResult}
                refrigerantId={refrigerantId}
                width={620}
                height={360}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ResultCard label="Te" value={fmt(cycleResult.Te_C, 1)} unit="°C" />
              <ResultCard label="Tc" value={fmt(cycleResult.Tc_C, 1)} unit="°C" />
              <ResultCard label="COP" value={fmt(cycleResult.COP, 2)} variant="success" />
              <ResultCard label="EER" value={fmt(cycleResult.COP * 3.412, 2)} unit="BTU/W·h" />
            </div>
          </div>
        ) : <EmptyState />}
      </TabsContent>

      {/* ── Aba Envelope Q×Tc ── */}
      <TabsContent value={CONDENSER_TABS.ENVELOPE} className="mt-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Envelope Q × Tc</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={generateEnvelope}
                disabled={isGeneratingEnvelope}
              >
                {isGeneratingEnvelope ? "Gerando…" : "Gerar Envelope"}
              </Button>
              {envelopePoints.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={saveEnvelopeToStore}
                >
                  Salvar na Bancada
                </Button>
              )}
            </div>
          </div>
          <CoilEnvelopeTab equipmentId="condenser-air" />
          {envelopePoints.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 text-left text-muted-foreground">Tc (°C)</th>
                    <th className="py-1 text-right text-muted-foreground">Q cond (kW)</th>
                    <th className="py-1 text-right text-muted-foreground">UA (W/K)</th>
                    <th className="py-1 text-right text-muted-foreground">LMTD (K)</th>
                    <th className="py-1 text-right text-muted-foreground">T ar saída (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopePoints.map((pt) => (
                    <tr key={pt.Tc} className="border-b border-border/50">
                      <td className="py-1">{fmt(pt.Tc, 1)}</td>
                      <td className="py-1 text-right">{fmt(pt.Q_cond_W / 1000, 2)}</td>
                      <td className="py-1 text-right">{fmt(pt.UA, 0)}</td>
                      <td className="py-1 text-right">{fmt(pt.LMTD, 1)}</td>
                      <td className="py-1 text-right">{fmt(pt.Tair_out, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ── Aba Geada ── */}
      <TabsContent value={CONDENSER_TABS.GEADA} className="mt-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Análise de geada não aplicável a condensadores a ar (superfície quente).
          </p>
          {cycleResult && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <ResultCard label="Tc" value={fmt(cycleResult.Tc_C, 1)} unit="°C" hint="Temp. condensação" />
              <ResultCard label="T ar saída" value={fmt(cycleResult.condenserResult.airOutletTempC, 1)} unit="°C" />
              <ResultCard label="ΔT ar" value={fmt(cycleResult.condenserResult.airOutletTempC - airTempIn, 1)} unit="K" hint="Elevação do ar" />
            </div>
          )}
        </div>
      </TabsContent>

      {/* ── Aba Mapa Operacional ── */}
      <TabsContent value={CONDENSER_TABS.MAPA_OPERACIONAL} className="mt-3">
        {cycleResult ? (
          <CondenserOperatingMapTab
            config={config}
            cycleResult={cycleResult}
          />
        ) : <EmptyState />}
      </TabsContent>

      {/* ── Aba Incerteza ── */}
      <TabsContent value={CONDENSER_TABS.INCERTEZA} className="mt-3">
        {cycleResult ? (
          <CondenserUncertaintyTab config={config} cycleResult={cycleResult} />
        ) : <EmptyState />}
      </TabsContent>
      {/* ── Aba Otimização ── */}
      <TabsContent value={CONDENSER_TABS.OTIMIZACAO} className="mt-3">
        {cycleResult ? (
          <CondenserOptimizationTab config={config} cycleResult={cycleResult} />
        ) : <EmptyState />}
      </TabsContent>
      {/* ── Aba Desenho ── */}
      <TabsContent value={CONDENSER_TABS.DESENHO} className="mt-3">
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
          projectName={`Condensador a Ar — ${refrigerantId}`}
          componentType="condenser"
        />
      </TabsContent>

      {/* ── Aba Relatório ── */}
      <TabsContent value={CONDENSER_TABS.RELATORIO} className="mt-3">
        <CondenserReportTab
          cycleResult={cycleResult}
          refrigerantId={refrigerantId}
          airTempIn={airTempIn}
          tc={tc}
          subcooling={subcooling}
          geomHeight={geomHeight}
          geomWidth={geomWidth}
          rows={rows}
          circuits={circuits}
          finPitch={finPitch}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── CondenserResultsGrid ─────────────────────────────────────────────────────
function CondenserResultsGrid({
  result,
  frontalVelocity,
  airTempIn,
}: {
  result: CycleResult;
  frontalVelocity: number;
  airTempIn: number;
}) {
  const cond = result.condenserResult;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Resultados do Condensador</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <ResultCard
          label="Q condensação"
          value={fmt(result.Q_cond_W / 1000)}
          unit="kW"
          hint={`${fmt(result.Q_cond_W * 0.86, 0)} kcal/h`}
          variant="success"
        />
        <ResultCard
          label="Q evaporação"
          value={fmt(result.Q_evap_W / 1000)}
          unit="kW"
          hint="Carga do evaporador"
        />
        <ResultCard label="W compressor" value={fmt(result.W_comp_W / 1000)} unit="kW" />
        <ResultCard label="COP" value={fmt(result.COP, 2)} variant="success" hint="Coeficiente de desempenho" />
        <ResultCard label="Te equilíbrio" value={fmt(result.Te_C, 1)} unit="°C" />
        <ResultCard label="Tc equilíbrio" value={fmt(result.Tc_C, 1)} unit="°C" />
        <ResultCard label="T ar saída" value={fmt(cond.airOutletTempC, 1)} unit="°C" />
        <ResultCard label="ΔP ar" value={fmt(cond.airPressureDropPa, 0)} unit="Pa" />
        <ResultCard label="U global" value={fmt(cond.overallU_WM2K, 1)} unit="W/m²K" hint="Coef. global de transferência" />
        <ResultCard label="Vel. frontal" value={fmt(frontalVelocity, 2)} unit="m/s" />
        <ResultCard label="ΔT ar" value={fmt(cond.airOutletTempC - airTempIn, 1)} unit="K" hint="Elevação do ar" />
        <ResultCard label="Razão de compressão" value={fmt(result.compressorResult.compressionRatio, 2)} />
      </div>
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <h4 className="mb-2 text-xs font-semibold text-amber-600">Avisos</h4>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── CondenserOperatingMapTab ─────────────────────────────────────────────────
// ── CondenserUncertaintyTab ─────────────────────────────────────────────────
function buildCondenserNominal(result: CycleResult): CoilCycleResult {
  const cond = result.condenserResult;
  return {
    totalCapacityW: result.Q_cond_W,
    sensibleCapacityW: result.Q_cond_W,
    latentCapacityW: 0,
    airOutletTempC: cond.airOutletTempC,
    airOutletRH: 0,
    airPressureDropPa: cond.airPressureDropPa,
    fluidPressureDropKPa: cond.fluidPressureDropKPa,
    overallU_WM2K: cond.overallU_WM2K,
    safetyFactor: 1,
    refrigerantOutletTempC: result.Tc_C,
    inletQuality: 1,
    warnings: result.warnings,
    success: true,
  };
}
function CondenserUncertaintyTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const inputs = useMemo(
    () => buildCondenserCoilInputsLocal(config, cycleResult.m_dot_kgS),
    [config, cycleResult.m_dot_kgS],
  );
  const nominal = useMemo(() => buildCondenserNominal(cycleResult), [cycleResult]);
  const { result, isLoading } = useUncertaintyAnalysis({
    inputs,
    nominalResult: nominal,
    debounceMs: 1500,
    enabled: true,
    config: { samples: 200 },
  });
  const capacityUnit = useUnitStore((s) => s.capacityUnit);
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
        <h3 className="text-sm font-semibold">Bandas de incerteza — Condensador</h3>
        <UncertaintyBadge
          band={result.totalCapacityW}
          format={(v) => fmt(convertCapacity(v / 1000, capacityUnit), capacityUnit === 'kW' || capacityUnit === 'TR' ? 2 : 0)}
          unit={capacityUnit}
        />
      </div>
      <UncertaintyPanel result={result} isLoading={false} />
    </div>
  );
}
// ── CondenserOptimizationTab ─────────────────────────────────────────────────
function CondenserOptimizationTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const baseInputs = useMemo(
    () => buildCondenserCoilInputsLocal(config, cycleResult.m_dot_kgS),
    [config, cycleResult.m_dot_kgS],
  );
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <OptimizationPanel
        baseInputs={baseInputs}
        currentCapacityW={cycleResult.Q_cond_W}
        onApplyGeometry={() => {}}
      />
    </div>
  );
}
function buildCondenserCoilInputsLocal(
  config: CycleSystemConfig,
  mDot: number,
): CoilCycleInputs {
  return {
    ...config.condenser,
    refrigerantId: config.refrigerantId,
    evaporatingTempC: config.solver?.Te_initial_C ?? -10,
    condensingTempC: config.solver?.Tc_initial_C ?? 45,
    refrigerantMassFlowKgS: mDot,
    componentType: "condenser",
  };
}
function buildCondenserCoilInputs(
  config: CycleSystemConfig,
  mDot: number,
): CoilCycleInputs {
  return {
    ...config.condenser,
    refrigerantId: config.refrigerantId,
    evaporatingTempC: config.solver?.Te_initial_C ?? -10,
    condensingTempC: config.solver?.Tc_initial_C ?? 45,
    refrigerantMassFlowKgS: mDot,
    componentType: "condenser",
  };
}

function CondenserOperatingMapTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const baseInputs = useMemo(
    () => buildCondenserCoilInputs(config, cycleResult.m_dot_kgS),
    [config, cycleResult.m_dot_kgS],
  );
  const { result, isLoading, error, generate } = useOperatingMap(baseInputs);
  useEffect(() => {
    generate({
      evapTempRange: { min: -30, max: 5, step: 5 },
      condensingTemps: [35, 40, 45, 50, 55],
      airInletTempC: config.condenser.airInletTempC,
      airFlowM3H: config.condenser.airFlowM3H,
      designPoint: {
        evapTempC: cycleResult.Te_C,
        condensingTempC: cycleResult.Tc_C,
        capacityW: cycleResult.Q_cond_W,
      },
    } satisfies OperatingMapConfig);
  }, [generate, config, cycleResult.Te_C, cycleResult.Tc_C, cycleResult.Q_cond_W]);
  if (error) return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
      Erro ao gerar mapa: {error}
    </div>
  );
  if (isLoading || !result) return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground animate-pulse">
      Gerando mapa operacional…
    </div>
  );
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <OperatingMapChart result={result} />
    </div>
  );
}

// ── CondenserReportTab ───────────────────────────────────────────────────────
function CondenserReportTab({
  cycleResult,
  refrigerantId,
  airTempIn,
  tc,
  subcooling,
  geomHeight,
  geomWidth,
  rows,
  circuits,
  finPitch,
}: {
  cycleResult: CycleResult | null;
  refrigerantId: string;
  airTempIn: number;
  tc: number;
  subcooling: number;
  geomHeight: number;
  geomWidth: number;
  rows: number;
  circuits: number;
  finPitch: number;
}) {
  if (!cycleResult) return <EmptyState />;
  const cond = cycleResult.condenserResult;
  const areaM2 = (geomHeight / 1000) * (geomWidth / 1000);
  const UA = cond.overallU_WM2K * areaM2;
  const LMTD = UA > 0 ? cycleResult.Q_cond_W / UA : 0;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Relatório Técnico — Condensador a Ar</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <div className="col-span-2 mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dados de Entrada
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Refrigerante</span>
            <span className="font-mono">{refrigerantId}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">T ar entrada (°C)</span>
            <span className="font-mono">{fmt(airTempIn, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Tc inicial (°C)</span>
            <span className="font-mono">{fmt(tc, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Subresfriamento (K)</span>
            <span className="font-mono">{fmt(subcooling, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Altura aletado (mm)</span>
            <span className="font-mono">{fmt(geomHeight, 0)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Largura aletado (mm)</span>
            <span className="font-mono">{fmt(geomWidth, 0)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Linhas de tubos</span>
            <span className="font-mono">{rows}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Circuitos</span>
            <span className="font-mono">{circuits}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Passo de aleta (mm)</span>
            <span className="font-mono">{fmt(finPitch, 2)}</span>
          </div>

          <div className="col-span-2 mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Resultados do Ciclo
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Q condensação (kW)</span>
            <span className="font-mono font-semibold text-green-600">{fmt(cycleResult.Q_cond_W / 1000)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Q condensação (kcal/h)</span>
            <span className="font-mono">{fmt(cycleResult.Q_cond_W * 0.86, 0)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Te equilíbrio (°C)</span>
            <span className="font-mono">{fmt(cycleResult.Te_C, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">Tc equilíbrio (°C)</span>
            <span className="font-mono">{fmt(cycleResult.Tc_C, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">COP</span>
            <span className="font-mono font-semibold text-blue-600">{fmt(cycleResult.COP, 3)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">W compressor (kW)</span>
            <span className="font-mono">{fmt(cycleResult.W_comp_W / 1000)}</span>
          </div>

          <div className="col-span-2 mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Transferência de Calor
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">U global (W/m²K)</span>
            <span className="font-mono">{fmt(cond.overallU_WM2K, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">UA (W/K)</span>
            <span className="font-mono">{fmt(UA, 0)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">LMTD (K)</span>
            <span className="font-mono">{fmt(LMTD, 2)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">T ar saída (°C)</span>
            <span className="font-mono">{fmt(cond.airOutletTempC, 1)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">ΔP ar (Pa)</span>
            <span className="font-mono">{fmt(cond.airPressureDropPa, 0)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">ΔP fluido (kPa)</span>
            <span className="font-mono">{fmt(cond.fluidPressureDropKPa, 2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
