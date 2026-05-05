import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNumericInput } from "../hooks/useNumericInput";
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
import { ResultPanel } from "../components/ResultPanel";
import { ActionBar } from "../components/ActionBar";
import { ProjectHeaderBar } from "../components/ProjectHeaderBar";
import { CyclePHDiagram } from "../components/CyclePHDiagram";
import { CoilEnvelopeTab } from "../components/CoilEnvelopeTab";
import { CoilsInSeriesPanel } from "../components/CoilsInSeriesPanel";
import { FrostAnalysisTab } from "../components/FrostAnalysisTab";
import { FrostAnalysisPanel } from "../components/FrostAnalysisPanel";
import { OperatingMapChart } from "../components/OperatingMapChart";
import { OptimizationPanel } from "../components/OptimizationPanel";
import { UncertaintyPanel, UncertaintyBadge } from "../components/UncertaintyBadge";
import { CompressorPickerModal } from "../components/CompressorPickerModal";
import { FanPickerModal } from "../components/FanPickerModal";
import { GeometryPickerModal } from "../components/GeometryPickerModal";
import {
  TubeModal,
  FinModal,
  DistributorModal,
} from "../components/GeometryDerivedModals";
import { useCnCoilsCatalogs as useCnCoilsFullCatalogs } from "../hooks/useCnCoilsCatalogCollection";
import { useEnrichedFanPickerItems } from "../hooks/useEnrichedFanPickerItems";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { EnrichedWarningsPanel } from "../components/EnrichedWarningsPanel";
import { DrawingTab } from "../components/drawing/DrawingTab";
import { WorkspaceAIChat } from "../components/WorkspaceAIChat";
import { AirSidePanel } from "../components/AirSidePanel";
import { FluidSidePanel } from "../components/FluidSidePanel";
import { GeometryBottomBar } from "../components/GeometryBottomBar";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { calcCoilDerivedDimensions } from "../utils/coilDerivedMetrics";
import { fmtBR as fmtBRUtil } from "../utils/unitConversions";
import { CircuitrySelector } from "../components/CircuitrySelector";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { PostSaveNextStepDialog } from "../components/PostSaveNextStepDialog";
import { useCnCoilsCatalogs } from "../hooks/useCnCoilsCatalogs";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { useCnCoilsSimulation } from "../hooks/useCnCoilsSimulation";
import { useCnCoilsSimulationV2 } from "../hooks/useCnCoilsSimulationV2";
import { useCnCoilsInputBridge } from "../hooks/useCnCoilsInputBridge";
import {
  validatePhysicalInputs,
  validateThermoInputs,
} from "../validators/simulationValidator";
import {
  convertCapacity,
  useUnitStore,
  type CapacityUnit,
} from "../store/useUnitStore";
import { CAPACITY_UNITS, capacityConv } from "../utils/unitConversions";
import { enrichWarnings } from "../utils/warningEnricher";
import { useCatalogPreloadStore } from "@/modules/coldpro_catalog/store/useCatalogPreloadStore";
import { catalogRowToEvaporatorInputs } from "@/modules/coldpro_catalog/utils/catalogRowToWorkspaceInputs";
import { loadCompressorIndex, getCompressorById } from "@/modules/coldpro_catalog/data/compressorCatalog.service";
import type { CompressorCatalogRow } from "@/modules/coldpro_catalog/data/compressorCatalog.types";
import { useProjectStore } from "../store/useProjectStore";
import type { AIContext } from "../components/WorkspaceAIChat";
import type { StructuredWarning } from "../types/warnings";
import type { OperatingMapPoint } from "../engines/operatingMap/operatingMapTypes";

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
type FanMode = "manual" | "catalog";

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

