import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClipboardList, FileText, Gauge, PackageCheck, Snowflake, Thermometer, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { CompressorPickerModal } from "../../components/CompressorPickerModal";
import { ColdRoomPdfReport } from "../../components/pdf/ColdRoomPdfReport";
import { DXSystemPdfReport } from "../../components/pdf/DXSystemPdfReport";
import { HeatPumpPdfReport } from "../../components/pdf/HeatPumpPdfReport";
import { SystemEquilibriumChart } from "../../components/SystemEquilibriumChart";
import { SystemEquilibriumResultsTab } from "../../components/SystemEquilibriumResultsTab";
import { SystemWizard } from "../../components/SystemWizard";
import {
  calculateColdRoomLoad,
  DEFAULT_COLD_ROOM_INPUTS,
  type ColdRoomInputs,
  type ColdRoomLoadResult,
} from "../../hooks/useColdRoomLoad";
import {
  calculateDXSystemLoad,
  DEFAULT_DX_SYSTEM_INPUTS,
  type DXSystemInputs,
  type DXSystemLoadResult,
} from "../../hooks/useDXSystemLoad";
import {
  calculateHeatPumpLoad,
  DEFAULT_HEAT_PUMP_INPUTS,
  type HeatPumpInputs,
  type HeatPumpResult,
} from "../../hooks/useHeatPumpLoad";
import {
  coilEnvelopeToEquilibriumPoints,
  type SystemCondenserEnvelopePoint,
  useSystemEquilibrium,
} from "../../hooks/useSystemEquilibrium";
import { usePdfExport } from "../../hooks/usePdfExport";
import { type CoilEnvelope, useCoilEnvelopeStore } from "../../store/useCoilEnvelopeStore";

type CompleteSystemMode = "cold-room" | "dx-complete" | "heat-pump";

interface CompleteSystemWizardPageProps {
  mode: CompleteSystemMode;
}

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

const titles: Record<CompleteSystemMode, string> = {
  "cold-room": "Câmara Fria",
  "dx-complete": "DX Completo",
  "heat-pump": "Bomba de Calor",
};

function condenserToEquilibriumPoints(
  envelope: CoilEnvelope | SystemCondenserEnvelopePoint[],
): SystemCondenserEnvelopePoint[] {
  if (Array.isArray(envelope)) return envelope;
  return envelope.envelope.map((point) => ({
    Tc_C: envelope.nominalConditions.Tc,
    Q_W: point.Q_kcalh / 0.86,
  }));
}

