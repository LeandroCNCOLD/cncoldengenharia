import { useMemo, useState } from "react";
import { Save, ThermometerSun } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionBar } from "../components/ActionBar";
import { ResultCard } from "../components/ResultCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { CHART_COLORS } from "../constants/chartColors";
import {
  calculateHeatingCoil,
  calculateMoistAirState,
  type HeatingCoilInputs,
} from "../hooks/useHeatingCoilSimulation";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const DEFAULT_INPUTS: HeatingCoilInputs = {
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
  const [draft, setDraft] = useState<HeatingCoilInputs>(DEFAULT_INPUTS);
  const [inputs, setInputs] = useState<HeatingCoilInputs>(DEFAULT_INPUTS);
  const result = useMemo(() => calculateHeatingCoil(inputs), [inputs]);
  const update = (patch: Partial<HeatingCoilInputs>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const curve = useMemo(
    () =>
      [50, 60, 70, 80, 90].flatMap((Tf_in_C) =>
        [-5, 0, 5, 10, 15, 20, 25].map((Tair_in_C) => ({
          Tf_in_C,
          Tair_in_C,
          Q_kW:
            calculateHeatingCoil({ ...inputs, Tf_in_C, Tair_in_C }).Q_heating_W /
            1000,
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

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => setInputs(draft)}
      onReset={() => {
        setDraft(DEFAULT_INPUTS);
        setInputs(DEFAULT_INPUTS);
      }}
    >
      <Accordion type="multiple" defaultValue={["mode", "air", "fluid"]}>
        <AccordionItem value="mode">
          <AccordionTrigger className="text-xs font-semibold">Modo</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Modo</Label>
              <Select
                value={draft.mode}
                onValueChange={(v) => update({ mode: v as HeatingCoilInputs["mode"] })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="heating">Aquecimento</SelectItem>
                  <SelectItem value="reheat">Reaquecimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="air">
          <AccordionTrigger className="text-xs font-semibold">Ar</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <NumberField
              label="Tar entrada (°C)"
              value={draft.Tair_in_C}
              onChange={(Tair_in_C) => update({ Tair_in_C })}
            />
            <NumberField
              label="UR entrada (%)"
              value={draft.RH_in * 100}
              onChange={(v) => update({ RH_in: v / 100 })}
            />
            <NumberField
              label="Vazão de ar (m³/h)"
              value={draft.airFlowRate_m3h}
              onChange={(airFlowRate_m3h) => update({ airFlowRate_m3h })}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fluid">
          <AccordionTrigger className="text-xs font-semibold">Fluido quente</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Fluido</Label>
              <Select
                value={draft.heatingFluid}
                onValueChange={(v) =>
                  update({ heatingFluid: v as HeatingCoilInputs["heatingFluid"] })
                }
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot_water">Água quente</SelectItem>
                  <SelectItem value="steam">Vapor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberField
              label="Tf entrada (°C)"
              value={draft.Tf_in_C}
              onChange={(Tf_in_C) => update({ Tf_in_C })}
            />
            <NumberField
              label="Tf saída (°C)"
              value={draft.Tf_out_C}
              onChange={(Tf_out_C) => update({ Tf_out_C })}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="geometry">
          <AccordionTrigger className="text-xs font-semibold">Geometria</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <NumberField
              label="Fileiras"
              value={draft.tubeRows}
              onChange={(tubeRows) => update({ tubeRows })}
            />
            <NumberField
              label="Tubos/fileira"
              value={draft.tubesPerRow}
              onChange={(tubesPerRow) => update({ tubesPerRow })}
            />
            <NumberField
              label="Comprimento tubo (m)"
              value={draft.tubeLength_m}
              onChange={(tubeLength_m) => update({ tubeLength_m })}
            />
            <NumberField
              label="Passo aleta (mm)"
              value={draft.finPitch_mm}
              onChange={(finPitch_mm) => update({ finPitch_mm })}
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
          title="Bateria de Aquecimento"
          icon={<ThermometerSun className="h-4 w-4" />}
          badges={[
            inputs.mode === "heating" ? "Aquecimento" : "Reaquecimento",
            inputs.heatingFluid === "hot_water" ? "Água quente" : "Vapor",
          ]}
          onSave={() => toast.success("Sessão salva")}
          onShare={() => toast.info("Compartilhamento em breve")}
          onExportPdf={() => toast.info("Exportação PDF em breve")}
        />
      }
      sidebar={sidebar}
    >
      <div className="flex flex-col gap-4 p-4">
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">📋 Resultados</TabsTrigger>
            <TabsTrigger value="curve">📈 Curva de Aquecimento</TabsTrigger>
            <TabsTrigger value="psychro">💧 Psicrométrico</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ResultCard label="Tar saída" value={fmt(result.Tair_out_C, 1)} unit="°C" variant="success" />
              <ResultCard label="UR saída" value={`${fmt(result.RH_out * 100, 1)}%`} />
              <ResultCard
                label="Q aquecimento"
                value={fmt(result.Q_heating_W / 1000, 2)}
                unit="kW"
                variant="success"
              />
              <ResultCard label="NTU" value={fmt(result.NTU, 2)} />
              <ResultCard label="Efetividade" value={`${fmt(result.epsilon * 100, 1)}%`} />
              <ResultCard label="U global" value={fmt(result.U_Wm2K, 0)} unit="W/m²K" />
              <ResultCard label="h ar" value={fmt(result.h_air_Wm2K ?? 0, 0)} unit="W/m²K" />
              <ResultCard label="h fluido" value={fmt(result.h_fluid_Wm2K ?? 0, 0)} unit="W/m²K" />
              <ResultCard label="Tf média" value={fmt(result.Tf_mean_C ?? 0, 1)} unit="°C" />
              <ResultCard label="W entrada" value={fmt(result.W_in_gkg, 1)} unit="g/kg" />
              <ResultCard label="h entrada" value={fmt(result.h_in_kJkg ?? 0, 1)} unit="kJ/kg" />
              <ResultCard label="h saída" value={fmt(result.h_out_kJkg ?? 0, 1)} unit="kJ/kg" />
              <ResultCard label="Vazão ar" value={fmt(result.mDot_air_kgs ?? 0, 3)} unit="kg/s" />
              <ResultCard label="ΔP ar" value={fmt(result.pressureDrop_Pa, 0)} unit="Pa" />
            </div>
          </TabsContent>

          <TabsContent value="curve" className="mt-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Q(Tar_in) por Tf_in</CardTitle>
                <Button size="sm" variant="outline" onClick={() => toast.info("Salvar para Bancada em breve")}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar para Bancada
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
                      <Scatter
                        data={psycho}
                        fill={CHART_COLORS.primary}
                        line={{ stroke: CHART_COLORS.axis }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
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
