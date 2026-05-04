import { useEffect, useMemo, useRef, useState } from "react";
import { Snowflake, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { useFrostAnalysis } from "../hooks/useFrostAnalysis";
import { useUncertaintyAnalysis } from "../hooks/useUncertaintyAnalysis";
import { useOperatingMap } from "../hooks/useOperatingMap";
import { CoilEnvelopeTab } from "../components/CoilEnvelopeTab";
import { CoilsInSeriesPanel } from "../components/CoilsInSeriesPanel";
import { FrostAnalysisTab } from "../components/FrostAnalysisTab";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { CyclePHDiagram } from "../components/CyclePHDiagram";
import { FrostAnalysisPanel } from "../components/FrostAnalysisPanel";
import { CycleResultPanel } from "../components/CycleResultPanel";
import { UncertaintyPanel, UncertaintyBadge } from "../components/UncertaintyBadge";
import { OperatingMapChart } from "../components/OperatingMapChart";
import { OptimizationPanel } from "../components/OptimizationPanel";
import { CompressorPickerModal } from "../components/CompressorPickerModal";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { DrawingTab } from "../components/drawing/DrawingTab";
import { WorkspaceAIPanel } from "../components/WorkspaceAIPanel";
import type { AIContext } from "../components/WorkspaceAIChat";
import { ProjectHeaderBar } from "../components/ProjectHeaderBar";
import { ResultCard } from "../components/ResultCard";
import { ActionBar } from "../components/ActionBar";
import { usePdfExport } from "../hooks/usePdfExport";
import { listAvailableRefrigerants } from "../engines/refrigerant/refrigerantProperties";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CoilCycleInputs, CoilCycleResult } from "../engines/coil/coilCycleAdapter";
import type { CycleResult, CycleSystemConfig } from "../engines/cycle/cycleTypes";
import type { ExpansionDeviceType } from "../engines/expansion/expansionTypes";

// ── Refrigerantes agrupados ─────────────────────────────────────────────────
const REFRIGERANT_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "HFC Comuns", ids: ["R404A", "R410A", "R32", "R134a", "R507A"] },
  {
    label: "HFO / Low-GWP",
    ids: ["R448A", "R449A", "R452A", "R452B", "R454B", "R454C", "R455A", "R1234yf", "R1234ze(E)", "R1233zd(E)", "R513A", "R515B", "R450A"],
  },
  { label: "Hidrocarbonetos", ids: ["R290", "R600", "R600a", "R1270"] },
  { label: "Naturais", ids: ["R717", "R744"] },
  { label: "Legacy", ids: ["R22", "R407A", "R407C", "R407F", "R422D"] },
  { label: "Especiais", ids: ["R125", "R143a", "R152a", "R245fa", "R236fa", "R227ea", "R123"] },
];

type CompressorMode = "bitzer" | "ari" | "constant";
type CycleActiveTab = "ph" | "results" | "envelope" | "frost-analysis" | "map" | "uncertainty" | "optimization" | "series" | "frost" | "drawing" | "report";

const DEFAULT_CONFIG: CycleSystemConfig = {
  id: "demo-01",
  name: "Câmara Fria — Demonstração",
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
      rows: 4,
      finnedLengthMm: 1250,
      finnedHeightMm: 400,
      finPitchMm: 6,
      tubePitchTransversalMm: 38.1,
      tubePitchLongitudinalMm: 33,
      tubeExternalDiameterMm: 12.7,
      tubeInternalDiameterMm: 11.5,
      tubesPerRow: 10,
      circuits: 5,
      finThicknessMm: 0.15,
      finType: "plain",
    },
    airInletTempC: 5,
    airRelativeHumidity: 0.85,
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