export function CompleteSystemWizardPage({ mode }: CompleteSystemWizardPageProps) {
  const navigate = useNavigate();
  const [coldRoomInputs, setColdRoomInputs] = useState(DEFAULT_COLD_ROOM_INPUTS);
  const [dxInputs, setDxInputs] = useState(DEFAULT_DX_SYSTEM_INPUTS);
  const [heatPumpInputs, setHeatPumpInputs] = useState(DEFAULT_HEAT_PUMP_INPUTS);
  const [pickerOpen, setPickerOpen] = useState(false);

  const evaporatorEnvelope = useCoilEnvelopeStore((s) => s.envelopes.evaporator_dx);
  const condenserEnvelope = useCoilEnvelopeStore(
    (s) => s.envelopes.condenser_air ?? s.condenserEnvelope,
  );
  const compressorEnvelope = useCoilEnvelopeStore((s) => s.compressorEnvelope);
  const compressorModel = useCoilEnvelopeStore((s) => s.compressorModel);

  const loadResult = useMemo(() => {
    if (mode === "cold-room") return calculateColdRoomLoad(coldRoomInputs);
    if (mode === "dx-complete") return calculateDXSystemLoad(dxInputs);
    return calculateHeatPumpLoad(heatPumpInputs);
  }, [coldRoomInputs, dxInputs, heatPumpInputs, mode]);

  const equilibriumInputs = useMemo(() => {
    if (!evaporatorEnvelope || !condenserEnvelope || !compressorEnvelope) return null;
    const Tamb_C =
      mode === "cold-room"
        ? coldRoomInputs.Tamb_C
        : mode === "dx-complete"
          ? dxInputs.Tamb_C
          : heatPumpInputs.Tsource_C;
    return {
      Tamb_C,
      Tsuperheating_K: 7,
      Tsubcooling_K: 5,
      evaporatorEnvelope: coilEnvelopeToEquilibriumPoints(evaporatorEnvelope),
      condenserEnvelope: condenserToEquilibriumPoints(condenserEnvelope),
      compressorEnvelope,
    };
  }, [compressorEnvelope, condenserEnvelope, coldRoomInputs.Tamb_C, dxInputs.Tamb_C, evaporatorEnvelope, heatPumpInputs.Tsource_C, mode]);

  const equilibrium = useSystemEquilibrium(equilibriumInputs ?? undefined);
  const componentsReady = Boolean(evaporatorEnvelope && condenserEnvelope && compressorEnvelope);

  const loadComplete = getLoadTotal(loadResult) > 0;
  const steps = [
    {
      id: 1,
      label: "Carga Térmica",
      icon: <ClipboardList className="h-4 w-4" />,
      component:
        mode === "cold-room" ? (
          <ColdRoomLoadStep inputs={coldRoomInputs} setInputs={setColdRoomInputs} result={loadResult as ColdRoomLoadResult} />
        ) : mode === "dx-complete" ? (
          <DXLoadStep inputs={dxInputs} setInputs={setDxInputs} result={loadResult as DXSystemLoadResult} />
        ) : (
          <HeatPumpLoadStep inputs={heatPumpInputs} setInputs={setHeatPumpInputs} result={loadResult as HeatPumpResult} />
        ),
      isComplete: loadComplete,
    },
    {
      id: 2,
      label: "Componentes",
      icon: <PackageCheck className="h-4 w-4" />,
      component: (
        <ComponentsStep
          componentsReady={componentsReady}
          compressorModel={compressorModel}
          onOpenCompressor={() => setPickerOpen(true)}
          onNavigate={(type) =>
            navigate({ to: "/coldpro/cncoils/workspace", search: { type } as never })
          }
          evaporatorSaved={Boolean(evaporatorEnvelope)}
          condenserSaved={Boolean(condenserEnvelope)}
          compressorSaved={Boolean(compressorEnvelope)}
        />
      ),
      isComplete: componentsReady,
    },
    {
      id: 3,
      label: "Equilíbrio",
      icon: <Gauge className="h-4 w-4" />,
      component: (
        <EquilibriumStep
          equilibrium={equilibrium}
          equilibriumInputs={equilibriumInputs}
          evaporatorEnvelope={equilibriumInputs?.evaporatorEnvelope ?? []}
          compressorEnvelope={compressorEnvelope ?? []}
        />
      ),
      isComplete: Boolean(equilibrium.result),
    },
    {
      id: 4,
      label: "Relatório",
      icon: <FileText className="h-4 w-4" />,
      component: (
        <ReportStep
          mode={mode}
          loadResult={loadResult}
          loadInputs={mode === "cold-room" ? coldRoomInputs : mode === "dx-complete" ? dxInputs : heatPumpInputs}
          equilibriumResult={equilibrium.result}
        />
      ),
      isComplete: Boolean(equilibrium.result),
    },
  ];

  return (
    <PageContainer
      title={`Sistema — ${titles[mode]}`}
      subtitle="Assistente guiado de dimensionamento completo"
    >
      <SystemWizard title={titles[mode]} steps={steps} />
      <CompressorPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </PageContainer>
  );
}

function getLoadTotal(result: ColdRoomLoadResult | DXSystemLoadResult | HeatPumpResult) {
  if ("Q_total_W" in result) return result.Q_total_W;
  return Math.max(result.W_comp_heating_W * result.COP_heating, result.W_comp_cooling_W * result.COP_cooling);
}

