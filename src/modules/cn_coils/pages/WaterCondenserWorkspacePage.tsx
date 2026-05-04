import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Save, Waves } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import {
  calculateWaterCondenser,
  type WaterCondenserInputs,
  type WaterCondenserResult,
} from "../hooks/useWaterCondenserSimulation";
import { useCoilEnvelopeStore } from "../store/useCoilEnvelopeStore";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

export function WaterCondenserWorkspacePage() {
  const setCondenserEnvelope = useCoilEnvelopeStore((s) => s.setCondenserEnvelope);
  const [inputs, setInputs] = useState<WaterCondenserInputs>({
    Q_total_W: 20000,
    Tw_in_C: 30,
    waterFlowRate_m3h: 3,
    tubeCount: 20,
    tubeLength_m: 2,
    tubeDiameter_mm: 19.05,
    passes: 2,
    refrigerant: "R404A",
  });
  const result = useMemo(() => calculateWaterCondenser(inputs), [inputs]);
  const envelope = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => {
        const Tw_in_C = 25 + index * 1.25;
        const point = calculateWaterCondenser({ ...inputs, Tw_in_C });
        return { Tw_in_C, Tc_C: point.Tc_C, Q_W: inputs.Q_total_W, A_needed_m2: point.A_needed_m2 };
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

  const updateInputs = (patch: Partial<WaterCondenserInputs>) =>
    setInputs((current) => ({ ...current, ...patch }));

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
  };

  return (
    <PageContainer
      title="CN Coils — Condensador a Água"
      subtitle="Cálculo LMTD para condensador casco/tubos ou placas"
      actions={
        <Link
          to="/coldpro/cncoils"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao CN COILS
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Waves className="h-4 w-4 text-sky-600" />
              Inputs do Condensador a Água
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumberField label="Q rejeitado (W)" value={inputs.Q_total_W} onChange={(Q_total_W) => updateInputs({ Q_total_W })} />
            <NumberField label="T água entrada (°C)" value={inputs.Tw_in_C} onChange={(Tw_in_C) => updateInputs({ Tw_in_C })} />
            <NumberField label="Vazão água (m³/h)" value={inputs.waterFlowRate_m3h} onChange={(waterFlowRate_m3h) => updateInputs({ waterFlowRate_m3h })} />
            <NumberField label="Nº de tubos" value={inputs.tubeCount} onChange={(tubeCount) => updateInputs({ tubeCount })} />
            <NumberField label="Comprimento tubo (m)" value={inputs.tubeLength_m} onChange={(tubeLength_m) => updateInputs({ tubeLength_m })} />
            <NumberField label="Diâmetro tubo (mm)" value={inputs.tubeDiameter_mm} onChange={(tubeDiameter_mm) => updateInputs({ tubeDiameter_mm })} />
            <NumberField label="Passes" value={inputs.passes} onChange={(passes) => updateInputs({ passes })} />
            <MarginBadge result={result} />
          </CardContent>
        </Card>

        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">📋 Resultados</TabsTrigger>
            <TabsTrigger value="envelope">📊 Envelope Q×Tc</TabsTrigger>
            <TabsTrigger value="sizing">🔧 Dimensionamento</TabsTrigger>
          </TabsList>
          <TabsContent value="results" className="mt-3">
            <WaterResults result={result} />
          </TabsContent>
          <TabsContent value="envelope" className="mt-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Curva Q×Tc por T água entrada</CardTitle>
                <Button size="sm" onClick={saveEnvelope}>
                  <Save className="mr-2 h-4 w-4" />
                  💾 Salvar para Bancada
                </Button>
              </CardHeader>
              <CardContent>
                <Chart data={envelope} xKey="Tw_in_C" yKey="Tc_C" xLabel="T água entrada (°C)" yLabel="Tc (°C)" />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sizing" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Área necessária por carga</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Chart data={sizing} xKey="Q_kW" yKey="A_needed_m2" xLabel="Q (kW)" yLabel="Área (m²)" />
                <MarginBadge result={result} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

function WaterResults({ result }: { result: WaterCondenserResult }) {
  const cards = [
    ["Tc", `${fmt(result.Tc_C)} °C`],
    ["T água saída", `${fmt(result.Tw_out_C)} °C`],
    ["LMTD", `${fmt(result.LMTD_K)} K`],
    ["U", `${fmt(result.U_Wm2K, 0)} W/m²K`],
    ["Área necessária", `${fmt(result.A_needed_m2)} m²`],
    ["Área disponível", `${fmt(result.A_available_m2)} m²`],
    ["Margem", `${fmt(result.areaMargin * 100)}%`],
    ["ΔP água", `${fmt(result.pressureDrop_kPa)} kPa`],
    ["Bomba", `${fmt(result.pumpPower_W)} W`],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MarginBadge({ result }: { result: WaterCondenserResult }) {
  const cls =
    result.areaMargin > 0.1
      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
      : result.areaMargin >= 0
        ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
        : "bg-red-100 text-red-800 hover:bg-red-100";
  const label =
    result.areaMargin > 0.1
      ? "Verde — margem adequada"
      : result.areaMargin >= 0
        ? "Amarelo — margem baixa"
        : "Vermelho — subdimensionado";
  return <Badge className={cls}>{label}</Badge>;
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
          <Line type="monotone" dataKey={yKey} stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
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
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
