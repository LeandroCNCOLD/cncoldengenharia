import { useEffect, useMemo, useState } from "react";
import { Calculator, Fan, Save, Thermometer } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AirSidePanel } from "../components/AirSidePanel";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { GeometryBottomBar } from "../components/GeometryBottomBar";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { ActionBar } from "../components/ActionBar";
import { ResultCard } from "../components/ResultCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { CHART_COLORS } from "../constants/chartColors";
import { useCnCoilsCatalogs } from "../hooks/useCnCoilsCatalogs";
import { useCondenserEnvelopeGenerator } from "../hooks/useCondenserEnvelopeGenerator";
import {
  type CondenserResult,
  useCondenserSimulation,
  type CondenserInputs,
} from "../hooks/useCondenserSimulation";
import { usePdfExport } from "../hooks/usePdfExport";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const REFRIGERANT_OPTIONS = [
  "REF_R134a",
  "REF_R404A",
  "REF_R407C",
  "REF_R410A",
  "REF_R32",
  "REF_R290",
  "REF_R600a",
  "REF_R717",
  "REF_R744",
  "REF_R1234yf",
  "REF_R1234ze_E_",
] as const;

const DEFAULT_INPUTS: CondenserInputs = {
  Tc: 45,
  Tair_in: 35,
  geometryId: "",
  refrigerant: "REF_R404A",
  subcooling: 5,
  fanCount: 1,
  fanId: "",
  airFlowM3H: 5000,
};