function ColdRoomLoadStep({
  inputs,
  setInputs,
  result,
}: {
  inputs: ColdRoomInputs;
  setInputs: (inputs: ColdRoomInputs) => void;
  result: ColdRoomLoadResult;
}) {
  return (
    <LoadLayout
      fields={
        <>
          <NumberField label="Largura (m)" value={inputs.width_m} onChange={(width_m) => setInputs({ ...inputs, width_m })} />
          <NumberField label="Profundidade (m)" value={inputs.depth_m} onChange={(depth_m) => setInputs({ ...inputs, depth_m })} />
          <NumberField label="Altura (m)" value={inputs.height_m} onChange={(height_m) => setInputs({ ...inputs, height_m })} />
          <NumberField label="T externa (°C)" value={inputs.Tamb_C} onChange={(Tamb_C) => setInputs({ ...inputs, Tamb_C })} />
          <NumberField label="T interna (°C)" value={inputs.Troom_C} onChange={(Troom_C) => setInputs({ ...inputs, Troom_C })} />
          <NumberField label="Produto kg/dia" value={inputs.productMass_kg} onChange={(productMass_kg) => setInputs({ ...inputs, productMass_kg })} />
          <NumberField label="Fator segurança" value={inputs.safetyFactor} step={0.05} onChange={(safetyFactor) => setInputs({ ...inputs, safetyFactor })} />
        </>
      }
      totalW={result.Q_total_W}
      breakdown={result.breakdown}
    />
  );
}

function DXLoadStep({
  inputs,
  setInputs,
  result,
}: {
  inputs: DXSystemInputs;
  setInputs: (inputs: DXSystemInputs) => void;
  result: DXSystemLoadResult;
}) {
  return (
    <LoadLayout
      fields={
        <>
          <NumberField label="Área (m²)" value={inputs.area_m2} onChange={(area_m2) => setInputs({ ...inputs, area_m2 })} />
          <NumberField label="Pé-direito (m)" value={inputs.height_m} onChange={(height_m) => setInputs({ ...inputs, height_m })} />
          <NumberField label="T externa (°C)" value={inputs.Tamb_C} onChange={(Tamb_C) => setInputs({ ...inputs, Tamb_C })} />
          <NumberField label="T interna (°C)" value={inputs.Troom_C} onChange={(Troom_C) => setInputs({ ...inputs, Troom_C })} />
          <NumberField label="Ocupação" value={inputs.occupancy} onChange={(occupancy) => setInputs({ ...inputs, occupancy })} />
          <NumberField label="Equipamentos (W)" value={inputs.equipmentLoad_W} onChange={(equipmentLoad_W) => setInputs({ ...inputs, equipmentLoad_W })} />
        </>
      }
      totalW={result.Q_total_W}
      breakdown={result.breakdown}
      footer={`SHR: ${fmt(result.SHR)} · ${fmt(result.Q_total_W / 3517)} TR`}
    />
  );
}

