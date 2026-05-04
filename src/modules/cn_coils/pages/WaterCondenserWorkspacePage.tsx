/**
 * WaterCondenserWorkspacePage
 *
 * Workspace completo para condensadores casco-e-tubos (água).
 * Segue o padrão do EvaporatorUnifiedWorkspacePage:
 *  - Sidebar esquerda com inputs organizados em Accordion + Sliders
 *  - Área central com abas (Resultados, Envelope, Dimensionamento, Desenho, Relatório)
 *  - WorkspaceAIPanel integrado
 *  - Exportação PDF/CSV/Excel
 */

import { useCallback, useMemo, useState } from "react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionBar } from "../components/ActionBar";
import { DrawingTab } from "../components/drawing/DrawingTab";
import { ProjectHeaderBar } from "../components/ProjectHeaderBar";
import { ResultCard } from "../components/ResultCard";
import { WorkspaceAIPanel } from "../components/WorkspaceAIPanel";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { usePdfExport } from "../hooks/usePdfExport";
import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import {
  calculateWaterCondenser,
  type WaterCondenserInputs,
  type WaterCondenserResult,
} from "../hooks/useWaterCondenserSimulation";
import { useCoilEnvelopeStore } from "../store/useCoilEnvelopeStore";
import type { AIContext } from "../components/WorkspaceAIChat";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBR = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

// ── Abas ─────────────────────────────────────────────────────────────────────
const TABS = {
  RESULTS: "results",
  ENVELOPE: "envelope",
  SIZING: "sizing",
  DRAWING: "drawing",
  REPORT: "report",
} as const;

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_INPUTS: WaterCondenserInputs = {
  Q_total_W: 30_000,
  Tw_in_C: 30,
  waterFlowRate_m3h: 3,
  tubeCount: 20,
  tubeLength_m: 2,
  tubeDiameter_mm: 19.05,
  passes: 2,
  refrigerant: "R404A",
  superheat_K: 20,
  subcooling_K: 5,
};

const REFRIGERANTS = ["R404A", "R22", "R134a", "R410A", "R507A", "R290", "R600a", "R744"];

