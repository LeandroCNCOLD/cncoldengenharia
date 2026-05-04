import { useEffect, useMemo, useState } from "react";
import { Calculator, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCompressorById,
} from "@/modules/coldpro_catalog/data/compressorCatalog.service";
import type { CompressorCatalogRow } from "@/modules/coldpro_catalog/data/compressorCatalog.types";
import { CompressorEnvelopeChart } from "../components/CompressorEnvelopeChart";
import { CompressorOperatingPointTab } from "../components/CompressorOperatingPointTab";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { ActionBar } from "../components/ActionBar";
import { ResultCard } from "../components/ResultCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { ProjectHeaderBar } from "../components/ProjectHeaderBar";
import {
  CompressorPickerModal,
  type CompressorItem,
} from "../components/CompressorPickerModal";
import {
  buildCompressorCycleConfig,
  estimateCompressorMetrics,
  useCompressorEnvelopeGenerator,
  type CompressorWorkspaceInputs,
} from "../hooks/useCompressorEnvelopeGenerator";
import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { usePdfExport } from "../hooks/usePdfExport";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { WorkspaceAIButton, WorkspaceAIPanel } from "../components/WorkspaceAIPanel";
import { DrawingTab } from "../components/drawing/DrawingTab";
import type { AIContext } from "../components/WorkspaceAIChat";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const DEFAULT_INPUTS: CompressorWorkspaceInputs = {
  compressorId: "",
  compressorModel: "",
  compressorBrand: "",
  Te_C: -10,
  Tc_C: 45,
  Tsuperheating_K: 7,
  Tsubcooling_K: 5,
  refrigerant: "R404A",
  voltage_V: 380,
  frequency_Hz: 60,
};