export function CondenserWorkspacePage() {
  const { isGenerating: pdfGenerating, exportPdf } = usePdfExport();
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
    ...DEFAULT_INPUTS,
    geometryId: physical.geometryId ?? "",
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

  // Auto-gera envelope quando o cálculo principal conclui pela primeira vez.
  useEffect(() => {
    if (!result || isGenerating || points.length > 0) return;
    generateEnvelope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.Q_cond_W]);

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

  const handleReset = () => {
    setInputs({ ...DEFAULT_INPUTS, geometryId: physical.geometryId ?? "" });
  };

  const handleExportPdf = () => {
    if (!result) {
      toast.error("Calcule antes de exportar.");
      return;
    }
    exportPdf(
      <WorkspacePdfReport
        componentType="condenser_air"
        title="Condensador a Ar"
        inputs={{
          Tc: `${fmt(syncedInputs.Tc)} °C`,
          "T ar entrada": `${fmt(syncedInputs.Tair_in)} °C`,
          Refrigerante: syncedInputs.refrigerant,
          "Vazão de ar": `${fmt(syncedInputs.airFlowM3H ?? 0, 0)} m³/h`,
        }}
        results={{
          "Q cond": `${fmt(result.Q_cond_W / 1000)} kW`,
          UA: `${fmt(result.UA)} W/K`,
          LMTD: `${fmt(result.LMTD)} K`,
          "T ar saída": `${fmt(result.Tair_out)} °C`,
          "ΔP ar": `${fmt(result.deltaP_Pa, 0)} Pa`,
        }}
      />,
      `condensador-ar-${new Date().toISOString().slice(0, 10)}.pdf`,
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
    syncedInputs.refrigerant.replace("REF_", ""),
    `Tc: ${fmt(syncedInputs.Tc, 0)}°C`,
    `Tar: ${fmt(syncedInputs.Tair_in, 0)}°C`,
  ];

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={() => calculate()}
      onReset={handleReset}
      isCalculating={isCalculating}
      canCalculate={catalogs.ready && !!syncedInputs.geometryId}
    >
      <Accordion type="multiple" defaultValue={["op", "ref", "air"]} className="w-full">
        <AccordionItem value="op">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Condições de Operação
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField
              label="Tc — Temp. Condensação (°C)"
              value={syncedInputs.Tc}
              onChange={(Tc) => updateInputs({ Tc })}
            />
            <NumberField
              label="T ar entrada (°C)"
              value={syncedInputs.Tair_in}
              onChange={(Tair_in) => updateInputs({ Tair_in })}
            />
            <NumberField
              label="Subresfriamento (K)"
              value={syncedInputs.subcooling}
              onChange={(subcooling) => updateInputs({ subcooling })}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ref">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Refrigerante
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Refrigerante</Label>
              <Select
                value={syncedInputs.refrigerant}
                onValueChange={(refrigerant) => updateInputs({ refrigerant })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRIGERANT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-xs">
                      {opt.replace("REF_", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="air">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Ventilação
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <NumberField
              label="Vazão de ar (m³/h)"
              value={syncedInputs.airFlowM3H ?? 0}
              onChange={(airFlowM3H) => updateInputs({ airFlowM3H })}
            />
            <div className="rounded border border-border bg-muted/40 p-2 text-[10px] text-muted-foreground">
              <div>Ventiladores: {syncedInputs.fanCount}</div>
              <div>Fan ID: {syncedInputs.fanId || "—"}</div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="geometry">
          <AccordionTrigger className="text-xs uppercase tracking-wide">
            Geometria
          </AccordionTrigger>
          <AccordionContent>
            <GeometryBottomBar />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="status">
          <AccordionTrigger className="text-xs uppercase tracking-wide">Status</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Badge variant={error ? "destructive" : result ? "default" : "secondary"}>
              {isCalculating ? "Calculando..." : error ? "Erro" : result ? "Calculado" : "Aguardando"}
            </Badge>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </WorkspaceInputsSidebar>
  );

  const header = (
    <WorkspaceHeader
      title="Condensador a Ar"
      icon={<Thermometer className="h-5 w-5" />}
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
          {catalogs.loading && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-600">
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

          {isCalculating && !result ? (
            <LoadingResults />
          ) : result ? (
            <Tabs defaultValue="results" className="w-full">
              <TabsList className="flex w-full flex-wrap justify-start">
                <TabsTrigger value="results">📋 Resultados</TabsTrigger>
                <TabsTrigger value="envelope">📊 Envelope Q×Tc</TabsTrigger>
                <TabsTrigger value="fans">🔧 Ventiladores</TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="mt-3 space-y-3">
                <CondenserResults result={result} />
              </TabsContent>

              <TabsContent value="envelope" className="mt-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Envelope Q×Tc</h3>
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
                        Salvar para Bancada
                      </Button>
                    </div>
                  </div>
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
                              name === "Q_cond_W" ? `${fmt(value / 1000)} kW` : fmt(value),
                              name,
                            ]}
                            labelFormatter={(label) => `Tc ${fmt(Number(label), 1)} °C`}
                          />
                          <Line yAxisId="left" dataKey="Q_cond_W" stroke={CHART_COLORS.primary} strokeWidth={2} />
                          <Line yAxisId="right" dataKey="UA" stroke={CHART_COLORS.success} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Gere o envelope para visualizar a curva Q×Tc.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="fans" className="mt-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Fan className="h-4 w-4" />
                    Seleção de ventiladores
                  </div>
                  <AirSidePanel
                    result={
                      result
                        ? {
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
                            airMassFlowKgS: (result.airflow_m3h / 3600) * 1.2,
                            regime: "DRY",
                            correctionFactor: 1,
                            warnings: [],
                          }
                        : undefined
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <EmptyResults />
          )}

          <div>
            <GeometryBottomBar />
          </div>
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

function CondenserResults({ result }: { result: CondenserResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <ResultCard
        label="Q cond"
        value={fmt(result.Q_cond_W / 1000)}
        unit="kW"
        hint={`${fmt(result.Q_cond_kcalh, 0)} kcal/h`}
        variant="success"
      />
      <ResultCard label="UA" value={fmt(result.UA)} unit="W/K" hint="Coef. global × área" />
      <ResultCard label="LMTD" value={fmt(result.LMTD)} unit="K" hint="Δ média log." />
      <ResultCard label="T ar saída" value={fmt(result.Tair_out)} unit="°C" />
      <ResultCard label="ΔP ar" value={fmt(result.deltaP_Pa, 0)} unit="Pa" />
      <ResultCard label="Vazão" value={fmt(result.airflow_m3h, 0)} unit="m³/h" hint={result.regime} />
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

function LoadingResults() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
