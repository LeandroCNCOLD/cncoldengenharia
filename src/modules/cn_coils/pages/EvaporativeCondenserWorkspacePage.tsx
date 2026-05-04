import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Droplets, Save } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { CHART_COLORS } from "../constants/chartColors";
import {
  calculateEvaporativeCondenser,
  type EvaporativeCondenserInputs,
  type EvaporativeCondenserResult,
} from "../hooks/useEvaporativeCondenserSimulation";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

export function EvaporativeCondenserWorkspacePage() {
  const [inputs, setInputs] = useState<EvaporativeCondenserInputs>({
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
  });
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

  return (
    <PageContainer
      title="CN Coils — Condensador Evaporativo"
      subtitle="Cálculo simplificado NTU-ε para rejeição evaporativa"
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
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Droplets className="h-4 w-4 text-cyan-600" />
              Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumberField label="Q total (W)" value={inputs.Q_total_W} onChange={(Q_total_W) => update({ Q_total_W })} />
            <NumberField label="T bulbo úmido (°C)" value={inputs.Twb_C} onChange={(Twb_C) => update({ Twb_C })} />
            <NumberField label="T bulbo seco (°C)" value={inputs.Tdb_C} onChange={(Tdb_C) => update({ Tdb_C })} />
            <NumberField label="Altitude (m)" value={inputs.altitude_m} onChange={(altitude_m) => update({ altitude_m })} />
            <NumberField label="Fileiras" value={inputs.tubeRows} onChange={(tubeRows) => update({ tubeRows })} />
            <NumberField label="Tubos/fileira" value={inputs.tubesPerRow} onChange={(tubesPerRow) => update({ tubesPerRow })} />
            <NumberField label="Comprimento tubo (m)" value={inputs.tubeLength_m} onChange={(tubeLength_m) => update({ tubeLength_m })} />
            <NumberField label="Diâmetro tubo (mm)" value={inputs.tubeDiameter_mm} onChange={(tubeDiameter_mm) => update({ tubeDiameter_mm })} />
            <NumberField label="Vazão água (L/min)" value={inputs.waterFlowRate_Lmin} onChange={(waterFlowRate_Lmin) => update({ waterFlowRate_Lmin })} />
            <NumberField label="Velocidade ar (m/s)" value={inputs.airVelocity_ms} onChange={(airVelocity_ms) => update({ airVelocity_ms })} />
            <Button className="w-full" onClick={() => setInputs((current) => ({ ...current }))}>
              ▶ Calcular
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="results" className="min-w-0">
          <TabsList>
            <TabsTrigger value="results">📋 Resultados</TabsTrigger>
            <TabsTrigger value="envelope">📊 Envelope Q×Tc</TabsTrigger>
            <TabsTrigger value="water">💧 Consumo de Água</TabsTrigger>
          </TabsList>
          <TabsContent value="results" className="mt-3">
            <ResultsGrid result={result} />
          </TabsContent>
          <TabsContent value="envelope" className="mt-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Envelope por bulbo úmido</CardTitle>
                <Button size="sm" variant="outline">
                  <Save className="mr-2 h-4 w-4" /> 💾 Salvar
                </Button>
              </CardHeader>
              <CardContent>
                <Chart data={envelope} xKey="Twb_C" yKey="Q_rejected_kW" yLabel="Q rejeitado (kW)" />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="water" className="mt-3">
            <div className="space-y-3">
              <WaterCard result={result} />
              <Card>
                <CardHeader><CardTitle className="text-sm">Consumo × Twb</CardTitle></CardHeader>
                <CardContent>
                  <Chart data={envelope} xKey="Twb_C" yKey="waterMakeup_Lh" yLabel="Reposição (L/h)" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

function ResultsGrid({ result }: { result: EvaporativeCondenserResult }) {
  const cards = [
    ["Tc", `${fmt(result.Tc_C)} °C`],
    ["Q rejeitado", `${fmt(result.Q_rejected_W / 1000)} kW`],
    ["UA", `${fmt(result.UA_WK)} W/K`],
    ["Eficiência", `${fmt(result.eta_rejection * 100)}%`],
    ["Consumo água", `${fmt(result.waterMakeup_Lh)} L/h`],
    ["W ventiladores", `${fmt(result.W_fans_W)} W`],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value]) => (
        <Card key={label}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></CardContent></Card>
      ))}
    </div>
  );
}

function WaterCard({ result }: { result: EvaporativeCondenserResult }) {
  const purge = result.waterMakeup_Lh - result.waterEvaporation_Lh;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Consumo de Água</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm md:grid-cols-4">
        <Metric label="Evaporação" value={`${fmt(result.waterEvaporation_Lh, 1)} L/h`} />
        <Metric label="Purga (drift)" value={`${fmt(purge, 1)} L/h`} />
        <Metric label="Reposição total" value={`${fmt(result.waterMakeup_Lh, 1)} L/h`} />
        <Metric label="Consumo mensal" value={`${fmt((result.waterMakeup_Lh * 720) / 1000, 1)} m³/mês`} />
      </CardContent>
    </Card>
  );
}

function Chart({ data, xKey, yKey, yLabel }: { data: Array<Record<string, number>>; xKey: string; yKey: string; yLabel: string }) {
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

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono">{value}</p></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