function HeatPumpLoadStep({
  inputs,
  setInputs,
  result,
}: {
  inputs: HeatPumpInputs;
  setInputs: (inputs: HeatPumpInputs) => void;
  result: HeatPumpResult;
}) {
  const copCurve = [-5, 0, 5, 10, 15, 20].map((Tsource_C) => ({
    Tsource_C,
    COP: calculateHeatPumpLoad({ ...inputs, Tsource_C }).COP_heating,
  }));
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle className="text-base">Carga da Bomba de Calor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <NumberField label="Carga aquecimento (W)" value={inputs.Q_heating_W} onChange={(Q_heating_W) => setInputs({ ...inputs, Q_heating_W })} />
          <NumberField label="Carga resfriamento (W)" value={inputs.Q_cooling_W} onChange={(Q_cooling_W) => setInputs({ ...inputs, Q_cooling_W })} />
          <NumberField label="T fonte (°C)" value={inputs.Tsource_C} onChange={(Tsource_C) => setInputs({ ...inputs, Tsource_C })} />
          <NumberField label="T supply aquecimento (°C)" value={inputs.Tsupply_heating_C} onChange={(Tsupply_heating_C) => setInputs({ ...inputs, Tsupply_heating_C })} />
        </CardContent>
      </Card>
      <div className="space-y-4">
        <ResultCards
          cards={[
            ["COP aquecimento", fmt(result.COP_heating)],
            ["COP resfriamento", fmt(result.COP_cooling)],
            ["W aquecimento", `${fmt(result.W_comp_heating_W / 1000)} kW`],
            ["Economia vs resistência", `${fmt(result.savingsVsElectric_pct)}%`],
          ]}
        />
        <Card>
          <CardHeader><CardTitle className="text-base">COP_heating(Tfonte)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={copCurve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Tsource_C" />
                <YAxis />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Line dataKey="COP" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadLayout({
  fields,
  totalW,
  breakdown,
  footer,
}: {
  fields: React.ReactNode;
  totalW: number;
  breakdown: Array<{ name: string; value: number; percentage: number }>;
  footer?: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle className="text-base">Inputs de carga</CardTitle></CardHeader>
        <CardContent className="space-y-3">{fields}</CardContent>
      </Card>
      <div className="space-y-4">
        <ResultCards
          cards={[
            ["Carga total", `${fmt(totalW / 1000)} kW`],
            ["TR", fmt(totalW / 3517)],
            ["kcal/h", fmt(totalW * 0.86, 0)],
            ["Resumo", footer ?? "Carga térmica calculada"],
          ]}
        />
        <Card>
          <CardHeader><CardTitle className="text-base">Breakdown da carga</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${fmt(value)} W`} />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ComponentsStep({
  componentsReady,
  compressorModel,
  evaporatorSaved,
  condenserSaved,
  compressorSaved,
  onOpenCompressor,
  onNavigate,
}: {
  componentsReady: boolean;
  compressorModel: string | null;
  evaporatorSaved: boolean;
  condenserSaved: boolean;
  compressorSaved: boolean;
  onOpenCompressor: () => void;
  onNavigate: (type: string) => void;
}) {
  return (
    <div className="space-y-4">
      <ResultCards
        cards={[
          ["Evaporador", evaporatorSaved ? "✅ Envelope salvo" : "⬜ Pendente"],
          ["Condensador", condenserSaved ? "✅ Envelope salvo" : "⬜ Pendente"],
          ["Compressor", compressorSaved ? `✅ ${compressorModel ?? "Envelope salvo"}` : "⬜ Pendente"],
          ["Status", componentsReady ? "Pronto para equilíbrio" : "Configure todos os componentes"],
        ]}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Button variant="outline" onClick={() => onNavigate("evaporator_dx")}>Configurar Evaporador</Button>
        <Button variant="outline" onClick={() => onNavigate("condenser_air")}>Configurar Condensador</Button>
        <Button variant="outline" onClick={onOpenCompressor}>Selecionar Compressor</Button>
      </div>
    </div>
  );
}

function EquilibriumStep({
  equilibrium,
  equilibriumInputs,
  evaporatorEnvelope,
  compressorEnvelope,
}: {
  equilibrium: ReturnType<typeof useSystemEquilibrium>;
  equilibriumInputs: Parameters<ReturnType<typeof useSystemEquilibrium>["run"]>[0] | null;
  evaporatorEnvelope: Array<{ Te_C: number; Q_W: number }>;
  compressorEnvelope: import("../../store/useCoilEnvelopeStore").CompressorEnvelopePoint[];
}) {
  return (
    <div className="space-y-4">
      <Button onClick={() => equilibriumInputs && equilibrium.run(equilibriumInputs)} disabled={!equilibriumInputs || equilibrium.isCalculating}>
        {equilibrium.isCalculating ? "Calculando..." : "Rodar equilíbrio"}
      </Button>
      {equilibrium.error && <p className="text-sm text-red-600">{equilibrium.error}</p>}
      <SystemEquilibriumResultsTab result={equilibrium.result} />
      {equilibrium.result && (
        <SystemEquilibriumChart
          evaporatorEnvelope={evaporatorEnvelope}
          compressorEnvelope={compressorEnvelope}
          result={equilibrium.result}
          nominalTc_C={equilibrium.result.Tc_eq_C}
        />
      )}
    </div>
  );
}

function ReportStep({
  mode,
  loadResult,
  loadInputs,
  equilibriumResult,
}: {
  mode: CompleteSystemMode;
  loadResult: ColdRoomLoadResult | DXSystemLoadResult | HeatPumpResult;
  loadInputs: ColdRoomInputs | DXSystemInputs | HeatPumpInputs;
  equilibriumResult: ReturnType<typeof useSystemEquilibrium>["result"];
}) {
  const title = titles[mode].toUpperCase();
  const { isGenerating, exportPdf } = usePdfExport();
  const date = new Date().toISOString().slice(0, 10);
  const filenamePrefix =
    mode === "cold-room" ? "camara-fria" : mode === "dx-complete" ? "dx-completo" : "bomba-de-calor";
  const handleExport = () => {
    if (!equilibriumResult) return;
    if (mode === "cold-room") {
      void exportPdf(
        <ColdRoomPdfReport
          inputs={loadInputs as ColdRoomInputs}
          loadResult={loadResult as ColdRoomLoadResult}
          equilibriumResult={equilibriumResult}
          compressorModel="Compressor selecionado"
        />,
        `${filenamePrefix}-${date}.pdf`,
      );
      return;
    }
    if (mode === "dx-complete") {
      void exportPdf(
        <DXSystemPdfReport
          inputs={loadInputs as DXSystemInputs}
          loadResult={loadResult as DXSystemLoadResult}
          equilibriumResult={equilibriumResult}
          compressorModel="Compressor selecionado"
        />,
        `${filenamePrefix}-${date}.pdf`,
      );
      return;
    }
    void exportPdf(
      <HeatPumpPdfReport
        inputs={loadInputs as HeatPumpInputs}
        loadResult={loadResult as HeatPumpResult}
        equilibriumResult={equilibriumResult}
        compressorModel="Compressor selecionado"
      />,
      `${filenamePrefix}-${date}.pdf`,
    );
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title} — RELATÓRIO DE DIMENSIONAMENTO</CardTitle>
        <Button onClick={handleExport} disabled={!equilibriumResult || isGenerating}>
          {isGenerating ? "⏳ Gerando PDF…" : "📄 Exportar PDF"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 font-mono text-sm">
        <div>
          <p>DADOS DO PROJETO</p>
          {"width_m" in loadInputs && (
            <p>
              Dimensões: {fmt(loadInputs.width_m, 1)} × {fmt(loadInputs.depth_m, 1)} × {fmt(loadInputs.height_m, 1)} m ({fmt(loadInputs.width_m * loadInputs.depth_m * loadInputs.height_m, 1)} m³)
            </p>
          )}
          {"area_m2" in loadInputs && <p>Área: {fmt(loadInputs.area_m2)} m² · SHR: {fmt((loadResult as DXSystemLoadResult).SHR)}</p>}
          {"mode" in loadInputs && <p>Modo: {loadInputs.mode} · Fonte: {loadInputs.sourceType}</p>}
        </div>
        <div>
          <p>CARGA TÉRMICA TOTAL: {fmt(getLoadTotal(loadResult), 0)} W ({fmt(getLoadTotal(loadResult) / 3517)} TR)</p>
          {"breakdown" in loadResult && loadResult.breakdown.map((item) => (
            <p key={item.name}>  {item.name}: {fmt(item.value, 0)} W ({fmt(item.percentage, 0)}%)</p>
          ))}
        </div>
        <div>
          <p>PONTO DE OPERAÇÃO (EQUILÍBRIO)</p>
          {equilibriumResult ? (
            <>
              <p>  Te_eq: {fmt(equilibriumResult.Te_eq_C, 1)} °C</p>
              <p>  Tc_eq: {fmt(equilibriumResult.Tc_eq_C, 1)} °C</p>
              <p>  Q_real: {fmt(equilibriumResult.Q_evap_W, 0)} W</p>
              <p>  COP: {fmt(equilibriumResult.COP_real)}</p>
              <p>  W_comp: {fmt(equilibriumResult.W_comp_W, 0)} W</p>
              <p>DIAGNÓSTICO: {equilibriumResult.bottleneckReason}</p>
            </>
          ) : (
            <p>  Execute o equilíbrio para completar o relatório.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultCards({ cards }: { cards: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
