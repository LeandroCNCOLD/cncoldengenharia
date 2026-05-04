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
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { CHART_COLORS } from "../constants/chartColors";
import { usePdfExport } from "../hooks/usePdfExport";
import {
  calculateEvaporativeCondenser,
  type EvaporativeCondenserInputs,
  type EvaporativeCondenserResult,
} from "../hooks/useEvaporativeCondenserSimulation";

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
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {result ? (
            <Tabs defaultValue="results" className="w-full">
              <TabsList className="flex w-full flex-wrap justify-start">
                <TabsTrigger value="results">📋 Resultados</TabsTrigger>
                <TabsTrigger value="envelope">📊 Envelope Q×Tc</TabsTrigger>
                <TabsTrigger value="water">💧 Consumo de Água</TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="mt-3">
                <ResultsGrid result={result} />
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
    </WorkspaceLayout>
  );
}

function ResultsGrid({ result }: { result: EvaporativeCondenserResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <ResultCard label="Tc" value={fmt(result.Tc_C)} unit="°C" variant="success" />
      <ResultCard label="Q rejeitado" value={fmt(result.Q_rejected_W / 1000)} unit="kW" />
      <ResultCard label="UA" value={fmt(result.UA_WK)} unit="W/K" />
      <ResultCard label="Eficiência" value={fmt(result.eta_rejection * 100)} unit="%" />
      <ResultCard label="Consumo água" value={fmt(result.waterMakeup_Lh)} unit="L/h" />
      <ResultCard label="W ventiladores" value={fmt(result.W_fans_W)} unit="W" />
    </div>
  );
}

function WaterDetail({ result }: { result: EvaporativeCondenserResult }) {
  const purge = result.waterMakeup_Lh - result.waterEvaporation_Lh;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ResultCard label="Evaporação" value={fmt(result.waterEvaporation_Lh, 1)} unit="L/h" />
      <ResultCard label="Purga (drift)" value={fmt(purge, 1)} unit="L/h" />
      <ResultCard label="Reposição" value={fmt(result.waterMakeup_Lh, 1)} unit="L/h" />
      <ResultCard
        label="Mensal"
        value={fmt((result.waterMakeup_Lh * 720) / 1000, 1)}
        unit="m³/mês"
      />
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
