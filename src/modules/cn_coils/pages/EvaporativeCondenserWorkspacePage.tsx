import { useMemo, useState } from "react";
import { Calculator, Droplets, Save } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionBar } from "../components/ActionBar";
import { ResultCard } from "../components/ResultCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { ProjectHeaderBar } from "../components/ProjectHeaderBar";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { CHART_COLORS } from "../constants/chartColors";
import { usePdfExport } from "../hooks/usePdfExport";
import {
  calculateEvaporativeCondenser,
  type EvaporativeCondenserInputs,
  type EvaporativeCondenserResult,
} from "../hooks/useEvaporativeCondenserSimulation";
import { WorkspaceAIButton, WorkspaceAIPanel } from "../components/WorkspaceAIPanel";
import type { AIContext } from "../components/WorkspaceAIChat";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const DEFAULT_INPUTS: EvaporativeCondenserInputs = {
  Q_total_W: 25_000,
  Twb_C: 24,
  Tdb_C: 35,
  altitude_m: 0,
  tubeRows: 4,
  tubesPerRow: 20,
  tubeLength_m: 2.4,
  tubeDiameter_mm: 19.05,
  waterFlowRate_Lmin: 15,
  airVelocity_ms: 3,
};

export function EvaporativeCondenserWorkspacePage() {
  const [inputs, setInputs] = useState<EvaporativeCondenserInputs>(DEFAULT_INPUTS);
  const { isGenerating: pdfGenerating, exportPdf } = usePdfExport();
  const [activeTab, setActiveTab] = useState("results");
  const [aiOpen, setAiOpen] = useState(false);

  const result = useMemo(() => calculateEvaporativeCondenser(inputs), [inputs]);
  const envelope = useMemo(
    () =>
      [18, 20, 22, 24, 26, 28].map((Twb_C) => {
        const point = calculateEvaporativeCondenser({ ...inputs, Twb_C });
        return {
          Twb_C,
          Tc_C: point.Tc_C,
          Q_rejected_kW: point.Q_rejected_W / 1000,
          waterMakeup_Lh: point.waterMakeup_Lh,
        };
      }),
    [inputs],
  );

  const update = (patch: Partial<EvaporativeCondenserInputs>) =>
    setInputs((current) => ({ ...current, ...patch }));

  const handleExportPdf = () =>
    exportPdf(
      <WorkspacePdfReport
        componentType="evaporative_condenser"
        title="Condensador Evaporativo"
        inputs={{
          "Q total": `${fmt(inputs.Q_total_W / 1000)} kW`,
          "T bulbo úmido": `${fmt(inputs.Twb_C)} °C`,
          "T bulbo seco": `${fmt(inputs.Tdb_C)} °C`,
        }}
        results={{
          Tc: `${fmt(result.Tc_C)} °C`,
          "Q rejeitado": `${fmt(result.Q_rejected_W / 1000)} kW`,
          "Consumo água": `${fmt(result.waterMakeup_Lh)} L/h`,
        }}
      />,
      `condensador-evaporativo-${new Date().toISOString().slice(0, 10)}.pdf`,
    );

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
  const handleReset = () => setInputs(DEFAULT_INPUTS);

  const badges = [`Q: ${fmt(inputs.Q_total_W / 1000, 0)} kW`, `Twb: ${fmt(inputs.Twb_C, 0)}°C`];

  const aiContext: AIContext = useMemo(() => ({
    componentType: "Cond. Evaporativo",
    tabName: activeTab,
    parameters: {
      "Q total (kW)": (inputs.Q_total_W / 1000).toFixed(1),
      "T bulbo úmido (°C)": inputs.Twb_C,
      "T bulbo seco (°C)": inputs.Tdb_C,
      "Vazão água (L/min)": inputs.waterFlowRate_Lmin,
      "Velocidade ar (m/s)": inputs.airVelocity_ms,
    },
    results: result ? {
      "Tc (°C)": result.Tc_C.toFixed(1),
      "Q rejeitado (kW)": (result.Q_rejected_W / 1000).toFixed(2),
      "Consumo água (L/h)": result.waterMakeup_Lh.toFixed(1),
    } : undefined,
    warnings: [],
  }), [activeTab, inputs, result]);

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => setInputs((current) => ({ ...current }))}
      onReset={handleReset}
    >
      <Accordion type="multiple" defaultValue={["op", "geom", "fluid"]} className="w-full">
        <AccordionItem value="op">
          <AccordionTrigger className="text-xs uppercase tracking-wide">Operação</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField label="Q total (W)" value={inputs.Q_total_W} onChange={(Q_total_W) => update({ Q_total_W })} />
            <NumberField label="T bulbo úmido (°C)" value={inputs.Twb_C} onChange={(Twb_C) => update({ Twb_C })} />
            <NumberField label="T bulbo seco (°C)" value={inputs.Tdb_C} onChange={(Tdb_C) => update({ Tdb_C })} />
            <NumberField label="Altitude (m)" value={inputs.altitude_m} onChange={(altitude_m) => update({ altitude_m })} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="geom">
          <AccordionTrigger className="text-xs uppercase tracking-wide">Geometria</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField label="Fileiras" value={inputs.tubeRows} onChange={(tubeRows) => update({ tubeRows })} />
            <NumberField label="Tubos/fileira" value={inputs.tubesPerRow} onChange={(tubesPerRow) => update({ tubesPerRow })} />
            <NumberField label="Comprimento tubo (m)" value={inputs.tubeLength_m} onChange={(tubeLength_m) => update({ tubeLength_m })} />
            <NumberField label="Diâmetro tubo (mm)" value={inputs.tubeDiameter_mm} onChange={(tubeDiameter_mm) => update({ tubeDiameter_mm })} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="fluid">
          <AccordionTrigger className="text-xs uppercase tracking-wide">Fluido / Ar</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField label="Vazão água (L/min)" value={inputs.waterFlowRate_Lmin} onChange={(waterFlowRate_Lmin) => update({ waterFlowRate_Lmin })} />
            <NumberField label="Velocidade ar (m/s)" value={inputs.airVelocity_ms} onChange={(airVelocity_ms) => update({ airVelocity_ms })} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </WorkspaceInputsSidebar>
  );

  const header = (
    <WorkspaceHeader
      title="Condensador Evaporativo"
      icon={<Droplets className="h-5 w-5" />}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {result ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <TabsList className="flex flex-wrap justify-start">
                  <TabsTrigger value="results">📋 Resultados</TabsTrigger>
                  <TabsTrigger value="envelope">📊 Envelope Q×Tc</TabsTrigger>
                  <TabsTrigger value="water">💧 Consumo de Água</TabsTrigger>
                </TabsList>
                <WorkspaceAIButton onClick={() => setAiOpen(true)} />
              </div>

              <TabsContent value="results" className="mt-3">
                <ResultsGrid result={result} inputs={inputs} />
              </TabsContent>

              <TabsContent value="envelope" className="mt-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Envelope por bulbo úmido</h3>
                    <Button size="sm" variant="outline">
                      <Save className="mr-2 h-4 w-4" /> Salvar
                    </Button>
                  </div>
                  <Chart data={envelope} xKey="Twb_C" yKey="Q_rejected_kW" yLabel="Q rejeitado (kW)" />
                </div>
              </TabsContent>

              <TabsContent value="water" className="mt-3 space-y-3">
                <WaterDetail result={result} />
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Consumo × Twb</h3>
                  <Chart data={envelope} xKey="Twb_C" yKey="waterMakeup_Lh" yLabel="Reposição (L/h)" />
                </div>
              </TabsContent>
            </Tabs>
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
      <WorkspaceAIPanel open={aiOpen} onClose={() => setAiOpen(false)} context={aiContext} />
    </WorkspaceLayout>
  );
}