function NavCard({
  title,
  status,
  lines,
  onEdit,
  errors,
}: {
  title: string;
  status: "ok" | "incomplete" | "warning" | "error";
  lines: string[];
  onEdit?: () => void;
  errors?: string[];
}) {
  const statusColors = {
    ok: "bg-emerald-100 text-emerald-800",
    incomplete: "bg-slate-100 text-slate-500",
    warning: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-700",
  };
  const statusLabels = {
    ok: "OK",
    incomplete: "Incompleto",
    warning: "Alerta",
    error: "Erro",
  };
  return (
    <div className="mb-2 rounded border border-border bg-card p-2 text-[10px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
      {lines.map((line, i) => (
        <div key={i} className="text-muted-foreground">{line}</div>
      ))}
      {errors && errors.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {errors.map((err, i) => (
            <div
              key={i}
              className={`rounded border px-1.5 py-0.5 text-[9px] ${
                status === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {err}
            </div>
          ))}
        </div>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-1.5 text-[9px] font-semibold text-[#1E6FD9] hover:underline"
        >
          Editar →
        </button>
      )}
    </div>
  );
}

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
  const [fanPickerOpen, setFanPickerOpen] = useState(false);
  const fullCatalogs = useCnCoilsFullCatalogs();
  const selectedFanId = useCnCoilsSimulationStore((s) => s.selectedFanId);
  // Biblioteca enriquecida (EBM-Papst etc.) — fabricante, série, motor, diâmetro
  const { items: fanPickerItems } = useEnrichedFanPickerItems();
  const selectedFan = useMemo(
    () => fanPickerItems.find((f) => f.id === selectedFanId),
    [fanPickerItems, selectedFanId],
  );
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
  const [geomPickerOpen, setGeomPickerOpen] = useState(false);
  const [activeGeomModal, setActiveGeomModal] = useState<"tube" | "fin" | "distributor" | null>(null);
  // ── Compressor selecionado do catálogo ──
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);
  const resetSimStore = useCnCoilsSimulationStore((s) => s.reset);
  const setActiveProjectGlobal = useProjectStore((s) => s.setActiveProject);
  const handleNovoAletado = () => {
    resetSimStore();
    setActiveProjectGlobal(null);
    toast.success("Workspace limpo. Configure um novo aletado do zero.");
  };
  const [selectedCompressorRow, setSelectedCompressorRow] = useState<CompressorCatalogRow | null>(null);
  useEffect(() => {
    if (!selectedCompressorId) {
      setSelectedCompressorRow(null);
      return;
    }
    let cancelled = false;
    void getCompressorById(selectedCompressorId).then((row) => {
      if (!cancelled) setSelectedCompressorRow(row ?? null);
    });
    return () => { cancelled = true; };
  }, [selectedCompressorId]);
  // ── Operação ──
  const [compressorMode, setCompressorMode] = useState<CompressorMode>("ari");
  const [frequency, setFrequency] = useState(60);
  const [voltage, setVoltage] = useState(380);
  const pendingEvaporator = useCatalogPreloadStore((s) => s.pendingEvaporator);
  const clearCatalogPreload = useCatalogPreloadStore((s) => s.clearAll);
  const { capacityUnit } = useUnitStore();

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
      selectedCompressorRow,
    ],
  );
  const simState = useCycleSimulation(config, { mode: "manual" });
  const cycleResult: CycleResult | null =
    simState.status === "success" ? simState.result : null;

  // ── IA Chat state ──
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState("Detalhado");
  const [nextStepOpen, setNextStepOpen] = useState(false);

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
      [`Capacidade total (${capacityUnit})`]: fmt(convertCapacity(cycleResult.Q_evap_W / 1000, capacityUnit), capacityUnit === 'kW' || capacityUnit === 'TR' ? 2 : 0),
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
  // Recarrega dados do catálogo sempre que pendingEvaporator mudar (corrige bug da segunda visita)
  useEffect(() => {
    if (!pendingEvaporator) {
      if (!didInitRef.current) {
        didInitRef.current = true;
        simState.trigger();
      }
      return;
    }
    didInitRef.current = true;
    const inputs = catalogRowToEvaporatorInputs(pendingEvaporator);
    if (inputs.geomHeight !== undefined) setGeomHeight(inputs.geomHeight);
    if (inputs.geomWidth !== undefined) setGeomWidth(inputs.geomWidth);
    if (inputs.geomDepth !== undefined) setGeomDepth(inputs.geomDepth);
    if (inputs.finPitch !== undefined) setFinPitch(inputs.finPitch);
    if (inputs.tubeDiam !== undefined) setTubeDiam(inputs.tubeDiam);
    if (inputs.circuits !== undefined) setCircuits(inputs.circuits);
    if (inputs.rows !== undefined) setRows(inputs.rows);
    if (inputs.tubesPerRow !== undefined) setTubesPerRow(inputs.tubesPerRow);
    if (inputs.airFlow !== undefined) setAirFlow(inputs.airFlow);
    if (inputs.airTempIn !== undefined) setAirTempIn(inputs.airTempIn);
    if (inputs.airRH !== undefined) setAirRH(inputs.airRH);
    if (inputs.refrigerantId !== undefined) setRefrigerantId(inputs.refrigerantId);
    if (inputs.te !== undefined) setTe(inputs.te);
    if (inputs.tc !== undefined) setTc(inputs.tc);
    if (inputs.superheat !== undefined) setSuperheat(inputs.superheat);
    if (inputs.subcooling !== undefined) setSubcooling(inputs.subcooling);
    // Cria/ativa projeto com o nome do modelo do catálogo
    try {
      const ps = useProjectStore.getState();
      const projectName = pendingEvaporator.modelo ?? pendingEvaporator.modeloUnico ?? "Projeto do catálogo";
      const existing = ps.projects.find((p) => p.name === projectName);
      const id = existing
        ? existing.id
        : ps.saveProject(projectName, "component_workspace", {});
      ps.updateProjectHeader(id, {
        projectCode: pendingEvaporator.modeloUnico ?? pendingEvaporator.modelo,
        status: "draft",
      });
      ps.setActiveProject(id);
    } catch (err) {
      console.error("[EvapWorkspace] Falha ao criar projeto a partir do catálogo:", err);
    }

    // Tenta herdar compressor do catálogo
    const compModel = pendingEvaporator.compressorModelo ?? pendingEvaporator.compressorCodigo;
    if (compModel) {
      void loadCompressorIndex()
        .then((index) => {
          const target = String(compModel).trim().toLowerCase();
          const match =
            index.find((r) => r.model?.toLowerCase() === target) ??
            index.find((r) => r.model?.toLowerCase().includes(target));
          if (match) {
            useCnCoilsSimulationStore.getState().setSelectedCompressor(match.id);
            toast.success(`Compressor herdado do catálogo: ${match.model}`);
          } else {
            toast.warning(`Compressor "${compModel}" não encontrado no índice.`);
          }
        })
        .catch((e) => console.error("[EvapWorkspace] Falha ao herdar compressor:", e));
    }

    clearCatalogPreload();
    toast.success(`Dados carregados do catálogo: ${pendingEvaporator.modelo}`);
    setTimeout(() => simState.trigger(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEvaporator]);

  useEffect(() => {
    const store = useCnCoilsSimulationStore.getState();
    store.setPhysicalInputs({
      componentType: "evaporator_dx",
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
    store.setFluidOperatingTemp(te);
    store.setSuperheat(superheat);
    store.setSubcooling(subcooling);
    store.setFluidMassFlow(massFlow);
    store.setCalcMode(calcMode);
    store.setEngineVersion(engineMode);
  }, [
    airFlow,
    airRH,
    airTempIn,
    calcMode,
    circuits,
    engineMode,
    finPitch,
    geomHeight,
    geomWidth,
    massFlow,
    refrigerantId,
    rows,
    subcooling,
    superheat,
    te,
    tubeDiam,
    tubesPerRow,
  ]);

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
        componentType="evaporator"
        title="Evaporador DX — Unificado"
        inputs={{
          Refrigerante: refrigerantId,
          "Te inicial": `${te} °C`,
          "Tc inicial": `${tc} °C`,
          "Vazão de ar": `${airFlow.toLocaleString("pt-BR")} m³/h`,
        }}
        results={{
          [`Capacidade real (${capacityUnit})`]: `${fmt(convertCapacity(cycleResult.Q_evap_W / 1000, capacityUnit), capacityUnit === 'kW' || capacityUnit === 'TR' ? 2 : 0)} ${capacityUnit}`,
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

  // ── Validações por seção ──
  const physicalForCheck = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const thermoForCheck = useCnCoilsSimulationStore((s) => s.thermoInputs);
  const physCheckSidebar = validatePhysicalInputs(physicalForCheck);
  const thermoCheckSidebar = validateThermoInputs(thermoForCheck);

  const ventIncomplete = !airFlow || airFlow <= 0 || airTempIn === undefined;
  const velocityWarning =
    frontalVelocity > 0 && (frontalVelocity < 1.5 || frontalVelocity > 3.5);
  const fluidIncomplete = !refrigerantId;
  const teAboveAirTemp =
    typeof te === "number" && typeof airTempIn === "number" && te >= airTempIn;

  type NavCardStatus = "ok" | "incomplete" | "warning" | "error";
  const modeStatus: NavCardStatus = "ok";
  const geomStatus: NavCardStatus = physCheckSidebar.isValid ? "ok" : "incomplete";
  const ventStatus: NavCardStatus = ventIncomplete
    ? "incomplete"
    : velocityWarning
      ? "warning"
      : "ok";
  const fluidStatus: NavCardStatus = fluidIncomplete
    ? "incomplete"
    : teAboveAirTemp
      ? "warning"
      : "ok";
  const opsStatus: NavCardStatus = "ok";

  const ventErrors = ventIncomplete
    ? thermoCheckSidebar.errors.filter((e) => {
        const s = e.toLowerCase();
        return s.includes("vazão") || s.includes("temperatura") || s.includes("umidade");
      })
    : velocityWarning
      ? [
          `Velocidade frontal ${frontalVelocity.toFixed(2)} m/s fora da faixa recomendada (1,5–3,5 m/s)`,
        ]
      : undefined;

  const fluidErrors = fluidIncomplete
    ? thermoCheckSidebar.errors.filter((e) => {
        const s = e.toLowerCase();
        return s.includes("refriger") || s.includes("fluido") || s.includes("evap") || s.includes("cond");
      })
    : teAboveAirTemp
      ? [`Te (${te} °C) ≥ Temp. entrada ar (${airTempIn} °C) — verificar condições`]
      : undefined;

  const geomErrors = geomStatus !== "ok" ? physCheckSidebar.errors : undefined;
  const sidebarCanCalculate = physCheckSidebar.isValid && thermoCheckSidebar.isValid;

  // ── Sidebar ──
  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => simState.trigger()}
      onReset={handleReset}
      isCalculating={isCalculating}
      canCalculate={sidebarCanCalculate}
    >
      <div className="mb-3 rounded bg-[#1E6FD9] px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">
        Evaporador DX
      </div>

      <NavCard
        title="Modo de Cálculo"
        status={modeStatus}
        lines={[
          `Objetivo: ${calcMode === "verify" ? "Verificar" : "Desenho"}`,
          `Motor: ${engineMode === "v1" ? "V1 NTU-ε" : "V2 ASHRAE"}`,
        ]}
      />

      <NavCard
        title="Geometria do Aletado"
        status={geomStatus}
        errors={geomErrors}
        onEdit={() => setGeomPickerOpen(true)}
        lines={[
          geomHeight && geomWidth && geomDepth
            ? `${geomHeight} × ${geomWidth} × ${geomDepth} mm`
            : "Não configurada",
        ]}
      />

      <NavCard
        title="Lado Ventilação"
        status={ventStatus}
        errors={ventErrors}
        lines={[
          airFlow ? `Vazão: ${airFlow.toLocaleString("pt-BR")} m³/h` : "Vazão não informada",
          airTempIn !== undefined ? `Entrada: ${airTempIn} °C / ${airRH}% UR` : "",
          selectedFan
            ? `Ventilador: ${[selectedFan.manufacturer, selectedFan.model].filter(Boolean).join(" ")}`
            : fanMode === "manual" ? "Ventilador: Manual" : "Ventilador não selecionado",
        ].filter(Boolean)}
      />

      <NavCard
        title="Lado Fluido / Refrigerante"
        status={fluidStatus}
        errors={fluidErrors}
        lines={[
          refrigerantId ? `Fluido: ${refrigerantId}` : "Fluido não selecionado",
          selectedCompressorRow
            ? `Compressor: ${selectedCompressorRow.model ?? selectedCompressorRow.id}`
            : "Compressor não selecionado",
          `Te: ${fmt(te, 1)} °C | Tc: ${fmt(tc, 1)} °C`,
          `SH: ${superheat} K | SC: ${subcooling} K`,
        ]}
      />

      <NavCard
        title="Condições Operacionais"
        status={opsStatus}
        lines={[
          `Padrão: ${compressorMode === "ari" ? "ARI 540" : compressorMode === "constant" ? "Constante" : "Manual"}`,
          `${frequency} Hz | ${voltage} V`,
        ]}
      />
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
      <ProjectHeaderBar workspaceType="component_workspace" onNovoAletado={handleNovoAletado} />
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
              onCalculate={() => simState.trigger()}
              onReset={handleReset}
              isCalculating={isCalculating}
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
              staticPressure={staticPressure}
              fanMode={fanMode}
              te={te}
              tc={tc}
              superheat={superheat}
              subcooling={subcooling}
              massFlow={massFlow}
              calcMode={calcMode}
              engineMode={engineMode}
              compressorMode={compressorMode}
              frequency={frequency}
              setGeomHeight={setGeomHeight}
              setGeomWidth={setGeomWidth}
              setGeomDepth={setGeomDepth}
              setFinPitch={setFinPitch}
              setTubeDiam={setTubeDiam}
              setCircuits={setCircuits}
              setRows={setRows}
              setTubesPerRow={setTubesPerRow}
              setAirFlow={setAirFlow}
              setAirTempIn={setAirTempIn}
              setAirRH={setAirRH}
              setStaticPressure={setStaticPressure}
              setSafetyFactor={setSafetyFactor}
              setFanMode={setFanMode}
              setRefrigerantId={setRefrigerantId}
              setTe={setTe}
              setTc={setTc}
              setSuperheat={setSuperheat}
              setSubcooling={setSubcooling}
              setMassFlow={setMassFlow}
              setCalcMode={setCalcMode}
              setEngineMode={setEngineMode}
              setCompressorMode={setCompressorMode}
              setFrequency={setFrequency}
              onOpenGeometryPicker={() => setGeomPickerOpen(true)}
              onOpenGeomModal={(t) => setActiveGeomModal(t)}
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

      <GeometryPickerModal
        open={geomPickerOpen}
        onClose={() => setGeomPickerOpen(false)}
        componentType="evaporator_dx"
      />
      <TubeModal
        open={activeGeomModal === "tube"}
        onClose={() => setActiveGeomModal(null)}
      />
      <FinModal
        open={activeGeomModal === "fin"}
        onClose={() => setActiveGeomModal(null)}
      />
      <DistributorModal
        open={activeGeomModal === "distributor"}
        onClose={() => setActiveGeomModal(null)}
      />

      <PostSaveNextStepDialog
        open={nextStepOpen}
        onOpenChange={setNextStepOpen}
        next="condenser"
      />
    </WorkspaceLayout>
  );
}

// ── NumField helper ─────────────────────────────────────────────────────────
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const inputProps = useNumericInput(value, (v) => onChange(v ?? 0));
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        {...inputProps}
        className="h-8 text-xs"
      />
    </div>
  );
}

function ResultsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5 p-2">{children}</div>
    </div>
  );
}

function ResultsLine({ label, value }: { label: string; value: string }) {
  const hasValue = value !== "---" && !value.startsWith("---");
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${hasValue ? "text-foreground" : "text-slate-400"}`}>
        {value}
      </span>
    </div>
  );
}

function ResultsPanel() {
  const result = useCnCoilsSimulationStore((s) => s.result);
  const warnings = useCnCoilsSimulationStore((s) => s.warnings);
  const physicalInputs = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const fluid = useCnCoilsSimulationStore((s) => s.fluid);
  const fluidOperatingTemp_C = useCnCoilsSimulationStore((s) => s.fluidOperatingTemp_C);

  const hasResult = !!result;
  const nTubesPerRow =
    physicalInputs.tubesPerRow ??
    (physicalInputs.finnedHeightMm && physicalInputs.tubePitchTransverseMm
      ? Math.round(physicalInputs.finnedHeightMm / physicalInputs.tubePitchTransverseMm)
      : 0);
  const derived = calcCoilDerivedDimensions({
    nTubesPerRow,
    tubePitchTransverse_mm: physicalInputs.tubePitchTransverseMm ?? 0,
    nRows: physicalInputs.rows ?? 0,
    tubePitchLongitudinal_mm: physicalInputs.tubePitchLongitudinalMm ?? 0,
    lengthMm: physicalInputs.finnedLengthMm ?? 0,
    refrigerant: fluid,
    T_evap_C: fluidOperatingTemp_C,
    tubeID_m: (physicalInputs.tubeInnerDiameterMm ?? 0) / 1000,
    tubeOD_m: (physicalInputs.tubeOuterDiameterMm ?? 0) / 1000,
    nCircuits: physicalInputs.circuits ?? 0,
    finThickness_m: (physicalInputs.finThicknessMm ?? 0.13) / 1000,
    finPitch_m: (physicalInputs.finPitchMm ?? 2.5) / 1000,
    tubeMaterial: "copper",
    finMaterial: "aluminum",
  });

  const hasWarn = warnings && warnings.length > 0;

  return (
    <div className="sticky top-4 space-y-2 text-[10px]">
      <div
        className={`rounded border px-2 py-1.5 text-center text-[10px] font-semibold ${
          !hasResult
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : hasWarn
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
        }`}
      >
        {!hasResult ? "Aguardando cálculo" : hasWarn ? `${warnings.length} alerta(s)` : "✓ Sem Avisos"}
      </div>

      <ResultsCard title="Superfície de Troca">
        <ResultsLine label="Área frontal" value={`${fmtBRUtil((derived.altura_mm * derived.largura_mm) / 1e6, 4)} m²`} />
      </ResultsCard>

      <ResultsCard title="Dimensões do Aletado">
        <ResultsLine label="Altura" value={`${fmtBRUtil(derived.altura_mm, 0)} mm`} />
        <ResultsLine label="Largura" value={`${fmtBRUtil(derived.largura_mm, 0)} mm`} />
        <ResultsLine label="Profund." value={`${fmtBRUtil(derived.prof_mm, 0)} mm`} />
      </ResultsCard>

      <ResultsCard title="Volume e Carga">
        <ResultsLine label="Volume interno" value={`${fmtBRUtil(derived.volumeInterno_L, 2)} L`} />
        <ResultsLine label="Carga refrig." value={`${fmtBRUtil(derived.cargaRefrigerante_kg, 2)} kg`} />
      </ResultsCard>

      <ResultsCard title="Peso do Aletado">
        <ResultsLine label="Peso seco" value={`${fmtBRUtil(derived.pesoSeco_kg, 2)} kg`} />
        <ResultsLine label="Peso c/ fluido" value={`${fmtBRUtil(derived.pesoComFluido_kg, 2)} kg`} />
      </ResultsCard>

      {derived.gabinete_largura_mm > 0 && (
        <ResultsCard title="Gabinete">
          <div className="rounded bg-muted/30 px-1.5 py-1 text-center font-mono text-[11px] font-semibold text-foreground">
            {fmtBRUtil(derived.gabinete_largura_mm, 0)} × {fmtBRUtil(derived.gabinete_altura_mm, 0)} × {fmtBRUtil(derived.gabinete_prof_mm, 0)} mm
          </div>
        </ResultsCard>
      )}
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

type DetailedWorkspaceTabProps = {
  geomHeight: number;
  setGeomHeight: (value: number) => void;
  geomWidth: number;
  setGeomWidth: (value: number) => void;
  geomDepth: number;
  setGeomDepth: (value: number) => void;
  finPitch: number;
  setFinPitch: (value: number) => void;
  tubeDiam: number;
  setTubeDiam: (value: number) => void;
  circuits: number;
  setCircuits: (value: number) => void;
  rows: number;
  setRows: (value: number) => void;
  tubesPerRow: number;
  setTubesPerRow: (value: number) => void;
  airFlow: number;
  setAirFlow: (value: number) => void;
  airTempIn: number;
  setAirTempIn: (value: number) => void;
  airRH: number;
  setAirRH: (value: number) => void;
  staticPressure: number;
  setStaticPressure: (value: number) => void;
  safetyFactor: number;
  setSafetyFactor: (value: number) => void;
  fanMode: "manual" | "catalog";
  setFanMode: (value: "manual" | "catalog") => void;
  refrigerantId: string;
  setRefrigerantId: (value: string) => void;
  te: number;
  setTe: (value: number) => void;
  tc: number;
  setTc: (value: number) => void;
  superheat: number;
  setSuperheat: (value: number) => void;
  subcooling: number;
  setSubcooling: (value: number) => void;
  massFlow: number;
  setMassFlow: (value: number) => void;
  calcMode: CalcMode;
  setCalcMode: (value: CalcMode) => void;
  engineMode: EngineMode;
  setEngineMode: (value: EngineMode) => void;
  compressorMode: CompressorMode;
  setCompressorMode: (value: CompressorMode) => void;
  frequency: number;
  setFrequency: (value: number) => void;
  cycleResult: CycleResult | null;
  onCalculate: () => void;
  onReset: () => void;
  onOpenAI: () => void;
  isCalculating: boolean;
  onOpenGeometryPicker: () => void;
  onOpenGeomModal: (type: "tube" | "fin" | "distributor") => void;
};

function DetailedWorkspaceTab({
  geomHeight,
  setGeomHeight,
  geomWidth,
  setGeomWidth,
  geomDepth,
  setGeomDepth,
  finPitch,
  setFinPitch,
  tubeDiam,
  setTubeDiam,
  circuits,
  setCircuits,
  rows,
  setRows,
  tubesPerRow,
  setTubesPerRow,
  airFlow,
  setAirFlow,
  airTempIn,
  setAirTempIn,
  airRH,
  setAirRH,
  staticPressure,
  setStaticPressure,
  safetyFactor,
  setSafetyFactor,
  fanMode,
  setFanMode,
  refrigerantId,
  setRefrigerantId,
  te,
  setTe,
  tc,
  setTc,
  superheat,
  setSuperheat,
  subcooling,
  setSubcooling,
  massFlow,
  setMassFlow,
  calcMode,
  setCalcMode,
  engineMode,
  setEngineMode,
  compressorMode,
  setCompressorMode,
  frequency,
  setFrequency,
  cycleResult,
  onCalculate,
  onReset,
  onOpenAI,
  isCalculating,
  onOpenGeometryPicker,
  onOpenGeomModal,
}: DetailedWorkspaceTabProps) {
  const catalogs = useCnCoilsCatalogs();
  const physical = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const thermo = useCnCoilsSimulationStore((s) => s.thermoInputs);
  const result = useCnCoilsSimulationStore((s) => s.result);
  const warnings = useCnCoilsSimulationStore((s) => s.warnings);
  const isSimulating = useCnCoilsSimulationStore((s) => s.isSimulating);
  const reset = useCnCoilsSimulationStore((s) => s.reset);
  const setWarnings = useCnCoilsSimulationStore((s) => s.setWarnings);
  useCnCoilsInputBridge("evaporator_dx");

  const simulationDeps = useMemo(
    () => ({
      geometries: catalogs.geometries,
      tubeMaterials: catalogs.tubeMaterials,
      correctionCoefficients: catalogs.correctionCoefficients,
      pressureDropFan: catalogs.pressureDropFan,
    }),
    [
      catalogs.geometries,
      catalogs.tubeMaterials,
      catalogs.correctionCoefficients,
      catalogs.pressureDropFan,
    ],
  );
  const { run } = useCnCoilsSimulation(simulationDeps);
  const { run: runV2 } = useCnCoilsSimulationV2({
    tubeMaterials: catalogs.tubeMaterials,
    geometries: catalogs.geometries,
    componentType: "evaporator_dx",
  });
  const physCheck = validatePhysicalInputs(physical);
  const thermoCheck = validateThermoInputs(thermo);
  const inputsValid = physCheck.isValid && thermoCheck.isValid;
  const validationWarnings = useMemo(
    () =>
      [...physCheck.errors, ...thermoCheck.errors].map((message) => ({
        code: "VALIDATION_ERROR",
        message,
        severity: "warning" as const,
      })),
    [physCheck.errors, thermoCheck.errors],
  );
  const visibleWarnings: StructuredWarning[] = inputsValid ? warnings : validationWarnings;
  const enrichedWarnings = useMemo(
    () =>
      enrichWarnings(
        visibleWarnings
          .map((warning) => warning.message)
          .filter((message): message is string => typeof message === "string"),
      ),
    [visibleWarnings],
  );
  const canSimulate = catalogs.ready && inputsValid && !isSimulating;
  const disabledReason = !catalogs.ready
    ? "Carregando catálogos…"
    : !inputsValid
      ? `Preencha: ${[...physCheck.errors, ...thermoCheck.errors].join(" • ")}`
      : undefined;

  const handleSimulate = () => {
    const latestPhysCheck = validatePhysicalInputs(useCnCoilsSimulationStore.getState().physicalInputs);
    const latestThermoCheck = validateThermoInputs(useCnCoilsSimulationStore.getState().thermoInputs);
    const errors = [...latestPhysCheck.errors, ...latestThermoCheck.errors];
    if (errors.length > 0) {
      setWarnings(
        errors.map((message) => ({
          code: "GEOMETRY_INCOMPLETE",
          message,
          severity: "warning" as const,
        })),
      );
      return;
    }
    // Lê engineVersion diretamente do store para garantir valor atual
    // (o WorkspaceSidebar muda o store diretamente, sem passar pelo prop engineMode)
    const currentEngineVersion = useCnCoilsSimulationStore.getState().engineVersion;
    if (currentEngineVersion === "v2") {
      runV2();
    } else {
      run();
    }
    setTimeout(onCalculate, 0);
  };

  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Formulário principal / dados do ambiente
        </h3>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_240px]">
          {/* Coluna 1 — Lado Ventilação */}
          <div className="min-w-0 rounded-md border border-border bg-card shadow-sm">
            <AirSidePanel result={result} disabled={!catalogs.ready} />
          </div>

          {/* Coluna 2 — Lado Fluido */}
          <div className="min-w-0 rounded-md border border-border bg-card shadow-sm">
            <FluidSidePanel
              componentType="evaporator_dx"
              refrigerants={catalogs.refrigerants}
              disabled={!catalogs.ready}
              result={result}
            />
          </div>

          {/* Coluna 3 — Resultados (sticky) */}
          <div className="min-w-0">
            <ResultsPanel />
          </div>
        </div>
      </section>

      <section className="mt-2 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Dados técnicos e premissas
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onOpenGeometryPicker}
          >
            Selecionar Geometria do Catálogo…
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onOpenGeomModal("tube")}
          >
            Tubo…
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onOpenGeomModal("fin")}
          >
            Aleta…
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onOpenGeomModal("distributor")}
          >
            Distribuidor…
          </Button>
        </div>
        <GeometryBottomBar />
        <CircuitrySelector />
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Resultado do cálculo
        </h3>
        <ResultPanel result={result} warnings={[]} onGoalSeek={() => {}} />
      </section>

      <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
            🏭 Fonte da Verdade — Avisos e validações
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
            onClick={onOpenAI}
          >
            <Bot className="h-3.5 w-3.5" />
            IA Especialista
          </Button>
        </div>
        <EnrichedWarningsPanel warnings={enrichedWarnings} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Auditoria / logs / mensagens técnicas
        </h3>
        {catalogs.loading && (
          <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            Carregando catálogos…
          </div>
        )}
        {!catalogs.loading && !catalogs.ready && (
          <DatasetStatusPanel
            loading={catalogs.loading}
            ready={catalogs.ready}
            errors={catalogs.errors}
            missing={catalogs.missing}
            compact
          />
        )}
      </section>
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
  airFlow,
  airTempIn,
  airRH,
  staticPressure,
  fanMode,
  te,
  tc,
  superheat,
  subcooling,
  massFlow,
  calcMode,
  engineMode,
  compressorMode,
  frequency,
  setGeomHeight,
  setGeomWidth,
  setGeomDepth,
  setFinPitch,
  setTubeDiam,
  setCircuits,
  setRows,
  setTubesPerRow,
  setAirFlow,
  setAirTempIn,
  setAirRH,
  setStaticPressure,
  setSafetyFactor,
  setFanMode,
  setRefrigerantId,
  setTe,
  setTc,
  setSuperheat,
  setSubcooling,
  setMassFlow,
  setCalcMode,
  setEngineMode,
  setCompressorMode,
  setFrequency,
  onOpenGeometryPicker,
  onOpenGeomModal,
  onCalculate,
  onReset,
  isCalculating,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult | null;
  frontalVelocity: number;
  safetyFactor: number;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onOpenAI: (tabName: string) => void;
  onCalculate: () => void;
  onReset: () => void;
  isCalculating: boolean;
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
  staticPressure: number;
  fanMode: "manual" | "catalog";
  te: number;
  tc: number;
  superheat: number;
  subcooling: number;
  massFlow: number;
  calcMode: CalcMode;
  engineMode: EngineMode;
  compressorMode: CompressorMode;
  frequency: number;
  setGeomHeight: (value: number) => void;
  setGeomWidth: (value: number) => void;
  setGeomDepth: (value: number) => void;
  setFinPitch: (value: number) => void;
  setTubeDiam: (value: number) => void;
  setCircuits: (value: number) => void;
  setRows: (value: number) => void;
  setTubesPerRow: (value: number) => void;
  setAirFlow: (value: number) => void;
  setAirTempIn: (value: number) => void;
  setAirRH: (value: number) => void;
  setStaticPressure: (value: number) => void;
  setSafetyFactor: (value: number) => void;
  setFanMode: (value: "manual" | "catalog") => void;
  setRefrigerantId: (value: string) => void;
  setTe: (value: number) => void;
  setTc: (value: number) => void;
  setSuperheat: (value: number) => void;
  setSubcooling: (value: number) => void;
  setMassFlow: (value: number) => void;
  setCalcMode: (value: CalcMode) => void;
  setEngineMode: (value: EngineMode) => void;
  setCompressorMode: (value: CompressorMode) => void;
  setFrequency: (value: number) => void;
  onOpenGeometryPicker: () => void;
  onOpenGeomModal: (type: "tube" | "fin" | "distributor") => void;
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
                RH_saida_pct: cycleResult.evaporatorResult.airOutletRH * 100,
              }}
              hotGasSource={{
                T_discharge_C: cycleResult.statePoints.point2_compOut.T_C,
                h_discharge_kJkg: cycleResult.statePoints.point2_compOut.h_kJkg,
                h_condOut_kJkg: cycleResult.statePoints.point3_condOut.h_kJkg,
                m_dot_total_kgS: cycleResult.m_dot_kgS,
                Tc_C: cycleResult.Tc_C,
              }}
              airFlowM3H={airFlow}
              evaporatorGeometry={{
                finnedHeightMm: geomHeight,
                finnedLengthMm: geomWidth,
                finPitchMm: finPitch,
                tubeOuterDiameterMm: tubeDiam,
                tubeInnerDiameterMm: Math.max(1, tubeDiam - 1),
                tubePitchTransverseMm: 25,
                tubePitchLongitudinalMm: 22,
              }}
            />
          </div>
        ) : <EmptyState />}
      </TabsContent>
      {/* ── Aba Detalhado — PRIMEIRA, fonte da verdade ── */}
      <TabsContent value={WORKSPACE_TABS.DETAILED} className="mt-3">
        <DetailedWorkspaceTab
          geomHeight={geomHeight}
          setGeomHeight={setGeomHeight}
          geomWidth={geomWidth}
          setGeomWidth={setGeomWidth}
          geomDepth={geomDepth}
          setGeomDepth={setGeomDepth}
          finPitch={finPitch}
          setFinPitch={setFinPitch}
          tubeDiam={tubeDiam}
          setTubeDiam={setTubeDiam}
          circuits={circuits}
          setCircuits={setCircuits}
          rows={rows}
          setRows={setRows}
          tubesPerRow={tubesPerRow}
          setTubesPerRow={setTubesPerRow}
          airFlow={airFlow}
          setAirFlow={setAirFlow}
          airTempIn={airTempIn}
          setAirTempIn={setAirTempIn}
          airRH={airRH}
          setAirRH={setAirRH}
          staticPressure={staticPressure}
          setStaticPressure={setStaticPressure}
          safetyFactor={safetyFactor}
          setSafetyFactor={setSafetyFactor}
          fanMode={fanMode}
          setFanMode={setFanMode}
          refrigerantId={refrigerantId}
          setRefrigerantId={setRefrigerantId}
          te={te}
          setTe={setTe}
          tc={tc}
          setTc={setTc}
          superheat={superheat}
          setSuperheat={setSuperheat}
          subcooling={subcooling}
          setSubcooling={setSubcooling}
          massFlow={massFlow}
          setMassFlow={setMassFlow}
          calcMode={calcMode}
          setCalcMode={setCalcMode}
          engineMode={engineMode}
          setEngineMode={setEngineMode}
          compressorMode={compressorMode}
          setCompressorMode={setCompressorMode}
          frequency={frequency}
          setFrequency={setFrequency}
          cycleResult={cycleResult}
          onCalculate={() => onOpenAI("Detalhado")}
          onReset={() => {}}
          onOpenAI={() => onOpenAI("Detalhado")}
          isCalculating={false}
          onOpenGeometryPicker={onOpenGeometryPicker}
          onOpenGeomModal={onOpenGeomModal}
        />
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
  // Unidade global definida no Detalhado (Lado Ventilação) — replica aqui.
  const displayUnit = useCnCoilsSimulationStore((s) => s.displayCapacityUnit);
  const errorFactorPercent = useCnCoilsSimulationStore((s) => s.errorFactorPercent);
  const calcMode = useCnCoilsSimulationStore((s) => s.calcMode);
  const targetCapacityW = useCnCoilsSimulationStore((s) => s.targetCapacityW);
  // Resultado canônico do motor CN Coils (mesma fonte do Detalhado).
  const cnResult = useCnCoilsSimulationStore((s) => s.result);

  const evap = result.evaporatorResult;
  const airSafetyFactor = 1 + (Number.isFinite(errorFactorPercent) ? errorFactorPercent : 0) / 100;

  // Prefer Detalhado (cnResult) → garante coerência com o que o usuário vê
  // no Lado Ventilação. Fallback para o cycleResult quando ainda não houver.
  const totalW_raw = cnResult?.totalCapacityKw !== undefined
    ? cnResult.totalCapacityKw * 1000
    : evap.totalCapacityW;
  const sensW_raw = cnResult?.sensibleCapacityKw !== undefined
    ? cnResult.sensibleCapacityKw * 1000
    : evap.sensibleCapacityW;
  const latW_raw = cnResult?.latentCapacityKw !== undefined
    ? cnResult.latentCapacityKw * 1000
    : evap.latentCapacityW;

  const isDesign = calcMode === "design";
  const Q_total_W = isDesign && targetCapacityW > 0
    ? targetCapacityW
    : totalW_raw * airSafetyFactor;
  const SHR_calc = totalW_raw > 0 ? sensW_raw / totalW_raw : 0;
  const Q_sens_W = isDesign && targetCapacityW > 0 ? Q_total_W * SHR_calc : sensW_raw * airSafetyFactor;
  const Q_lat_W = isDesign && targetCapacityW > 0 ? Q_total_W * (1 - SHR_calc) : latW_raw * airSafetyFactor;

  const SHR = Q_total_W > 0 ? Q_sens_W / Q_total_W : 0;
  const EER = result.COP * 3.412;
  const area = evaporatorAreaM2(config);
  const dT_LMTD = Math.max(1, config.evaporator.airInletTempC - result.Te_C);
  const UA = Q_total_W / dT_LMTD;
  const NTU = UA / Math.max(1, ((config.evaporator.airFlowM3H * 1.2) / 3600) * 1005);
  const effectiveness = 1 - Math.exp(-NTU);

  const Twb_out = evap.airOutletTempC - 1.5;
  const v_fluid = result.m_dot_kgS / 50;

  // Conversão para a unidade selecionada globalmente no Detalhado.
  const unitLabel = CAPACITY_UNITS.find((u) => u.id === displayUnit)?.label ?? displayUnit;
  const capDec = displayUnit === "kW" || displayUnit === "TR" ? 2 : 0;
  const Q_total_disp = capacityConv.fromCanonical(Q_total_W, displayUnit);
  const Q_sens_disp = capacityConv.fromCanonical(Q_sens_W, displayUnit);
  const Q_lat_disp = capacityConv.fromCanonical(Q_lat_W, displayUnit);

  const sourceHint = cnResult ? "Detalhado · Lado Ventilação" : "Ciclo termodinâmico";
  const totalHint = isDesign && targetCapacityW > 0
    ? `Alvo (Desenho): ${fmt(capacityConv.fromCanonical(targetCapacityW, displayUnit), capDec)} ${unitLabel}`
    : errorFactorPercent !== 0
      ? `${sourceHint} · fator ${errorFactorPercent > 0 ? "+" : ""}${errorFactorPercent}%`
      : sourceHint;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <ResultCard label="Capacidade Total" value={fmt(Q_total_disp, capDec)} unit={unitLabel} variant="success" hint={totalHint} />
      <ResultCard label="Cap. Sensível" value={fmt(Q_sens_disp, capDec)} unit={unitLabel} />
      <ResultCard label="Cap. Latente" value={fmt(Q_lat_disp, capDec)} unit={unitLabel} />
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
        <UncertaintyBadge band={result.totalCapacityW} format={(v) => fmt(convertCapacity(v / 1000, useUnitStore.getState().capacityUnit), useUnitStore.getState().capacityUnit === 'kW' || useUnitStore.getState().capacityUnit === 'TR' ? 2 : 0)} unit={useUnitStore.getState().capacityUnit} />
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
