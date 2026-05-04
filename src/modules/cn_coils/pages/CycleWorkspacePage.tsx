import { useEffect, useMemo, useRef, useState } from "react";
import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { useFrostAnalysis } from "../hooks/useFrostAnalysis";
import { useUncertaintyAnalysis } from "../hooks/useUncertaintyAnalysis";
import { useOperatingMap } from "../hooks/useOperatingMap";
import { CoilEnvelopeTab } from "../components/CoilEnvelopeTab";
import { CoilsInSeriesPanel } from "../components/CoilsInSeriesPanel";
import { FrostAnalysisTab } from "../components/FrostAnalysisTab";
import { SaveProjectButton } from "../components/SaveProjectButton";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { CyclePHDiagram } from "../components/CyclePHDiagram";
import { FrostAnalysisPanel } from "../components/FrostAnalysisPanel";
import { CycleResultPanel } from "../components/CycleResultPanel";
import { UncertaintyPanel, UncertaintyBadge } from "../components/UncertaintyBadge";
import { OperatingMapChart } from "../components/OperatingMapChart";
import { OptimizationPanel } from "../components/OptimizationPanel";
import { CompressorPickerModal } from "../components/CompressorPickerModal";
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

  // Auto-run uma vez ao montar (com config padrão válida)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    simState.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold">Ciclo de Refrigeração</h1>
          <p className="text-xs text-gray-400">
            CycleEngine V2 · {refrigerantId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CycleStatusBar state={simState} result={cycleResult} />
          <SaveProjectButton
            defaultName="Workspace Evaporador DX"
            type="component_workspace"
            systemInputs={{
              refrigerantId,
              te,
              tc,
              superheat,
              subcooling,
              expansionType,
            }}
            loadResult={cycleResult ? { Q_evap_W: cycleResult.Q_evap_W, COP: cycleResult.COP } : null}
          />
          <Button
            size="sm"
            onClick={() => simState.trigger()}
            disabled={simState.status === "running"}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {simState.status === "running" ? "Calculando…" : "▶ Calcular"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-0 h-[calc(100vh-65px)]">
        {/* Coluna esquerda: configuração */}
        <aside className="col-span-12 md:col-span-3 overflow-y-auto border-r border-gray-800 bg-gray-900/50 p-3">
          <Accordion type="multiple" defaultValue={["ref", "comp", "exp", "ops"]} className="space-y-2">
            <AccordionItem value="ref" className="border-gray-800">
              <AccordionTrigger className="text-xs uppercase tracking-wide text-gray-300 hover:no-underline">
                Refrigerante
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Select value={refrigerantId} onValueChange={setRefrigerantId}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-8">
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
                    <div className="text-[10px] text-gray-400">
                      {meta.name} · <span className="uppercase">{meta.category.replace("_", " ")}</span>
                    </div>
                  ) : null;
                })()}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="comp" className="border-gray-800">
              <AccordionTrigger className="text-xs uppercase tracking-wide text-gray-300 hover:no-underline">
                Compressor
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <div className="flex gap-1">
                  {(["bitzer", "ari", "constant"] as CompressorMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCompressorMode(m)}
                      className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium ${
                        compressorMode === m
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {m === "bitzer" ? "Bitzer" : m === "ari" ? "ARI 540" : "Const."}
                    </button>
                  ))}
                </div>
                {compressorMode === "bitzer" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCompressorPickerOpen(true)}
                      className="w-full bg-gray-800 border-gray-700 text-white hover:bg-gray-700 text-xs h-8"
                    >
                      Selecionar compressor…
                    </Button>
                    <div className="rounded border border-gray-700 bg-gray-800/60 p-2 text-[10px]">
                      <div className="font-mono text-white">{DEFAULT_CONFIG.compressor.model}</div>
                      <div className="text-gray-400">
                        {DEFAULT_CONFIG.compressor.manufacturer} ·{" "}
                        {fmt(DEFAULT_CONFIG.compressor.bitzerNative?.displacement_m3h ?? 0, 2)} m³/h
                      </div>
                    </div>
                  </>
                )}
                {compressorMode === "ari" && (
                  <Input
                    placeholder="Buscar modelo ARI 540…"
                    className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                  />
                )}
                {compressorMode === "constant" && (
                  <div className="space-y-2 text-[10px] text-gray-300">
                    <div>
                      <Label className="text-gray-400">ηv</Label>
                      <Slider defaultValue={[80]} min={0} max={100} step={1} />
                    </div>
                    <div>
                      <Label className="text-gray-400">ηs</Label>
                      <Slider defaultValue={[70]} min={0} max={100} step={1} />
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="exp" className="border-gray-800">
              <AccordionTrigger className="text-xs uppercase tracking-wide text-gray-300 hover:no-underline">
                Dispositivo de Expansão
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Select
                  value={expansionType}
                  onValueChange={(v) => setExpansionType(v as ExpansionDeviceType)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-8">
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
                    <Label className="text-[10px] text-gray-400">SH alvo (K)</Label>
                    <Input
                      type="number"
                      value={shTarget}
                      onChange={(e) => setShTarget(Number(e.target.value))}
                      className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                    />
                  </div>
                )}
                {expansionType === "capillary" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-400">L (m)</Label>
                      <Input
                        type="number"
                        value={capLength}
                        step="0.1"
                        onChange={(e) => setCapLength(Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-400">Di (mm)</Label>
                      <Input
                        type="number"
                        value={capDiameter}
                        step="0.1"
                        onChange={(e) => setCapDiameter(Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                      />
                    </div>
                  </div>
                )}
                {expansionType === "fixed_orifice" && (
                  <div>
                    <Label className="text-[10px] text-gray-400">Diâmetro (mm)</Label>
                    <Input
                      type="number"
                      value={orificeDiameter}
                      step="0.1"
                      onChange={(e) => setOrificeDiameter(Number(e.target.value))}
                      className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ops" className="border-gray-800">
              <AccordionTrigger className="text-xs uppercase tracking-wide text-gray-300 hover:no-underline">
                Condições de Operação
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <Label>Te</Label>
                    <span className="font-mono text-white">{fmt(te, 1)} °C</span>
                  </div>
                  <Slider value={[te]} min={-40} max={15} step={1} onValueChange={(v) => setTe(v[0])} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <Label>Tc</Label>
                    <span className="font-mono text-white">{fmt(tc, 1)} °C</span>
                  </div>
                  <Slider value={[tc]} min={20} max={70} step={1} onValueChange={(v) => setTc(v[0])} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-gray-400">Subresfr. (K)</Label>
                    <Input
                      type="number"
                      value={subcooling}
                      onChange={(e) => setSubcooling(Number(e.target.value))}
                      className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400">Superaq. (K)</Label>
                    <Input
                      type="number"
                      value={superheat}
                      onChange={(e) => setSuperheat(Number(e.target.value))}
                      className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        {/* Coluna central: P-h + abas */}
        <main className="col-span-12 md:col-span-9 overflow-y-auto p-4">
          {simState.status === "running" && !cycleResult ? (
            <div className="flex h-64 items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <p className="text-sm text-gray-400">Executando solver de ciclo...</p>
              </div>
            </div>
          ) : simState.status === "error" ? (
            <div className="rounded-xl border border-red-800 bg-red-950/30 p-6">
              <p className="font-semibold text-red-400">Erro no CycleEngine</p>
              <p className="mt-2 text-sm text-red-300">{simState.message}</p>
            </div>
          ) : cycleResult ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-gray-900 p-4">
                <CyclePHDiagram
                  result={cycleResult}
                  refrigerantId={config.refrigerantId}
                  width={620}
                  height={360}
                />
              </div>

              <CycleAnalysisTabs config={config} cycleResult={cycleResult} />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-600">
              Configure o sistema para iniciar a simulação
            </div>
          )}
        </main>
      </div>

      <CompressorPickerModal
        open={compressorPickerOpen}
        onClose={() => setCompressorPickerOpen(false)}
      />
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
      <div className="flex items-center gap-2 text-xs text-blue-400">
        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
        Calculando…
      </div>
    );
  }
  if (state.status === "error") {
    return <Badge variant="destructive">🔴 Erro</Badge>;
  }
  if (!result) {
    return <Badge variant="secondary">Aguardando</Badge>;
  }
  const residualPct = (result.residual * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
  return (
    <div className="flex items-center gap-3 text-[11px]">
      {result.converged ? (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">🟢 Convergido</Badge>
      ) : (
        <Badge className="bg-amber-600 hover:bg-amber-600">🟡 Estimativa</Badge>
      )}
      <span className="text-gray-400">
        Resíduo <span className="font-mono text-white">{residualPct}%</span>
      </span>
      <span className="text-gray-400">
        Iter. <span className="font-mono text-white">{result.iterations}</span>
      </span>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function CycleAnalysisTabs({
  config,
  cycleResult,
}: {
  config: CycleSystemConfig;
  cycleResult: CycleResult;
}) {
  const { isGenerating, exportPdf } = usePdfExport();
  return (
    <Tabs defaultValue="results" className="w-full">
      <TabsList className="bg-gray-900 border border-gray-800">
        <TabsTrigger value="results">Resultados</TabsTrigger>
        <TabsTrigger value="uncertainty">Incerteza</TabsTrigger>
        <TabsTrigger value="map">Mapa de Operação</TabsTrigger>
        <TabsTrigger value="optimization">Otimização</TabsTrigger>
        <TabsTrigger value="series">Coils em Série</TabsTrigger>
        <TabsTrigger value="envelope">Envelope Q×Te</TabsTrigger>
        <TabsTrigger value="frost-analysis">❄️ Análise de Geada</TabsTrigger>
        <TabsTrigger value="frost">Geada Avançada</TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="mt-3">
        <div className="rounded-lg bg-white p-4 text-gray-900">
          <div className="mb-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={isGenerating}
              onClick={() =>
                exportPdf(
                  <WorkspacePdfReport
                    componentType="evaporator"
                    title="Evaporador DX"
                    inputs={{
                      Refrigerante: config.refrigerantId,
                      "Te inicial": `${config.solver?.Te_initial_C ?? cycleResult.Te_C} °C`,
                      "Tc inicial": `${config.solver?.Tc_initial_C ?? cycleResult.Tc_C} °C`,
                      "Vazão de ar": `${config.evaporator.airFlowM3H.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m³/h`,
                    }}
                    results={{
                      "Capacidade real": `${(cycleResult.Q_evap_W / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kW`,
                      COP: cycleResult.COP.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
                      "Te eq": `${cycleResult.Te_C.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`,
                      "Tc eq": `${cycleResult.Tc_C.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`,
                      "ΔP ar": `${cycleResult.evaporatorResult.airPressureDropPa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} Pa`,
                    }}
                    warnings={cycleResult.warnings}
                  />,
                  `evaporador-${new Date().toISOString().slice(0, 10)}.pdf`,
                )
              }
            >
              {isGenerating ? "⏳ Gerando PDF…" : "📄 Exportar PDF"}
            </Button>
          </div>
          <CycleResultPanel result={cycleResult} />
        </div>
      </TabsContent>

      <TabsContent value="uncertainty" className="mt-3">
        <UncertaintyTab config={config} cycleResult={cycleResult} />
      </TabsContent>

      <TabsContent value="frost" className="mt-3">
        <FrostTab config={config} cycleResult={cycleResult} />
      </TabsContent>

      <TabsContent value="map" className="mt-3">
        <OperatingMapTab config={config} cycleResult={cycleResult} />
      </TabsContent>

      <TabsContent value="optimization" className="mt-3">
        <OptimizationTab config={config} cycleResult={cycleResult} />
      </TabsContent>

      <TabsContent value="series" className="mt-3">
        <CoilsInSeriesPanel
          primaryCoilResult={{
            deltaP_Pa: cycleResult.evaporatorResult.airPressureDropPa,
            Q_kcalh: cycleResult.evaporatorResult.totalCapacityW * 0.86,
            T_ar_saida: cycleResult.evaporatorResult.airOutletTempC,
          }}
        />
      </TabsContent>

      <TabsContent value="envelope" className="mt-3">
        <div className="rounded-lg bg-white text-gray-900">
          <CoilEnvelopeTab equipmentId={config.id} />
        </div>
      </TabsContent>

      <TabsContent value="frost-analysis" className="mt-3">
        <FrostAnalysisTab
          Te={cycleResult.Te_C}
          Tair_in={config.evaporator.airInletTempC}
          RH={config.evaporator.airRelativeHumidity}
          Q_nominal={cycleResult.Q_evap_W}
          geometry={config.id}
        />
      </TabsContent>
    </Tabs>
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

// ── Tab: Uncertainty ────────────────────────────────────────────────────────
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
      <div className="rounded-lg bg-white p-4 text-gray-900">
        <div className="animate-pulse text-sm text-gray-500">
          Calculando intervalos de confiança (Monte Carlo, 200 amostras)…
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-4 text-gray-900 space-y-3">
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

// ── Tab: Frost ──────────────────────────────────────────────────────────────
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
      <div className="rounded-lg bg-white p-4 text-sm text-gray-500">
        Análise de geada disponível apenas com ciclo convergido.
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-white p-4 text-gray-900">
      <FrostAnalysisPanel
        result={frost}
        nominalCapacityW={cycleResult.Q_evap_W}
        operationTimeH={operationTimeH}
      />
    </div>
  );
}

// ── Tab: Operating Map ──────────────────────────────────────────────────────
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
    return <div className="rounded-lg bg-white p-4 text-sm text-red-600">{error}</div>;
  }
  if (isLoading || !result) {
    return (
      <div className="rounded-lg bg-white p-4 text-sm text-gray-500 animate-pulse">
        Gerando mapa de operação…
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-white p-4 text-gray-900">
      <OperatingMapChart result={result} />
    </div>
  );
}

// ── Tab: Optimization ───────────────────────────────────────────────────────
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
    <div className="rounded-lg bg-white p-4 text-gray-900">
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
