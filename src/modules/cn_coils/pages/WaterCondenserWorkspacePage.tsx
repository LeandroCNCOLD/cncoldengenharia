import { useMemo, useState } from "react";
import { Save, Waves } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CHART_COLORS } from "../constants/chartColors";
import {
  calculateWaterCondenser,
  type WaterCondenserInputs,
} from "../hooks/useWaterCondenserSimulation";
import { useCoilEnvelopeStore } from "../store/useCoilEnvelopeStore";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const DEFAULT_INPUTS: WaterCondenserInputs = {
  Q_total_W: 20000,
  Tw_in_C: 30,
  waterFlowRate_m3h: 3,
  tubeCount: 20,
  tubeLength_m: 2,
  tubeDiameter_mm: 19.05,
  passes: 2,
  refrigerant: "R404A",
};

export function WaterCondenserWorkspacePage() {
  const setCondenserEnvelope = useCoilEnvelopeStore((s) => s.setCondenserEnvelope);
  const [inputs, setInputs] = useState<WaterCondenserInputs>(DEFAULT_INPUTS);
  const [draft, setDraft] = useState<WaterCondenserInputs>(DEFAULT_INPUTS);
  const result = useMemo(() => calculateWaterCondenser(inputs), [inputs]);

  const envelope = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => {
        const Tw_in_C = 25 + index * 1.25;
        const point = calculateWaterCondenser({ ...inputs, Tw_in_C });
        return { Tw_in_C, Tc_C: point.Tc_C, Q_W: inputs.Q_total_W };
      }),
    [inputs],
  );

  const sizing = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => {
        const Q_total_W = inputs.Q_total_W * (0.6 + index * 0.1);
        const point = calculateWaterCondenser({ ...inputs, Q_total_W });
        return { Q_kW: Q_total_W / 1000, A_needed_m2: point.A_needed_m2 };
      }),
    [inputs],
  );

  const update = (patch: Partial<WaterCondenserInputs>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const variant: "success" | "warning" | "danger" =
    result.areaMargin > 0.1 ? "success" : result.areaMargin >= 0 ? "warning" : "danger";
  const marginLabel =
    result.areaMargin > 0.1
      ? "Margem adequada"
      : result.areaMargin >= 0
        ? "Margem baixa"
        : "Subdimensionado";

  const saveEnvelope = () => {
    setCondenserEnvelope(
      envelope.map((point) => ({
        Tc: point.Tc_C,
        Q_cond_W: point.Q_W,
        UA: result.U_Wm2K * result.A_available_m2,
        LMTD: result.LMTD_K,
        Tair_out: point.Tw_in_C,
      })),
    );
    toast.success("Envelope salvo para a Bancada");
  };

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => setInputs(draft)}
      onReset={() => {
        setDraft(DEFAULT_INPUTS);
        setInputs(DEFAULT_INPUTS);
      }}
    >
      <Accordion type="multiple" defaultValue={["thermal", "geometry"]} className="w-full">
        <AccordionItem value="thermal">
          <AccordionTrigger className="text-xs font-semibold">Térmico</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <NumberField
              label="Q rejeitado (W)"
              value={draft.Q_total_W}
              onChange={(Q_total_W) => update({ Q_total_W })}
            />
            <NumberField
              label="T água entrada (°C)"
              value={draft.Tw_in_C}
              onChange={(Tw_in_C) => update({ Tw_in_C })}
            />
            <NumberField
              label="Vazão água (m³/h)"
              value={draft.waterFlowRate_m3h}
              onChange={(waterFlowRate_m3h) => update({ waterFlowRate_m3h })}
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="geometry">
          <AccordionTrigger className="text-xs font-semibold">Geometria</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <NumberField
              label="Nº de tubos"
              value={draft.tubeCount}
              onChange={(tubeCount) => update({ tubeCount })}
            />
            <NumberField
              label="Comprimento tubo (m)"
              value={draft.tubeLength_m}
              onChange={(tubeLength_m) => update({ tubeLength_m })}
            />
            <NumberField
              label="Diâmetro tubo (mm)"
              value={draft.tubeDiameter_mm}
              onChange={(tubeDiameter_mm) => update({ tubeDiameter_mm })}
            />
            <NumberField
              label="Passes"
              value={draft.passes}
              onChange={(passes) => update({ passes })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </WorkspaceInputsSidebar>
  );

  return (
    <WorkspaceLayout
      header={
        <WorkspaceHeader
          title="Condensador a Água"
          icon={<Waves className="h-4 w-4" />}
          badges={[inputs.refrigerant, `${inputs.tubeCount}t × ${inputs.passes}p`]}
        />
      }
      sidebar={sidebar}
    >
      <div className="flex flex-col gap-4 p-4">
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="envelope">Envelope Q×Tc</TabsTrigger>
            <TabsTrigger value="sizing">Dimensionamento</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ResultCard label="Tc" value={fmt(result.Tc_C)} unit="°C" variant={variant} />
              <ResultCard label="T água saída" value={fmt(result.Tw_out_C)} unit="°C" />
              <ResultCard label="LMTD" value={fmt(result.LMTD_K)} unit="K" />
              <ResultCard label="U" value={fmt(result.U_Wm2K, 0)} unit="W/m²K" />
              <ResultCard
                label="Área necessária"
                value={fmt(result.A_needed_m2)}
                unit="m²"
              />
              <ResultCard
                label="Área disponível"
                value={fmt(result.A_available_m2)}
                unit="m²"
              />
              <ResultCard
                label="Margem"
                value={`${fmt(result.areaMargin * 100)}%`}
                variant={variant}
                hint={marginLabel}
              />
              <ResultCard label="ΔP água" value={fmt(result.pressureDrop_kPa)} unit="kPa" />
              <ResultCard label="Bomba" value={fmt(result.pumpPower_W)} unit="W" />
            </div>
          </TabsContent>

          <TabsContent value="envelope" className="mt-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Curva Q×Tc por T água entrada</CardTitle>
                <Button size="sm" onClick={saveEnvelope}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar para Bancada
                </Button>
              </CardHeader>
              <CardContent>
                <Chart
                  data={envelope}
                  xKey="Tw_in_C"
                  yKey="Tc_C"
                  xLabel="T água entrada (°C)"
                  yLabel="Tc (°C)"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sizing" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Área necessária por carga</CardTitle>
              </CardHeader>
              <CardContent>
                <Chart
                  data={sizing}
                  xKey="Q_kW"
                  yKey="A_needed_m2"
                  xLabel="Q (kW)"
                  yLabel="Área (m²)"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ActionBar
          hasResults
          onExportCsv={() => toast.info("Exportação CSV em breve")}
          onExportExcel={() => toast.info("Exportação Excel em breve")}
          onExportPdf={() => toast.info("Exportação PDF em breve")}
          onShare={() => toast.info("Compartilhamento em breve")}
        />
      </div>
    </WorkspaceLayout>
  );
}

function Chart({
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
}: {
  data: Array<Record<string, number>>;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} label={{ value: xLabel, position: "insideBottom", offset: -5 }} />
          <YAxis label={{ value: yLabel, angle: -90, position: "insideLeft" }} />
          <Tooltip formatter={(value: number) => fmt(value)} />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
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
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9"
      />
    </div>
  );
}

function _unused(_: WaterCondenserResult) {
  return null;
}
