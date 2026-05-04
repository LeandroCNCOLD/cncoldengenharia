import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Play, Save, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import {
  getCompressorById,
  loadCompressorIndex,
} from "@/modules/coldpro_catalog/data/compressorCatalog.service";
import type { CompressorCatalogRow } from "@/modules/coldpro_catalog/data/compressorCatalog.types";
import { CompressorEnvelopeChart } from "../components/CompressorEnvelopeChart";
import { CompressorOperatingPointTab } from "../components/CompressorOperatingPointTab";
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
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";

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
  const navigate = useNavigate();
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inputs, setInputs] = useState<CompressorWorkspaceInputs>(DEFAULT_INPUTS);
  const [selectedRow, setSelectedRow] = useState<CompressorCatalogRow | null>(null);

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

  return (
    <PageContainer
      title="Compressor"
      subtitle="Workspace dedicado ao ponto de operação e envelope operacional"
      actions={
        <Button variant="outline" onClick={() => navigate({ to: ".." })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={inputs.compressorId ? "default" : "secondary"}>
          {inputs.compressorId
            ? `${inputs.compressorBrand} ${inputs.compressorModel}`
            : "Nenhum compressor selecionado"}
        </Badge>
        <Badge variant="outline">{inputs.refrigerant}</Badge>
        <Badge variant="outline">{fmt(inputs.frequency_Hz, 0)} Hz</Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              Seleção e Condições
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setPickerOpen(true)}
            >
              {inputs.compressorId
                ? `${inputs.compressorBrand} ${inputs.compressorModel}`
                : "Selecionar compressor…"}
            </Button>
            <NumberField
              label="Temperatura de Evaporação (°C)"
              value={inputs.Te_C}
              onChange={(Te_C) => updateInputs({ Te_C })}
            />
            <NumberField
              label="Temperatura de Condensação (°C)"
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
            <TextField
              label="Refrigerante"
              value={inputs.refrigerant}
              onChange={(refrigerant) => updateInputs({ refrigerant })}
            />
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
            <Button
              className="w-full"
              disabled={isCalculating || !inputs.compressorId}
              onClick={() => cycle.trigger()}
            >
              {isCalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculando…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  ▶ Calcular
                </>
              )}
            </Button>
            {cycle.status === "error" && (
              <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {cycle.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="operation" className="min-w-0">
          <TabsList>
            <TabsTrigger value="operation">📋 Ponto de Operação</TabsTrigger>
            <TabsTrigger value="envelope">📊 Envelope Operacional</TabsTrigger>
            <TabsTrigger value="capacity">📈 Curva de Capacidade</TabsTrigger>
            <TabsTrigger value="electric">⚡ Dados Elétricos</TabsTrigger>
          </TabsList>

          <TabsContent value="operation" className="mt-3">
            <CompressorOperatingPointTab
              result={result}
              inputs={inputs}
              isCalculating={isCalculating}
            />
          </TabsContent>

          <TabsContent value="envelope" className="mt-3 space-y-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Envelope Operacional Q×Te</CardTitle>
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
                    💾 Salvar para Bancada
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CompressorEnvelopeChart
                  points={envelope.points}
                  nominalTe_C={inputs.Te_C}
                  nominalTc_C={inputs.Tc_C}
                  voltage_V={inputs.voltage_V}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capacity" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Curva nominal em Tc fixo</CardTitle>
              </CardHeader>
              <CardContent>
                <CompressorEnvelopeChart
                  points={envelope.points.filter((point) => point.Tc_C === inputs.Tc_C)}
                  nominalTe_C={inputs.Te_C}
                  nominalTc_C={inputs.Tc_C}
                  voltage_V={inputs.voltage_V}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="electric" className="mt-3">
            <ElectricalDataCard inputs={inputs} metrics={metrics} />
          </TabsContent>
        </Tabs>
      </div>

      <CompressorPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
    </PageContainer>
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

function ElectricalDataCard({
  inputs,
  metrics,
}: {
  inputs: CompressorWorkspaceInputs;
  metrics: ReturnType<typeof estimateCompressorMetrics> | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Dados Elétricos</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Corrente nominal" value={metrics ? `${fmt(metrics.current_A)} A` : "—"} />
        <Metric label="Potência absorvida" value={metrics ? `${fmt(metrics.W_W / 1000)} kW` : "—"} />
        <Metric label="Fator de potência" value={metrics ? fmt(metrics.powerFactor) : "—"} />
        <Metric label="Eficiência volumétrica" value={metrics ? `${fmt(metrics.volumetricEfficiency * 100, 0)}%` : "—"} />
        <Metric label="Tensão" value={`${fmt(inputs.voltage_V, 0)} V`} />
        <Metric label="Frequência" value={`${fmt(inputs.frequency_Hz, 0)} Hz`} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
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