// ── Componente principal ──────────────────────────────────────────────────────
export function WaterCondenserWorkspacePage() {
  const setCondenserEnvelope = useCoilEnvelopeStore((s) => s.setCondenserEnvelope);

  const [draft, setDraft] = useState<WaterCondenserInputs>(DEFAULT_INPUTS);
  const [inputs, setInputs] = useState<WaterCondenserInputs>(DEFAULT_INPUTS);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<WaterCondenserResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TABS.RESULTS);
  const [aiOpen, setAiOpen] = useState(false);

  const update = useCallback((patch: Partial<WaterCondenserInputs>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Simulação ──
  const handleSimulate = useCallback(() => {
    setIsSimulating(true);
    try {
      const r = calculateWaterCondenser(draft);
      setInputs(draft);
      setResult(r);
      toast.success("Cálculo concluído com sucesso.");
    } catch (err) {
      toast.error(`Erro no cálculo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSimulating(false);
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_INPUTS);
    setInputs(DEFAULT_INPUTS);
    setResult(null);
    toast.info("Parâmetros restaurados para os valores padrão.");
  }, []);

  // ── Envelope Tw_in × Tc ──
  const envelope = useMemo(() => {
    if (!result) return [];
    return Array.from({ length: 11 }, (_, i) => {
      const Tw_in = 20 + i * 2;
      const r = calculateWaterCondenser({ ...inputs, Tw_in_C: Tw_in });
      return {
        Tw_in_C: Tw_in,
        Tc_C: r.Tc_C,
        Tw_out_C: r.Tw_out_C,
        LMTD_K: r.LMTD_K,
        areaMargin_pct: r.areaMargin * 100,
      };
    });
  }, [result, inputs]);

  const handleSaveEnvelope = useCallback(() => {
    if (envelope.length === 0) {
      toast.error("Execute o cálculo antes de salvar o envelope.");
      return;
    }
    setCondenserEnvelope(
      envelope.map((pt) => ({
        Tc: pt.Tc_C,
        Q_cond_W: inputs.Q_total_W,
        UA: 0,
        LMTD: pt.LMTD_K,
        Tair_out: pt.Tw_out_C,
      })),
    );
    toast.success("Envelope salvo no store de projeto.");
  }, [envelope, setCondenserEnvelope, inputs]);

  // ── Exportação CSV ──
  const handleExportCsv = useCallback(() => {
    if (!result) { toast.error("Execute o cálculo antes de exportar."); return; }
    const rows = [
      ["Parâmetro", "Valor"],
      ["Tc (°C)", result.Tc_C.toFixed(2)],
      ["Tw saída (°C)", result.Tw_out_C.toFixed(2)],
      ["LMTD (K)", result.LMTD_K.toFixed(2)],
      ["U (W/m²K)", result.U_Wm2K.toFixed(0)],
      ["Área necessária (m²)", result.A_needed_m2.toFixed(3)],
      ["Área disponível (m²)", result.A_available_m2.toFixed(3)],
      ["Margem área (%)", (result.areaMargin * 100).toFixed(1)],
      ["ΔP água (kPa)", result.pressureDrop_kPa.toFixed(2)],
      ["W bomba (W)", result.pumpPower_W.toFixed(0)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "cond_agua.csv";
    a.click();
  }, [result]);

  const handleExportExcel = handleExportCsv;

  // ── Exportação PDF ──
  const { isGenerating: isExportingPdf, exportPdf } = usePdfExport();
  const handleExportPdf = useCallback(() => {
    if (!result) { toast.error("Execute o cálculo antes de exportar o PDF."); return; }
    exportPdf(
      <WorkspacePdfReport
        componentType="water_condenser"
        title="Condensador a Água (Casco-e-Tubos)"
        inputs={{
          "Q total (kW)": (inputs.Q_total_W / 1000).toFixed(1),
          "Refrigerante": inputs.refrigerant,
          "T água entrada (°C)": inputs.Tw_in_C,
          "Vazão água (m³/h)": inputs.waterFlowRate_m3h,
          "Nº tubos": inputs.tubeCount,
          "Comprimento (m)": inputs.tubeLength_m,
          "Ø tubo (mm)": inputs.tubeDiameter_mm,
          "Passes": inputs.passes,
          "Superaquecimento (K)": inputs.superheat_K,
          "Sub-resfriamento (K)": inputs.subcooling_K,
        }}
        results={{
          "Tc (°C)": result.Tc_C.toFixed(1),
          "T água saída (°C)": result.Tw_out_C.toFixed(1),
          "LMTD (K)": result.LMTD_K.toFixed(1),
          "U (W/m²K)": result.U_Wm2K.toFixed(0),
          "Área necessária (m²)": result.A_needed_m2.toFixed(3),
          "Margem área (%)": (result.areaMargin * 100).toFixed(1),
          "ΔP água (kPa)": result.pressureDrop_kPa.toFixed(2),
          "W bomba (W)": result.pumpPower_W.toFixed(0),
        }}
      />,
      "condensador_agua",
    );
  }, [result, inputs, exportPdf]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado para a área de transferência.");
  }, []);

  // ── AI Context ──
  const aiContext: AIContext = useMemo(() => ({
    componentType: "Condensador a Água",
    tabName: activeTab,
    refrigerant: inputs.refrigerant,
    parameters: result ? {
      "Q total (kW)": (inputs.Q_total_W / 1000).toFixed(1),
      "T água entrada (°C)": inputs.Tw_in_C,
      "Vazão água (m³/h)": inputs.waterFlowRate_m3h,
      "Nº tubos": inputs.tubeCount,
      "Passes": inputs.passes,
    } : undefined,
    results: result ? {
      "Tc (°C)": result.Tc_C.toFixed(1),
      "T água saída (°C)": result.Tw_out_C.toFixed(1),
      "LMTD (K)": result.LMTD_K.toFixed(1),
      "U (W/m²K)": result.U_Wm2K.toFixed(0),
      "Margem área (%)": (result.areaMargin * 100).toFixed(1),
    } : undefined,
    warnings: [],
  }), [activeTab, inputs, result]);

  // ── Badges ──
  const badges = useMemo(() => {
    const b: string[] = [inputs.refrigerant];
    if (result) b.push(`Tc ${result.Tc_C.toFixed(1)} °C`);
    if (result) b.push(`Margem ${(result.areaMargin * 100).toFixed(0)} %`);
    return b;
  }, [inputs.refrigerant, result]);

  // ── Sidebar ──
  const sidebar = (
    <div className="flex h-full flex-col gap-0">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <Accordion type="multiple" defaultValue={["load", "water", "geom", "thermo"]} className="space-y-1">

          {/* Carga Térmica */}
          <AccordionItem value="load" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              🔥 Carga Térmica
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Q total (kW)</Label>
                <Input type="number" value={draft.Q_total_W / 1000}
                  onChange={(e) => update({ Q_total_W: Number(e.target.value) * 1000 })}
                  className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Refrigerante</Label>
                <Select value={draft.refrigerant} onValueChange={(v) => update({ refrigerant: v })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRIGERANTS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Água de Resfriamento */}
          <AccordionItem value="water" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              💧 Água de Resfriamento
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">T entrada (°C)</Label>
                  <span className="text-[10px] font-medium">{draft.Tw_in_C} °C</span>
                </div>
                <Slider min={15} max={45} step={0.5} value={[draft.Tw_in_C]}
                  onValueChange={([v]) => update({ Tw_in_C: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Vazão (m³/h)</Label>
                  <span className="text-[10px] font-medium">{draft.waterFlowRate_m3h}</span>
                </div>
                <Slider min={0.5} max={20} step={0.5} value={[draft.waterFlowRate_m3h]}
                  onValueChange={([v]) => update({ waterFlowRate_m3h: v })} className="h-4" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Geometria dos Tubos */}
          <AccordionItem value="geom" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              📐 Geometria dos Tubos
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Nº de tubos</Label>
                  <span className="text-[10px] font-medium">{draft.tubeCount}</span>
                </div>
                <Slider min={4} max={100} step={2} value={[draft.tubeCount]}
                  onValueChange={([v]) => update({ tubeCount: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Passes</Label>
                  <span className="text-[10px] font-medium">{draft.passes}</span>
                </div>
                <Slider min={1} max={8} step={1} value={[draft.passes]}
                  onValueChange={([v]) => update({ passes: v })} className="h-4" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Comprimento (m)</Label>
                  <Input type="number" value={draft.tubeLength_m}
                    onChange={(e) => update({ tubeLength_m: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ø tubo (mm)</Label>
                  <Input type="number" value={draft.tubeDiameter_mm}
                    onChange={(e) => update({ tubeDiameter_mm: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Condições Termodinâmicas */}
          <AccordionItem value="thermo" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              🌡️ Condições Termodinâmicas
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Superaquecimento (K)</Label>
                  <span className="text-[10px] font-medium">{draft.superheat_K} K</span>
                </div>
                <Slider min={0} max={40} step={1} value={[draft.superheat_K]}
                  onValueChange={([v]) => update({ superheat_K: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Sub-resfriamento (K)</Label>
                  <span className="text-[10px] font-medium">{draft.subcooling_K} K</span>
                </div>
                <Slider min={0} max={20} step={1} value={[draft.subcooling_K]}
                  onValueChange={([v]) => update({ subcooling_K: v })} className="h-4" />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Botões de ação */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        <Button
          className="w-full h-9 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white"
          onClick={handleSimulate}
          disabled={isSimulating}
        >
          {isSimulating ? "Calculando…" : "⚡ Calcular"}
        </Button>
        <Button variant="outline" className="w-full h-8 text-xs" onClick={handleReset} disabled={isSimulating}>
          Restaurar Padrões
        </Button>
      </div>
    </div>
  );

  return (
    <WorkspaceLayout
      header={
        <WorkspaceHeader
          title="Condensador a Água (Casco-e-Tubos)"
          icon={<Waves className="h-4 w-4" />}
          badges={badges}
          onSave={() => toast.info("Salvar projeto em breve.")}
          onShare={handleShare}
          onExportPdf={handleExportPdf}
          isExportingPdf={isExportingPdf}
        />
      }
      sidebar={sidebar}
    >
      <div className="flex h-full flex-col gap-3 p-3">
        <ProjectHeaderBar workspaceType="component_workspace" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="flex w-full overflow-x-auto whitespace-nowrap scrollbar-none pb-px h-auto">
            <TabsTrigger value={TABS.RESULTS} className="shrink-0 text-xs font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              📋 Resultados
            </TabsTrigger>
            <TabsTrigger value={TABS.ENVELOPE} className="shrink-0 text-xs">📊 Envelope Tw×Tc</TabsTrigger>
            <TabsTrigger value={TABS.SIZING} className="shrink-0 text-xs">📐 Dimensionamento</TabsTrigger>
            <TabsTrigger value={TABS.DRAWING} className="shrink-0 text-xs">🏗️ Desenho</TabsTrigger>
            <TabsTrigger value={TABS.REPORT} className="shrink-0 text-xs">📄 Relatório</TabsTrigger>
          </TabsList>

          {/* ── Resultados ── */}
          <TabsContent value={TABS.RESULTS} className="mt-3 flex-1">
            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  <ResultCard label="Tc condensação" value={fmtBR(result.Tc_C, 1)} unit="°C" variant="success"
                    hint="Temperatura de condensação" />
                  <ResultCard label="T água saída" value={fmtBR(result.Tw_out_C, 1)} unit="°C" />
                  <ResultCard label="LMTD" value={fmtBR(result.LMTD_K, 1)} unit="K"
                    hint="Diferença de temperatura média logarítmica" />
                  <ResultCard label="U global" value={fmtBR(result.U_Wm2K, 0)} unit="W/m²K"
                    hint="Coeficiente global de transferência de calor" />
                  <ResultCard label="Área necessária" value={fmtBR(result.A_needed_m2, 3)} unit="m²" />
                  <ResultCard label="Área disponível" value={fmtBR(result.A_available_m2, 3)} unit="m²" />
                  <ResultCard
                    label="Margem de área"
                    value={fmtBR(result.areaMargin * 100, 1)}
                    unit="%"
                    variant={result.areaMargin < 0 ? "danger" : result.areaMargin < 0.1 ? "warning" : "success"}
                    hint=">0: folga, <0: subdimensionado"
                  />
                  <ResultCard label="ΔP água" value={fmtBR(result.pressureDrop_kPa, 2)} unit="kPa" />
                  <ResultCard label="W bomba" value={fmtBR(result.pumpPower_W, 0)} unit="W" />
                  <ResultCard label="h água" value={fmtBR(result.h_water_Wm2K, 0)} unit="W/m²K"
                    hint="Coeficiente convectivo lado água" />
                  <ResultCard label="h refrig." value={fmtBR(result.h_ref_Wm2K, 0)} unit="W/m²K"
                    hint="Coeficiente convectivo lado refrigerante" />
                  <ResultCard label="v água" value={fmtBR(result.v_water_ms, 2)} unit="m/s"
                    hint="Velocidade da água nos tubos" />
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Envelope Tw×Tc ── */}
          <TabsContent value={TABS.ENVELOPE} className="mt-3">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Envelope T água entrada × Tc</h3>
                  <Button size="sm" variant="outline" onClick={handleSaveEnvelope}>
                    <Save className="mr-1 h-3 w-3" /> Salvar no Projeto
                  </Button>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={envelope}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Tw_in_C" label={{ value: "Tw entrada (°C)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Tc (°C)", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => fmtBR(v, 1)} />
                        <Line type="monotone" dataKey="Tc_C" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Tc" />
                        <Line type="monotone" dataKey="Tw_out_C" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Tw saída" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Tw entrada (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">Tc (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">Tw saída (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">LMTD (K)</th>
                        <th className="px-3 py-2 text-right font-semibold">Margem (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envelope.map((pt, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          <td className="px-3 py-1.5">{pt.Tw_in_C}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.Tc_C, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.Tw_out_C, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.LMTD_K, 1)}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${pt.areaMargin_pct < 0 ? "text-red-500" : "text-green-600"}`}>
                            {fmtBR(pt.areaMargin_pct, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Dimensionamento ── */}
          <TabsContent value={TABS.SIZING} className="mt-3">
            {result ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Análise de Dimensionamento</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Área necessária (NTU-LMTD)</span>
                      <span className="font-medium">{fmtBR(result.A_needed_m2, 3)} m²</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Área disponível ({inputs.tubeCount} tubos × {inputs.passes} passes)</span>
                      <span className="font-medium">{fmtBR(result.A_available_m2, 3)} m²</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Margem de área</span>
                      <span className={`font-semibold ${result.areaMargin < 0 ? "text-red-500" : "text-green-600"}`}>
                        {fmtBR(result.areaMargin * 100, 1)} %
                        {result.areaMargin < 0 ? " ⚠️ Subdimensionado" : " ✓ OK"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Re água (turbulência)</span>
                      <span className={`font-medium ${result.Re_water > 2300 ? "text-green-600" : "text-amber-500"}`}>
                        {fmtBR(result.Re_water, 0)} {result.Re_water > 2300 ? "(turbulento)" : "(laminar)"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Velocidade água nos tubos</span>
                      <span className={`font-medium ${result.v_water_ms < 0.5 ? "text-amber-500" : result.v_water_ms > 3 ? "text-red-500" : "text-green-600"}`}>
                        {fmtBR(result.v_water_ms, 2)} m/s
                        {result.v_water_ms < 0.5 ? " ⚠️ Baixa" : result.v_water_ms > 3 ? " ⚠️ Alta" : " ✓ OK"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Queda de pressão</span>
                      <span className={`font-medium ${result.pressureDrop_kPa > 50 ? "text-amber-500" : "text-foreground"}`}>
                        {fmtBR(result.pressureDrop_kPa, 2)} kPa
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <ResultCard label="h água" value={fmtBR(result.h_water_Wm2K, 0)} unit="W/m²K" />
                  <ResultCard label="h refrig." value={fmtBR(result.h_ref_Wm2K, 0)} unit="W/m²K" />
                  <ResultCard label="U global" value={fmtBR(result.U_Wm2K, 0)} unit="W/m²K" />
                  <ResultCard label="LMTD" value={fmtBR(result.LMTD_K, 1)} unit="K" />
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Desenho ── */}
          <TabsContent value={TABS.DRAWING} className="mt-3">
            <DrawingTab
              heightMm={Math.sqrt(inputs.tubeCount) * 30}
              widthMm={inputs.tubeLength_m * 1000}
              depthMm={Math.sqrt(inputs.tubeCount) * 30}
              rows={Math.max(1, Math.round(Math.sqrt(inputs.tubeCount)))}
              tubesPerRow={Math.max(1, Math.round(Math.sqrt(inputs.tubeCount)))}
              tubeOuterDiamMm={inputs.tubeDiameter_mm}
              finPitchMm={0}
              circuits={inputs.passes}
              refrigerantId={inputs.refrigerant}
              componentType="condenser"
              projectName="Condensador a Água"
            />
          </TabsContent>

          {/* ── Relatório ── */}
          <TabsContent value={TABS.REPORT} className="mt-3">
            {result ? (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Relatório Técnico — Condensador a Água (Casco-e-Tubos)</h3>
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <h4 className="mb-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Entradas</h4>
                    <table className="w-full">
                      <tbody className="divide-y divide-border">
                        {[
                          ["Q total", `${(inputs.Q_total_W / 1000).toFixed(1)} kW`],
                          ["Refrigerante", inputs.refrigerant],
                          ["T água entrada", `${inputs.Tw_in_C} °C`],
                          ["Vazão água", `${inputs.waterFlowRate_m3h} m³/h`],
                          ["Nº tubos", inputs.tubeCount],
                          ["Comprimento", `${inputs.tubeLength_m} m`],
                          ["Ø tubo", `${inputs.tubeDiameter_mm} mm`],
                          ["Passes", inputs.passes],
                          ["Superaquecimento", `${inputs.superheat_K} K`],
                          ["Sub-resfriamento", `${inputs.subcooling_K} K`],
                        ].map(([k, v]) => (
                          <tr key={String(k)}>
                            <td className="py-1 text-muted-foreground">{k}</td>
                            <td className="py-1 text-right font-medium">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Resultados</h4>
                    <table className="w-full">
                      <tbody className="divide-y divide-border">
                        {[
                          ["Tc", `${result.Tc_C.toFixed(1)} °C`],
                          ["T água saída", `${result.Tw_out_C.toFixed(1)} °C`],
                          ["LMTD", `${result.LMTD_K.toFixed(1)} K`],
                          ["U global", `${result.U_Wm2K.toFixed(0)} W/m²K`],
                          ["Área necessária", `${result.A_needed_m2.toFixed(3)} m²`],
                          ["Área disponível", `${result.A_available_m2.toFixed(3)} m²`],
                          ["Margem área", `${(result.areaMargin * 100).toFixed(1)} %`],
                          ["ΔP água", `${result.pressureDrop_kPa.toFixed(2)} kPa`],
                          ["W bomba", `${result.pumpPower_W.toFixed(0)} W`],
                          ["Re água", fmtBR(result.Re_water, 0)],
                        ].map(([k, v]) => (
                          <tr key={String(k)}>
                            <td className="py-1 text-muted-foreground">{k}</td>
                            <td className="py-1 text-right font-medium">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>
        </Tabs>

        <ActionBar
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          onShare={handleShare}
          hasResults={!!result}
          isExportingPdf={isExportingPdf}
        />
      </div>

      <WorkspaceAIPanel open={aiOpen} onClose={() => setAiOpen(false)} context={aiContext} />
    </WorkspaceLayout>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Waves className="h-12 w-12 opacity-30" />
      <p className="text-sm">
        Configure os parâmetros e clique em <strong>Calcular</strong>
      </p>
    </div>
  );
}