const fmt = (v: number, d = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function CycleWorkspacePage() {
  const [refrigerantId, setRefrigerantId] = useState(DEFAULT_CONFIG.refrigerantId);
  const [te, setTe] = useState(DEFAULT_CONFIG.solver?.Te_initial_C ?? -10);
  const [tc, setTc] = useState(DEFAULT_CONFIG.solver?.Tc_initial_C ?? 40);
  const [superheat, setSuperheat] = useState(5);
  const [subcooling, setSubcooling] = useState(5);
  const [expansionType, setExpansionType] = useState<ExpansionDeviceType>("txv");
  const [shTarget, setShTarget] = useState(5);
  const [capLength, setCapLength] = useState(1.5);
  const [capDiameter, setCapDiameter] = useState(1.4);
  const [orificeDiameter, setOrificeDiameter] = useState(1.8);
  const [compressorMode, setCompressorMode] = useState<CompressorMode>("bitzer");
  const [compressorPickerOpen, setCompressorPickerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [cycleActiveTab, setCycleActiveTab] = useState<CycleActiveTab>("ph");
  const [refrigerantsMeta, setRefrigerantsMeta] = useState<
    Array<{ id: string; name: string; category: string }>
  >([]);

  useEffect(() => {
    listAvailableRefrigerants()
      .then((list) =>
        setRefrigerantsMeta(
          list.map((r) => ({ id: r.id, name: r.name, category: r.category })),
        ),
      )
      .catch(() => setRefrigerantsMeta([]));
  }, []);

  const config = useMemo<CycleSystemConfig>(() => {
    const exp: CycleSystemConfig["expansionDevice"] = (() => {
      if (expansionType === "none") return {};
      if (expansionType === "txv" || expansionType === "eev")
        return { type: expansionType, superheatTarget_K: shTarget };
      if (expansionType === "capillary")
        return {
          type: "capillary",
          capillaryLength_m: capLength,
          device: {
            type: "capillary",
            lengthM: capLength,
            internalDiameterMm: capDiameter,
          },
        };
      return {
        type: "fixed_orifice",
        device: {
          type: "fixed_orifice",
          orificeDiameterMm: orificeDiameter,
          dischargeCoefficient: 0.65,
        },
      };
    })();

    return {
      ...DEFAULT_CONFIG,
      refrigerantId,
      compressor: { ...DEFAULT_CONFIG.compressor, refrigerant: refrigerantId },
      evaporator: { ...DEFAULT_CONFIG.evaporator, superheatK: superheat },
      condenser: { ...DEFAULT_CONFIG.condenser, subcoolingK: subcooling },
      expansionDevice: exp,
      solver: { ...DEFAULT_CONFIG.solver, Te_initial_C: te, Tc_initial_C: tc },
    };
  }, [refrigerantId, te, tc, superheat, subcooling, expansionType, shTarget, capLength, capDiameter, orificeDiameter]);

  const simState = useCycleSimulation(config, { mode: "manual" });
  const cycleResult: CycleResult | null =
    simState.status === "success" ? simState.result : null;
  const { isGenerating: isExportingPdf, exportPdf } = usePdfExport();

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    simState.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setRefrigerantId(DEFAULT_CONFIG.refrigerantId);
    setTe(DEFAULT_CONFIG.solver?.Te_initial_C ?? -10);
    setTc(DEFAULT_CONFIG.solver?.Tc_initial_C ?? 40);
    setSuperheat(5);
    setSubcooling(5);
    setExpansionType("txv");
    setShTarget(5);
  };

  const handleExportPdf = () => {
    if (!cycleResult) {
      toast.error("Execute o cálculo antes de exportar o PDF.");
      return;
    }
    exportPdf(
      <WorkspacePdfReport
        componentType="evaporator"
        title="Evaporador DX"
        inputs={{
          Refrigerante: config.refrigerantId,
          "Te inicial": `${te} °C`,
          "Tc inicial": `${tc} °C`,
          "Vazão de ar": `${config.evaporator.airFlowM3H.toLocaleString("pt-BR")} m³/h`,
        }}
        results={{
          "Capacidade real": `${fmt(cycleResult.Q_evap_W / 1000, 2)} kW`,
          COP: fmt(cycleResult.COP, 2),
          "Te eq": `${fmt(cycleResult.Te_C, 1)} °C`,
          "Tc eq": `${fmt(cycleResult.Tc_C, 1)} °C`,
          "ΔP ar": `${fmt(cycleResult.evaporatorResult.airPressureDropPa, 0)} Pa`,
        }}
        warnings={cycleResult.warnings}
      />,
      `evaporador-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const handleSave = () => {
    toast.success("Projeto salvo (em memória).");
  };
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };
  const handleExportCsv = () => toast.info("Exportação CSV em desenvolvimento.");
  const handleExportExcel = () => toast.info("Exportação Excel em desenvolvimento.");

  const badges = [refrigerantId, `Te: ${fmt(te, 0)}°C`, `Tc: ${fmt(tc, 0)}°C`];
  const hasResults = !!cycleResult;
  const isCalculating = simState.status === "running";

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => simState.trigger()}
      onReset={handleReset}
      isCalculating={isCalculating}
    >
      <Accordion type="multiple" defaultValue={["ref", "comp", "exp", "ops"]} className="w-full">
        <AccordionItem value="ref">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Refrigerante
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Select value={refrigerantId} onValueChange={setRefrigerantId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {REFRIGERANT_GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.ids.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const meta = refrigerantsMeta.find((r) => r.id === refrigerantId);
              return meta ? (
                <div className="text-[10px] text-muted-foreground">
                  {meta.name} · <span className="uppercase">{meta.category.replace("_", " ")}</span>
                </div>
              ) : null;
            })()}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="comp">
          <AccordionTrigger className="text-xs uppercase tracking-wide">Compressor</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <div className="flex gap-1">
              {(["bitzer", "ari", "constant"] as CompressorMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={compressorMode === m ? "default" : "outline"}
                  className="flex-1 h-7 text-[10px] px-1"
                  onClick={() => setCompressorMode(m)}
                >
                  {m === "bitzer" ? "Bitzer" : m === "ari" ? "ARI 540" : "Const."}
                </Button>
              ))}
            </div>
            {compressorMode === "bitzer" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCompressorPickerOpen(true)}
                  className="w-full h-8 text-xs"
                >
                  Selecionar compressor…
                </Button>
                <div className="rounded border border-border bg-muted/40 p-2 text-[10px]">
                  <div className="font-mono text-foreground">{DEFAULT_CONFIG.compressor.model}</div>
                  <div className="text-muted-foreground">
                    {DEFAULT_CONFIG.compressor.manufacturer} ·{" "}
                    {fmt(DEFAULT_CONFIG.compressor.bitzerNative?.displacement_m3h ?? 0, 2)} m³/h
                  </div>
                </div>
              </>
            )}
            {compressorMode === "ari" && (
              <Input placeholder="Buscar modelo ARI 540…" className="h-8 text-xs" />
            )}
            {compressorMode === "constant" && (
              <div className="space-y-2 text-[10px]">
                <div>
                  <Label className="text-muted-foreground">ηv</Label>
                  <Slider defaultValue={[80]} min={0} max={100} step={1} />
                </div>
                <div>
                  <Label className="text-muted-foreground">ηs</Label>
                  <Slider defaultValue={[70]} min={0} max={100} step={1} />
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="exp">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Dispositivo de Expansão
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Select value={expansionType} onValueChange={(v) => setExpansionType(v as ExpansionDeviceType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Desabilitado</SelectItem>
                <SelectItem value="txv">TXV</SelectItem>
                <SelectItem value="eev">EEV</SelectItem>
                <SelectItem value="capillary">Capilar</SelectItem>
                <SelectItem value="fixed_orifice">Orifício Fixo</SelectItem>
              </SelectContent>
            </Select>

            {(expansionType === "txv" || expansionType === "eev") && (
              <div>
                <Label className="text-[10px] text-muted-foreground">SH alvo (K)</Label>
                <Input
                  type="number"
                  value={shTarget}
                  onChange={(e) => setShTarget(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            )}
            {expansionType === "capillary" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">L (m)</Label>
                  <Input type="number" value={capLength} step="0.1" onChange={(e) => setCapLength(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Di (mm)</Label>
                  <Input type="number" value={capDiameter} step="0.1" onChange={(e) => setCapDiameter(Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </div>
            )}
            {expansionType === "fixed_orifice" && (
              <div>
                <Label className="text-[10px] text-muted-foreground">Diâmetro (mm)</Label>
                <Input type="number" value={orificeDiameter} step="0.1" onChange={(e) => setOrificeDiameter(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ops">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Condições de Operação
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
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
              <Slider value={[tc]} min={20} max={70} step={1} onValueChange={(v) => setTc(v[0])} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Subresfr. (K)</Label>
                <Input
                  type="number"
                  value={subcooling}
                  onChange={(e) => setSubcooling(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Superaq. (K)</Label>
                <Input
                  type="number"
                  value={superheat}
                  onChange={(e) => setSuperheat(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
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
      <ProjectHeaderBar workspaceType="dx_complete" />
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card/30 px-4 py-2">
          <CycleStatusBar state={simState} result={cycleResult} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isCalculating && !cycleResult ? (
            <LoadingResults />
          ) : simState.status === "error" ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
              <p className="font-semibold text-red-500">Erro no CycleEngine</p>
              <p className="mt-2 text-sm text-muted-foreground">{simState.message}</p>
            </div>
          ) : cycleResult ? (
            <ResultsView config={config} cycleResult={cycleResult} activeTab={cycleActiveTab} onTabChange={setCycleActiveTab} />
          ) : (
            <EmptyResults />
          )}
        </div>

        <ActionBar
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          onShare={handleShare}
          hasResults={hasResults}
          isExportingPdf={isExportingPdf}
        />
      </div>

      <CompressorPickerModal
        open={compressorPickerOpen}
        onClose={() => setCompressorPickerOpen(false)}
      />
      <WorkspaceAIPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        context={{
          componentType: "Ciclo Completo DX",
          tabName: cycleActiveTab,
          parameters: cycleResult ? {
            "Refrigerante": config.refrigerantId,
            "Te (\u00b0C)": cycleResult.Te_C.toFixed(1),
            "Tc (\u00b0C)": cycleResult.Tc_C.toFixed(1),
          } : undefined,
          results: cycleResult ? {
            "Q evap (kW)": (cycleResult.Q_evap_W / 1000).toFixed(2),
            "COP": cycleResult.COP.toFixed(2),
            "W comp (kW)": (cycleResult.W_comp_W / 1000).toFixed(2),
          } : undefined,
          warnings: [],
        } satisfies AIContext}
      />
    </WorkspaceLayout>
  );
}

// ── Empty / Loading ─────────────────────────────────────────────────────────
function EmptyResults() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Calculator className="h-12 w-12 opacity-30" />
      <p className="text-sm">
        Configure os parâmetros e clique em <strong>Calcular</strong>
      </p>
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

// ── Status Bar ──────────────────────────────────────────────────────────────
function CycleStatusBar({
  state,
  result,
}: {
  state: ReturnType<typeof useCycleSimulation>;
  result: CycleResult | null;
}) {
  if (state.status === "running") {
    return (
      <div className="flex items-center gap-2 text-xs text-primary">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        Calculando…
      </div>
    );
  }
  if (state.status === "error") {
    return <Badge variant="destructive">Erro</Badge>;
  }
  if (!result) {
    return <Badge variant="secondary">Aguardando</Badge>;
  }
  const residualPct = (result.residual * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      {result.converged ? (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">🟢 Convergido</Badge>
      ) : (
        <Badge className="bg-amber-600 hover:bg-amber-600">🟡 Estimativa</Badge>
      )}
      <span className="text-muted-foreground">
        Resíduo <span className="font-mono text-foreground">{residualPct}%</span>
      </span>
      <span className="text-muted-foreground">
        Iter. <span className="font-mono text-foreground">{result.iterations}</span>
      </span>
    </div>
  );
}

// ── Results View ────────────────────────────────────────────────────────────
function ResultsView({
  config,
  cycleResult,
  activeTab,
  onTabChange,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
  activeTab: CycleActiveTab;
  onTabChange: (tab: CycleActiveTab) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResultCard
          label="Capacidade real"
          value={fmt(cycleResult.Q_evap_W / 1000, 2)}
          unit="kW"
          hint={`${fmt(cycleResult.Q_evap_W * 0.86 / 1000, 0)} kcal/h`}
          variant="success"
        />
        <ResultCard label="COP" value={fmt(cycleResult.COP, 2)} variant="default" />
        <ResultCard
          label="Te equilíbrio"
          value={fmt(cycleResult.Te_C, 1)}
          unit="°C"
          variant="default"
        />
        <ResultCard
          label="Tc equilíbrio"
          value={fmt(cycleResult.Tc_C, 1)}
          unit="°C"
          variant="default"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as CycleActiveTab)} className="w-full">
        <TabsList className="flex w-full overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
          <TabsTrigger value="ph" className="shrink-0">🔄 Ciclo P-H</TabsTrigger>
          <TabsTrigger value="results" className="shrink-0">📋 Resultados</TabsTrigger>
          <TabsTrigger value="envelope" className="shrink-0">📊 Envelope Q×Te</TabsTrigger>
          <TabsTrigger value="frost-analysis" className="shrink-0">❄️ Geada</TabsTrigger>
          <TabsTrigger value="map" className="shrink-0">📈 Mapa Operacional</TabsTrigger>
          <TabsTrigger value="uncertainty" className="shrink-0">📐 Incerteza</TabsTrigger>
          <TabsTrigger value="optimization" className="shrink-0">⚙️ Otimização</TabsTrigger>
          <TabsTrigger value="series" className="shrink-0">🔗 Coils em Série</TabsTrigger>
          <TabsTrigger value="frost" className="shrink-0">🧊 Geada Avançada</TabsTrigger>
          <TabsTrigger value="drawing" className="shrink-0">🏗️ Desenho</TabsTrigger>
          <TabsTrigger value="report" className="shrink-0">📄 Relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="ph" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <CyclePHDiagram
              result={cycleResult}
              refrigerantId={config.refrigerantId}
              width={620}
              height={360}
            />
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <CycleResultPanel result={cycleResult} />
          </div>
        </TabsContent>

        <TabsContent value="envelope" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <CoilEnvelopeTab equipmentId={config.id} />
          </div>
        </TabsContent>

        <TabsContent value="frost-analysis" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <FrostAnalysisTab
              Te={cycleResult.Te_C}
              Tair_in={config.evaporator.airInletTempC}
              RH={config.evaporator.airRelativeHumidity}
              Q_nominal={cycleResult.Q_evap_W}
              geometry={config.id}
            />
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-3">
          <OperatingMapTab config={config} cycleResult={cycleResult} />
        </TabsContent>

        <TabsContent value="uncertainty" className="mt-3">
          <UncertaintyTab config={config} cycleResult={cycleResult} />
        </TabsContent>

        <TabsContent value="optimization" className="mt-3">
          <OptimizationTab config={config} cycleResult={cycleResult} />
        </TabsContent>

        <TabsContent value="series" className="mt-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <CoilsInSeriesPanel
              primaryCoilResult={{
                deltaP_Pa: cycleResult.evaporatorResult.airPressureDropPa,
                Q_kcalh: cycleResult.evaporatorResult.totalCapacityW * 0.86,
                T_ar_saida: cycleResult.evaporatorResult.airOutletTempC,
                RH_saida_pct: (cycleResult.evaporatorResult.airOutletRH ?? 0.9) * 100,
              }}
              hotGasSource={{
                T_discharge_C: cycleResult.statePoints.point2_compOut.T_C,
                h_discharge_kJkg: cycleResult.statePoints.point2_compOut.h_kJkg,
                h_condOut_kJkg: cycleResult.statePoints.point3_condOut.h_kJkg,
                m_dot_total_kgS: cycleResult.m_dot_kgS,
                Tc_C: cycleResult.Tc_C,
              }}
              airFlowM3H={config.evaporator.airFlowM3H}
              evaporatorGeometry={{
                finnedHeightMm: config.evaporator.physical.finnedHeightMm,
                finnedLengthMm: config.evaporator.physical.finnedLengthMm,
                finPitchMm: config.evaporator.physical.finPitchMm,
                tubeOuterDiameterMm: config.evaporator.physical.tubeExternalDiameterMm,
                tubeInnerDiameterMm: Math.max(1, config.evaporator.physical.tubeExternalDiameterMm - 1),
                tubePitchTransverseMm: config.evaporator.physical.tubePitchTransversalMm ?? 25,
                tubePitchLongitudinalMm: config.evaporator.physical.tubePitchLongitudinalMm ?? 22,
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="frost" className="mt-3">
          <FrostTab config={config} cycleResult={cycleResult} />
        </TabsContent>
        <TabsContent value="drawing" className="mt-3">
          <DrawingTab
            heightMm={config.evaporator.physical.finnedHeightMm}
            widthMm={config.evaporator.physical.finnedLengthMm}
            depthMm={config.evaporator.physical.rows * (config.evaporator.physical.tubePitchLongitudinalMm ?? 25)}
            rows={config.evaporator.physical.rows}
            tubesPerRow={config.evaporator.physical.tubesPerRow}
            tubeOuterDiamMm={config.evaporator.physical.tubeExternalDiameterMm}
            finPitchMm={config.evaporator.physical.finPitchMm}
            circuits={config.evaporator.physical.circuits ?? 4}
            refrigerantId={config.refrigerantId}
            componentType="evaporator_dx"
            projectName={config.name}
          />
        </TabsContent>
        <TabsContent value="report" className="mt-3">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Relatório Técnico — Ciclo Completo</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
              <div className="col-span-2 mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dados de Entrada</div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Refrigerante</span><span className="font-mono">{config.refrigerantId}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Te inicial (°C)</span><span className="font-mono">{config.solver?.Te_initial_C ?? '-'}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Tc inicial (°C)</span><span className="font-mono">{config.solver?.Tc_initial_C ?? '-'}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">SH (K)</span><span className="font-mono">{config.evaporator.superheatK ?? '-'}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">SC (K)</span><span className="font-mono">{config.condenser.subcoolingK ?? '-'}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Vazão ar evap. (m³/h)</span><span className="font-mono">{config.evaporator.airFlowM3H.toLocaleString('pt-BR')}</span></div>
              <div className="col-span-2 mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resultados do Ciclo</div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Q evaporação (kW)</span><span className="font-mono font-semibold text-blue-600">{fmt(cycleResult.Q_evap_W / 1000, 2)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Q condensação (kW)</span><span className="font-mono font-semibold text-green-600">{fmt(cycleResult.Q_cond_W / 1000, 2)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">W compressor (kW)</span><span className="font-mono">{fmt(cycleResult.W_comp_W / 1000, 2)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">COP</span><span className="font-mono font-semibold">{fmt(cycleResult.COP, 3)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Te equilíbrio (°C)</span><span className="font-mono">{fmt(cycleResult.Te_C, 1)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Tc equilíbrio (°C)</span><span className="font-mono">{fmt(cycleResult.Tc_C, 1)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">T ar saída evap. (°C)</span><span className="font-mono">{fmt(cycleResult.evaporatorResult.airOutletTempC, 1)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">ΔP ar evap. (Pa)</span><span className="font-mono">{fmt(cycleResult.evaporatorResult.airPressureDropPa, 0)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">U global evap. (W/m²K)</span><span className="font-mono">{fmt(cycleResult.evaporatorResult.overallU_WM2K, 1)}</span></div>
              <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">Razão de compressão</span><span className="font-mono">{fmt(cycleResult.compressorResult.compressionRatio, 2)}</span></div>
            </div>
            {cycleResult.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <h4 className="mb-2 text-xs font-semibold text-amber-600">Avisos</h4>
                <ul className="space-y-1">{cycleResult.warnings.map((w, i) => <li key={i} className="text-xs text-amber-700">• {w}</li>)}</ul>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
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

function UncertaintyTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const inputs = useMemo(
    () => buildEvaporatorInputs(config, cycleResult.m_dot_kgS),
    [config, cycleResult.m_dot_kgS],
  );
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
          Calculando intervalos de confiança (Monte Carlo, 200 amostras)…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Bandas de incerteza nominais</h3>
        <UncertaintyBadge
          band={result.totalCapacityW}
          format={(v) => fmt(v / 1000, 2)}
          unit="kW"
        />
      </div>
      <UncertaintyPanel result={result} isLoading={false} />
    </div>
  );
}

function FrostTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
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
      <FrostAnalysisPanel
        result={frost}
        nominalCapacityW={cycleResult.Q_evap_W}
        operationTimeH={operationTimeH}
      />
    </div>
  );
}

function OperatingMapTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const baseInputs = useMemo(
    () => buildEvaporatorInputs(config, cycleResult.m_dot_kgS),
    [config, cycleResult.m_dot_kgS],
  );
  const { result, isLoading, error, generate } = useOperatingMap(baseInputs);

  useEffect(() => {
    generate({
      evapTempRange: { min: -30, max: 5, step: 5 },
      condensingTemps: [40, 45, 50, 55],
      airInletTempC: config.evaporator.airInletTempC,
      airFlowM3H: config.evaporator.airFlowM3H,
      designPoint: {
        evapTempC: cycleResult.Te_C,
        condensingTempC: cycleResult.Tc_C,
        capacityW: cycleResult.Q_evap_W,
      },
    });
  }, [generate, config, cycleResult.Te_C, cycleResult.Tc_C, cycleResult.Q_evap_W]);

  if (error) {
    return <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>;
  }
  if (isLoading || !result) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground animate-pulse">
        Gerando mapa de operação…
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <OperatingMapChart result={result} />
    </div>
  );
}

function OptimizationTab({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const baseInputs = useMemo(
    () => buildEvaporatorInputs(config, cycleResult.m_dot_kgS),
    [config, cycleResult.m_dot_kgS],
  );
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <OptimizationPanel
        baseInputs={baseInputs}
        currentCapacityW={cycleResult.Q_evap_W}
        onApplyGeometry={() => {
          /* no-op: geometria é fixa nesta página */
        }}
      />
    </div>
  );
}
