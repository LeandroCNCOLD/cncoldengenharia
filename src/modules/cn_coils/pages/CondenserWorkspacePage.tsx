import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Fan, Save, Thermometer } from "lucide-react";
import {
  Line,
  LineChart,
  CartesianGrid,
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
import { AirSidePanel } from "../components/AirSidePanel";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { GeometryBottomBar } from "../components/GeometryBottomBar";
import { useCnCoilsCatalogs } from "../hooks/useCnCoilsCatalogs";
import { useCondenserEnvelopeGenerator } from "../hooks/useCondenserEnvelopeGenerator";
import {
  type CondenserResult,
  useCondenserSimulation,
  type CondenserInputs,
} from "../hooks/useCondenserSimulation";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

export function CondenserWorkspacePage() {
  const catalogs = useCnCoilsCatalogs();
  const physical = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const airFlowM3H = useCnCoilsSimulationStore((s) => s.airFlow_m3h);
  const fanCount = useCnCoilsSimulationStore((s) => s.fanCount);
  const selectedFanId = useCnCoilsSimulationStore((s) => s.selectedFanId);
  const setAirFlow = useCnCoilsSimulationStore((s) => s.setAirFlow);
  const setTempInDB = useCnCoilsSimulationStore((s) => s.setTempInDB);
  const setFluid = useCnCoilsSimulationStore((s) => s.setFluid);
  const setFluidOperatingTemp = useCnCoilsSimulationStore((s) => s.setFluidOperatingTemp);
  const setSubcooling = useCnCoilsSimulationStore((s) => s.setSubcooling);

  const [inputs, setInputs] = useState<CondenserInputs>({
    Tc: 45,
    Tair_in: 35,
    geometryId: physical.geometryId ?? "",
    refrigerant: "REF_R404A",
    subcooling: 5,
    fanCount: 1,
    fanId: "",
    airFlowM3H: airFlowM3H > 0 ? airFlowM3H : 5000,
  });

  const syncedInputs = useMemo<CondenserInputs>(
    () => ({
      ...inputs,
      geometryId: physical.geometryId ?? inputs.geometryId,
      fanCount,
      fanId: selectedFanId ?? inputs.fanId,
      airFlowM3H: airFlowM3H > 0 ? airFlowM3H : inputs.airFlowM3H,
    }),
    [airFlowM3H, fanCount, inputs, physical.geometryId, selectedFanId],
  );

  const { result, isCalculating, error, calculate, calculateSnapshot } = useCondenserSimulation({
    inputs: syncedInputs,
    geometries: catalogs.geometries,
    tubeMaterials: catalogs.tubeMaterials,
  });
  const { points, isGenerating, generateEnvelope, saveToStore } =
    useCondenserEnvelopeGenerator({
      inputs: syncedInputs,
      calculate: calculateSnapshot,
    });

  useEffect(() => {
    if (!catalogs.ready || !syncedInputs.geometryId) return;
    calculate();
  }, [calculate, catalogs.ready, syncedInputs.geometryId]);

  const updateInputs = (patch: Partial<CondenserInputs>) => {
    setInputs((current) => {
      const next = { ...current, ...patch };
      if (patch.Tc !== undefined) setFluidOperatingTemp(patch.Tc);
      if (patch.Tair_in !== undefined) setTempInDB(patch.Tair_in);
      if (patch.refrigerant !== undefined) setFluid(patch.refrigerant);
      if (patch.subcooling !== undefined) setSubcooling(patch.subcooling);
      if (patch.airFlowM3H !== undefined) setAirFlow(patch.airFlowM3H);
      return next;
    });
  };

  return (
    <PageContainer
      title="CN Coils — Condensador a Ar"
      subtitle="Workspace dedicado para cálculo, envelope e ventiladores do condensador a ar"
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
      {catalogs.loading && (
        <div className="-mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Thermometer className="h-4 w-4 text-orange-500" />
              Inputs do Condensador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumberField
              label="Temperatura de Condensação (°C)"
              value={syncedInputs.Tc}
              onChange={(Tc) => updateInputs({ Tc })}
            />
            <NumberField
              label="Temperatura de Entrada do Ar (°C)"
              value={syncedInputs.Tair_in}
              onChange={(Tair_in) => updateInputs({ Tair_in })}
            />
            <TextField
              label="Refrigerante"
              value={syncedInputs.refrigerant}
              onChange={(refrigerant) => updateInputs({ refrigerant })}
            />
            <NumberField
              label="Subresfriamento (K)"
              value={syncedInputs.subcooling}
              onChange={(subcooling) => updateInputs({ subcooling })}
            />
            <NumberField
              label="Vazão de ar (m³/h)"
              value={syncedInputs.airFlowM3H ?? 0}
              onChange={(airFlowM3H) => updateInputs({ airFlowM3H })}
            />
            <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <div>Geometria: {syncedInputs.geometryId || "selecione na barra inferior"}</div>
              <div>Ventiladores: {syncedInputs.fanCount}</div>
              <div>Fan ID: {syncedInputs.fanId || "não selecionado"}</div>
            </div>
            <Badge variant={error ? "destructive" : result ? "default" : "secondary"}>
              {isCalculating ? "Calculando..." : error ? "Erro" : result ? "Calculado" : "Aguardando"}
            </Badge>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-3">
          <Tabs defaultValue="results">
            <TabsList>
              <TabsTrigger value="results">📋 Resultados</TabsTrigger>
              <TabsTrigger value="envelope">📊 Envelope Q×Tc</TabsTrigger>
              <TabsTrigger value="fans">🔧 Ventiladores</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-3">
              {result ? <CondenserResults result={result} /> : <EmptyState />}
            </TabsContent>

            <TabsContent value="envelope" className="mt-3">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">Envelope Q×Tc</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateEnvelope}
                      disabled={isGenerating || !syncedInputs.geometryId}
                    >
                      {isGenerating ? "Gerando..." : "Gerar 9 pontos"}
                    </Button>
                    <Button size="sm" onClick={saveToStore} disabled={points.length === 0}>
                      <Save className="mr-2 h-4 w-4" />
                      💾 Salvar para Bancada
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {points.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={points}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="Tc" unit="°C" />
                          <YAxis yAxisId="left" tickFormatter={(v) => fmt(Number(v) / 1000, 0)} />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              name === "Q_cond_W"
                                ? `${fmt(value / 1000)} kW`
                                : fmt(value),
                              name,
                            ]}
                            labelFormatter={(label) => `Tc ${fmt(Number(label), 1)} °C`}
                          />
                          <Line yAxisId="left" dataKey="Q_cond_W" stroke="#2563eb" strokeWidth={2} name="Q_cond_W" />
                          <Line yAxisId="right" dataKey="UA" stroke="#16a34a" strokeWidth={2} name="UA" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Gere o envelope para visualizar a curva Q×Tc.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fans" className="mt-3">
              <div className="max-w-3xl">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Fan className="h-4 w-4" />
                  Seleção de ventiladores
                </div>
                <AirSidePanel result={result ? {
                  totalCapacityKw: result.Q_cond_W / 1000,
                  sensibleCapacityKw: result.Q_cond_W / 1000,
                  latentCapacityKw: 0,
                  shf: 1,
                  airPressureDropPa: result.deltaP_Pa,
                  fluidPressureDropKpa: 0,
                  airOutletTempC: result.Tair_out,
                  airOutletRhPercent: 0,
                  faceAreaM2: 0,
                  faceVelocityMs: 0,
                  airMassFlowKgS: result.airflow_m3h / 3600 * 1.2,
                  regime: "DRY",
                  correctionFactor: 1,
                  warnings: [],
                } : undefined} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="mt-3">
        <GeometryBottomBar />
      </div>
    </PageContainer>
  );
}

function CondenserResults({ result }: { result: CondenserResult }) {
  const cards = [
    ["Q_cond", `${fmt(result.Q_cond_W / 1000)} kW`, `${fmt(result.Q_cond_kcalh, 0)} kcal/h`],
    ["UA", `${fmt(result.UA)} W/K`, "Coeficiente global × área"],
    ["LMTD", `${fmt(result.LMTD)} K`, "Diferença média logarítmica"],
    ["T ar saída", `${fmt(result.Tair_out)} °C`, "Saída do ar"],
    ["ΔP ar", `${fmt(result.deltaP_Pa, 0)} Pa`, "Perda de carga"],
    ["Vazão", `${fmt(result.airflow_m3h, 0)} m³/h`, result.regime],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value, sub]) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        Selecione a geometria e ajuste os inputs para calcular o condensador.
      </CardContent>
    </Card>
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
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