export function CompressorWorkspacePage() {
  const { isGenerating: pdfGenerating, exportPdf } = usePdfExport();
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inputs, setInputs] = useState<CompressorWorkspaceInputs>(DEFAULT_INPUTS);
  const [selectedRow, setSelectedRow] = useState<CompressorCatalogRow | null>(null);
  const [activeTab, setActiveTab] = useState("operation");
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!selectedCompressorId || selectedCompressorId === inputs.compressorId) return;
    let cancelled = false;
    getCompressorById(selectedCompressorId).then((row) => {
      if (cancelled || !row) return;
      setSelectedRow(row);
      setInputs((current) => ({
        ...current,
        compressorId: row.id,
        compressorModel: row.model,
        compressorBrand: row.manufacturer,
        refrigerant: row.refrigerant ?? current.refrigerant,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [inputs.compressorId, selectedCompressorId]);

  const compressorRecord = useMemo(
    () => buildCompressorRecord(inputs, selectedRow),
    [inputs, selectedRow],
  );
  const config = useMemo(
    () => buildCompressorCycleConfig(inputs, compressorRecord),
    [compressorRecord, inputs],
  );
  const cycle = useCycleSimulation(config, { mode: "manual" });
  const result = cycle.status === "success" ? cycle.result : null;
  const isCalculating = cycle.status === "running";
  const metrics = result ? estimateCompressorMetrics(result, inputs) : null;
  const envelope = useCompressorEnvelopeGenerator({
    inputs,
    compressor: compressorRecord,
  });

  const updateInputs = (patch: Partial<CompressorWorkspaceInputs>) =>
    setInputs((current) => ({ ...current, ...patch }));

  const handleSelect = (item: CompressorItem) => {
    setInputs((current) => ({
      ...current,
      compressorId: item.id,
      compressorModel: item.model,
      compressorBrand: item.brand ?? "",
      refrigerant: item.refrigerant ?? item.refrigerantCode ?? current.refrigerant,
      voltage_V: parseVoltage(item.voltage) ?? current.voltage_V,
      frequency_Hz: item.frequencyHz || current.frequency_Hz,
    }));
    void getCompressorById(item.id).then((row) => {
      if (row) setSelectedRow(row);
    });
  };

  const handleReset = () => setInputs(DEFAULT_INPUTS);

  const handleExportPdf = () => {
    if (!result) {
      toast.error("Calcule antes de exportar.");
      return;
    }
    exportPdf(
      <WorkspacePdfReport
        componentType="compressor"
        title="Compressor"
        inputs={{
          Modelo: `${inputs.compressorBrand} ${inputs.compressorModel}`,
          Refrigerante: inputs.refrigerant,
          Te: `${fmt(inputs.Te_C)} °C`,
          Tc: `${fmt(inputs.Tc_C)} °C`,
          Tensão: `${fmt(inputs.voltage_V, 0)} V`,
        }}
        results={{
          "Q evap": `${fmt(result.Q_evap_W / 1000)} kW`,
          "W comp": `${fmt(result.W_comp_W / 1000)} kW`,
          COP: fmt(result.COP),
          EER: fmt(result.EER),
          "Fluxo massa": `${fmt(result.m_dot_kgS * 3600)} kg/h`,
        }}
        warnings={result.warnings}
      />,
      `compressor-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const handleSave = () => toast.success("Projeto salvo (em memória).");
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  const handleExportCsv = () => toast.info("Exportação CSV em desenvolvimento.");
  const handleExportExcel = () => toast.info("Exportação Excel em desenvolvimento.");

  const badges = [
    inputs.refrigerant,
    inputs.compressorModel || "—",
    `${fmt(inputs.frequency_Hz, 0)} Hz`,
  ];

  const aiContext: AIContext = useMemo(() => ({
    componentType: "Compressor",
    tabName: activeTab,
    refrigerant: inputs.refrigerant,
    parameters: {
      "Modelo": `${inputs.compressorBrand} ${inputs.compressorModel}` || "—",
      "Te (°C)": inputs.Te_C,
      "Tc (°C)": inputs.Tc_C,
      "SH (K)": inputs.Tsuperheating_K,
      "SC (K)": inputs.Tsubcooling_K,
      "Tensão (V)": inputs.voltage_V,
      "Frequência (Hz)": inputs.frequency_Hz,
    },
    results: result ? {
      "Q evap (kW)": (result.Q_evap_W / 1000).toFixed(2),
      "W comp (kW)": (result.W_comp_W / 1000).toFixed(2),
      "COP": result.COP.toFixed(2),
      "EER": result.EER.toFixed(2),
      "Fluxo massa (kg/h)": (result.m_dot_kgS * 3600).toFixed(1),
    } : undefined,
    warnings: [],
  }), [activeTab, inputs, result]);

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => cycle.trigger()}
      onReset={handleReset}
      isCalculating={isCalculating}
      canCalculate={!!inputs.compressorId}
    >
      <Accordion type="multiple" defaultValue={["sel", "op", "elec"]} className="w-full">
        <AccordionItem value="sel">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Seleção do Compressor
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-8 text-xs"
              onClick={() => setPickerOpen(true)}
            >
              {inputs.compressorId
                ? `${inputs.compressorBrand} ${inputs.compressorModel}`
                : "Selecionar compressor…"}
            </Button>
            <TextField
              label="Refrigerante"
              value={inputs.refrigerant}
              onChange={(refrigerant) => updateInputs({ refrigerant })}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="op">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Condições de Operação
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField
              label="Te — Evaporação (°C)"
              value={inputs.Te_C}
              onChange={(Te_C) => updateInputs({ Te_C })}
            />
            <NumberField
              label="Tc — Condensação (°C)"
              value={inputs.Tc_C}
              onChange={(Tc_C) => updateInputs({ Tc_C })}
            />
            <NumberField
              label="Superaquecimento (K)"
              value={inputs.Tsuperheating_K}
              onChange={(Tsuperheating_K) => updateInputs({ Tsuperheating_K })}
            />
            <NumberField
              label="Subresfriamento (K)"
              value={inputs.Tsubcooling_K}
              onChange={(Tsubcooling_K) => updateInputs({ Tsubcooling_K })}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="elec">
          <AccordionTrigger className="text-xs uppercase tracking-wide">Elétrica</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField
              label="Tensão (V)"
              value={inputs.voltage_V}
              onChange={(voltage_V) => updateInputs({ voltage_V })}
            />
            <NumberField
              label="Frequência (Hz)"
              value={inputs.frequency_Hz}
              onChange={(frequency_Hz) => updateInputs({ frequency_Hz })}
            />
          </AccordionContent>
        </AccordionItem>

        {cycle.status === "error" && (
          <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-500">
            {cycle.message}
          </div>
        )}
      </Accordion>
    </WorkspaceInputsSidebar>
  );

  const header = (
    <WorkspaceHeader
      title="Compressor"
      icon={<Zap className="h-5 w-5" />}
      badges={badges}
      onSave={handleSave}
      onShare={handleShare}
      onExportPdf={handleExportPdf}
      isExportingPdf={pdfGenerating}
    />
  );

  return (
    <WorkspaceLayout header={header} sidebar={sidebar}>
      <ProjectHeaderBar workspaceType="component_workspace" />
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-card/30 px-4 py-2">
          <Badge variant={inputs.compressorId ? "default" : "secondary"}>
            {inputs.compressorId
              ? `${inputs.compressorBrand} ${inputs.compressorModel}`
              : "Nenhum compressor selecionado"}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isCalculating && !result ? (
            <LoadingResults />
          ) : result || envelope.points.length > 0 ? (
            <>
              {result && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <ResultCard
                    label="Capacidade"
                    value={fmt(result.Q_evap_W / 1000)}
                    unit="kW"
                    variant="success"
                  />
                  <ResultCard
                    label="Potência"
                    value={fmt(result.W_comp_W / 1000)}
                    unit="kW"
                  />
                  <ResultCard label="COP" value={fmt(result.COP)} />
                  <ResultCard label="EER" value={fmt(result.EER)} />
                </div>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <TabsList className="flex flex-wrap justify-start">
                    <TabsTrigger value="operation">📋 Ponto de Operação</TabsTrigger>
                    <TabsTrigger value="envelope">📊 Envelope Capacidade</TabsTrigger>
                    <TabsTrigger value="capacity">📈 Curva Tc fixo</TabsTrigger>
                    <TabsTrigger value="electric">⚡ Dados Elétricos</TabsTrigger>
                    <TabsTrigger value="drawing">🏗️ Desenho</TabsTrigger>
                  </TabsList>
                  <WorkspaceAIButton onClick={() => setAiOpen(true)} />
                </div>

                <TabsContent value="operation" className="mt-3">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <CompressorOperatingPointTab
                      result={result}
                      inputs={inputs}
                      isCalculating={isCalculating}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="envelope" className="mt-3">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Envelope Operacional Q×Te</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={envelope.isGenerating || !inputs.compressorId}
                          onClick={envelope.generate}
                        >
                          {envelope.isGenerating ? "Gerando..." : "Gerar 45 pontos"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={envelope.points.length === 0}
                          onClick={envelope.saveToTestBench}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Salvar para Bancada
                        </Button>
                      </div>
                    </div>
                    <CompressorEnvelopeChart
                      points={envelope.points}
                      nominalTe_C={inputs.Te_C}
                      nominalTc_C={inputs.Tc_C}
                      voltage_V={inputs.voltage_V}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="capacity" className="mt-3">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-sm font-semibold">Curva nominal em Tc fixo</h3>
                    <CompressorEnvelopeChart
                      points={envelope.points.filter((point) => point.Tc_C === inputs.Tc_C)}
                      nominalTe_C={inputs.Te_C}
                      nominalTc_C={inputs.Tc_C}
                      voltage_V={inputs.voltage_V}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="electric" className="mt-3">
                  <ElectricalDataCards inputs={inputs} metrics={metrics} />
                </TabsContent>
                <TabsContent value="drawing" className="mt-3">
                  <DrawingTab
                    heightMm={400}
                    widthMm={600}
                    depthMm={300}
                    rows={2}
                    tubesPerRow={12}
                    tubeOuterDiamMm={9.52}
                    finPitchMm={3}
                    circuits={4}
                    refrigerantId={inputs.refrigerant}
                    componentType="condenser"
                    projectName={inputs.compressorModel ? `Compressor ${inputs.compressorModel}` : "Compressor"}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <EmptyResults />
          )}
        </div>

        <ActionBar
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          onShare={handleShare}
          hasResults={!!result}
          isExportingPdf={pdfGenerating}
        />
      </div>

      <CompressorPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
      <WorkspaceAIPanel open={aiOpen} onClose={() => setAiOpen(false)} context={aiContext} />
    </WorkspaceLayout>
  );
}

function buildCompressorRecord(
  inputs: CompressorWorkspaceInputs,
  row: CompressorCatalogRow | null,
) {
  return {
    id: inputs.compressorId || "COMPRESSOR_MANUAL",
    model: inputs.compressorModel || row?.model || "Compressor",
    manufacturer: inputs.compressorBrand || row?.manufacturer || "CN COLD",
    refrigerant: inputs.refrigerant,
    modelType: "constant_efficiency" as const,
    constantEfficiency: {
      eta_vol: 0.78,
      eta_is: 0.68,
      displacement_m3h: estimateDisplacementM3H(row),
    },
  };
}

function estimateDisplacementM3H(row: CompressorCatalogRow | null): number {
  if (row?.nominal_displacement_cm3 && row.nominal_rpm) {
    return (row.nominal_displacement_cm3 * row.nominal_rpm * 60) / 1e6;
  }
  if (row?.nominal_cooling_capacity_w) {
    return Math.max(2, row.nominal_cooling_capacity_w / 2500);
  }
  return 8;
}

function parseVoltage(voltage: string | null | undefined): number | null {
  if (!voltage) return null;
  const match = voltage.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function ElectricalDataCards({
  inputs,
  metrics,
}: {
  inputs: CompressorWorkspaceInputs;
  metrics: ReturnType<typeof estimateCompressorMetrics> | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
      <ResultCard
        label="Corrente nominal"
        value={metrics ? fmt(metrics.current_A) : "—"}
        unit={metrics ? "A" : ""}
      />
      <ResultCard
        label="Potência absorvida"
        value={metrics ? fmt(metrics.W_W / 1000) : "—"}
        unit={metrics ? "kW" : ""}
      />
      <ResultCard
        label="Fator de potência"
        value={metrics ? fmt(metrics.powerFactor) : "—"}
      />
      <ResultCard
        label="Eficiência volumétrica"
        value={metrics ? fmt(metrics.volumetricEfficiency * 100, 0) : "—"}
        unit={metrics ? "%" : ""}
      />
      <ResultCard label="Tensão" value={fmt(inputs.voltage_V, 0)} unit="V" />
      <ResultCard label="Frequência" value={fmt(inputs.frequency_Hz, 0)} unit="Hz" />
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Calculator className="h-12 w-12 opacity-30" />
      <p className="text-sm">
        Selecione um compressor e clique em <strong>Calcular</strong>
      </p>
    </div>
  );
}

function LoadingResults() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 text-xs"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-8 text-xs" />
    </div>
  );
}
