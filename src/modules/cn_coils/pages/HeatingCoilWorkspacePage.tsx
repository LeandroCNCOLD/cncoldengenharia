import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Save, ThermometerSun } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
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
import {
  calculateHeatingCoil,
  calculateMoistAirState,
  type HeatingCoilInputs,
} from "../hooks/useHeatingCoilSimulation";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const defaultInputs: HeatingCoilInputs = {
  mode: "heating",
  Tair_in_C: 15,
  RH_in: 0.6,
  airFlowRate_m3h: 3000,
  altitude_m: 0,
  heatingFluid: "hot_water",
  Tf_in_C: 80,
  Tf_out_C: 60,
  fluidFlowRate_m3h: 1.5,
  tubeRows: 2,
  tubesPerRow: 16,
  tubeLength_m: 1.2,
  finPitch_mm: 3,
  tubeDiameter_mm: 15.88,
};

export function HeatingCoilWorkspacePage() {
  const [inputs, setInputs] = useState(defaultInputs);
  const result = useMemo(() => calculateHeatingCoil(inputs), [inputs]);
  const update = (patch: Partial<HeatingCoilInputs>) =>
    setInputs((current) => ({ ...current, ...patch }));

  const curve = useMemo(
    () =>
      [50, 60, 70, 80, 90].flatMap((Tf_in_C) =>
        [-5, 0, 5, 10, 15, 20, 25].map((Tair_in_C) => ({
          Tf_in_C,
          Tair_in_C,
          Q_kW: calculateHeatingCoil({
            ...inputs,
            Tf_in_C,
            Tair_in_C,
          }).Q_heating_W / 1000,
        })),
      ),
    [inputs],
  );
  const psycho = useMemo(() => {
    const inlet = calculateMoistAirState(inputs.Tair_in_C, inputs.RH_in, inputs.altitude_m);
    return [
      { name: "Entrada", T_C: inputs.Tair_in_C, W_gkg: inlet.W_kgkg * 1000 },
      { name: "Saída", T_C: result.Tair_out_C, W_gkg: inlet.W_kgkg * 1000 },
    ];
  }, [inputs.RH_in, inputs.Tair_in_C, inputs.altitude_m, result.Tair_out_C]);

  return (
    <PageContainer
      title="CN Coils — Bateria de Aquecimento"
      subtitle="Aquecimento e reaquecimento sensível do ar"
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
              <ThermometerSun className="h-4 w-4 text-orange-500" />
              Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SelectField
              label="Modo"
              value={inputs.mode}
              options={[
                ["heating", "Aquecimento"],
                ["reheat", "Reaquecimento"],
              ]}
              onChange={(mode) => update({ mode: mode as HeatingCoilInputs["mode"] })}
            />
            <NumberField label="Tar entrada (°C)" value={inputs.Tair_in_C} onChange={(Tair_in_C) => update({ Tair_in_C })} />
            <NumberField label="UR entrada (%)" value={inputs.RH_in * 100} onChange={(v) => update({ RH_in: v / 100 })} />
            <NumberField label="Vazão de ar (m³/h)" value={inputs.airFlowRate_m3h} onChange={(airFlowRate_m3h) => update({ airFlowRate_m3h })} />
            <SelectField
              label="Fluido quente"
              value={inputs.heatingFluid}
              options={[
                ["hot_water", "Água quente"],
                ["steam", "Vapor"],
              ]}
              onChange={(heatingFluid) => update({ heatingFluid: heatingFluid as HeatingCoilInputs["heatingFluid"] })}
            />
            <NumberField label="Tf entrada (°C)" value={inputs.Tf_in_C} onChange={(Tf_in_C) => update({ Tf_in_C })} />
            <NumberField label="Tf saída (°C)" value={inputs.Tf_out_C} onChange={(Tf_out_C) => update({ Tf_out_C })} />
            <NumberField label="Fileiras" value={inputs.tubeRows} onChange={(tubeRows) => update({ tubeRows })} />
            <NumberField label="Tubos/fileira" value={inputs.tubesPerRow} onChange={(tubesPerRow) => update({ tubesPerRow })} />
          </CardContent>
        </Card>

        <Tabs defaultValue="results" className="min-w-0">
          <TabsList>
            <TabsTrigger value="results">📋 Resultados</TabsTrigger>
            <TabsTrigger value="curve">📊 Curva de Aquecimento</TabsTrigger>
            <TabsTrigger value="psychro">🌡️ Psicrométrico</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ResultCard label="Tar saída" value={`${fmt(result.Tair_out_C)} °C`} />
              <ResultCard label="UR saída" value={`${fmt(result.RH_out * 100)}%`} />
              <ResultCard label="Q aquecimento" value={`${fmt(result.Q_heating_W / 1000)} kW`} />
              <ResultCard label="NTU" value={fmt(result.NTU)} />
              <ResultCard label="Efetividade" value={`${fmt(result.epsilon * 100)}%`} />
              <ResultCard label="ΔP ar" value={`${fmt(result.pressureDrop_Pa, 0)} Pa`} />
            </div>
          </TabsContent>

          <TabsContent value="curve" className="mt-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Q(Tar_in) por Tf_in</CardTitle>
                <Button size="sm" variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  💾 Salvar para Bancada
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curve}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="Tair_in_C" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`${fmt(value)} kW`, "Q"]} />
                      {[50, 60, 70, 80, 90].map((temp, index) => (
                        <Line
                          key={temp}
                          data={curve.filter((point) => point.Tf_in_C === temp)}
                          dataKey="Q_kW"
                          name={`Tf ${temp} °C`}
                          stroke={["#2563eb", "#16a34a", "#f59e0b", "#f97316", "#dc2626"][index]}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="psychro" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Diagrama psicrométrico simplificado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="T_C" type="number" name="T" unit="°C" />
                      <YAxis dataKey="W_gkg" type="number" name="W" unit=" g/kg" />
                      <Tooltip formatter={(value: number) => fmt(value)} />
                      <Scatter data={psycho} fill="#2563eb" line={{ stroke: "#94a3b8" }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </div>
  );
}