function ResultsGrid({
  result,
  inputs,
}: {
  result: EvaporativeCondenserResult;
  inputs: EvaporativeCondenserInputs;
}) {
  const approach = result.approach_K ?? result.Tc_C - inputs.Twb_C;
  const ntu = result.NTU ?? -Math.log(Math.max(1e-6, 1 - result.eta_rejection));
  const tairOut = result.Tair_out_C ?? inputs.Tdb_C + 3;
  const wIn = result.W_in_gkg ?? 12;
  const mDotAir = result.mDot_air_kgs ?? 1.5;
  const aExt =
    result.A_ext_m2 ??
    Math.PI *
      (inputs.tubeDiameter_mm / 1000) *
      inputs.tubeLength_m *
      inputs.tubeRows *
      inputs.tubesPerRow;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <ResultCard label="Tc" value={fmt(result.Tc_C)} unit="°C" variant="success" />
      <ResultCard
        label="Approach (Tc−Twb)"
        value={fmt(approach, 1)}
        unit="K"
        variant={approach > 8 ? "danger" : approach > 5 ? "warning" : "success"}
      />
      <ResultCard label="Q rejeitado" value={fmt(result.Q_rejected_W / 1000)} unit="kW" />
      <ResultCard label="UA" value={fmt(result.UA_WK / 1000, 2)} unit="kW/K" />
      <ResultCard label="NTU" value={fmt(ntu, 2)} unit="" />
      <ResultCard label="Eficiência" value={fmt(result.eta_rejection * 100, 1)} unit="%" />
      <ResultCard label="T saída ar" value={fmt(tairOut, 1)} unit="°C" />
      <ResultCard label="W ar entrada" value={fmt(wIn, 1)} unit="g/kg" />
      <ResultCard label="Vazão ar" value={fmt(mDotAir, 2)} unit="kg/s" />
      <ResultCard label="Consumo água" value={fmt(result.waterMakeup_Lh, 1)} unit="L/h" />
      <ResultCard label="W ventiladores" value={fmt(result.W_fans_W, 0)} unit="W" />
      <ResultCard label="Área tubos" value={fmt(aExt, 2)} unit="m²" />
    </div>
  );
}

function WaterDetail({ result }: { result: EvaporativeCondenserResult }) {
  const blowdown = Math.max(0, result.waterMakeup_Lh - result.waterEvaporation_Lh);
  const drift = result.waterMakeup_Lh * 0.001;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResultCard label="Evaporação" value={fmt(result.waterEvaporation_Lh, 1)} unit="L/h" />
        <ResultCard label="Purga (blowdown)" value={fmt(blowdown, 1)} unit="L/h" />
        <ResultCard label="Drift (arraste)" value={fmt(drift, 2)} unit="L/h" />
        <ResultCard label="Reposição total" value={fmt(result.waterMakeup_Lh, 1)} unit="L/h" variant="warning" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <ResultCard label="Mensal (720h)" value={fmt((result.waterMakeup_Lh * 720) / 1000, 1)} unit="m³/mês" />
        <ResultCard label="Anual (8760h)" value={fmt((result.waterMakeup_Lh * 8760) / 1000, 0)} unit="m³/ano" />
        <ResultCard label="CoC (ciclos conc.)" value="3" unit="ciclos" />
      </div>
    </div>
  );
}

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

function Chart({
  data,
  xKey,
  yKey,
  yLabel,
}: {
  data: Array<Record<string, number>>;
  xKey: string;
  yKey: string;
  yLabel: string;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis label={{ value: yLabel, angle: -90, position: "insideLeft" }} />
          <Tooltip formatter={(value: number) => fmt(value)} />
          <Line type="monotone" dataKey={yKey} stroke={CHART_COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
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
