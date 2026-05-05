/**
 * HeatingCoilWorkspacePage
 *
 * Workspace completo para baterias de aquecimento (água quente / vapor).
 * Segue o padrão do EvaporatorUnifiedWorkspacePage:
 *  - Sidebar esquerda com inputs organizados em Accordion + Sliders
 *  - Área central com abas (Resultados, Psicrométrico, Envelope, Desenho, Relatório)
 *  - WorkspaceAIPanel integrado
 *  - Exportação PDF/CSV/Excel
 */

import { useCallback, useMemo, useState } from "react";
import { ThermometerSun } from "lucide-react";
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
  calculateHeatingCoil,
  calculateMoistAirState,
  type HeatingCoilInputs,
  type HeatingCoilResult,
} from "../hooks/useHeatingCoilSimulation";
import type { AIContext } from "../components/WorkspaceAIChat";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBR = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

// ── Abas ─────────────────────────────────────────────────────────────────────
const TABS = {
  RESULTS: "results",
  PSYCHRO: "psychro",
  ENVELOPE: "envelope",
  DRAWING: "drawing",
  REPORT: "report",
} as const;

// ── Defaults ─────────────────────────────────────────────────────────────────
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

// ── Componente principal ──────────────────────────────────────────────────────
export function HeatingCoilWorkspacePage() {
  const [draft, setDraft] = useState<HeatingCoilInputs>(DEFAULT_INPUTS);
  const [inputs, setInputs] = useState<HeatingCoilInputs>(DEFAULT_INPUTS);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<HeatingCoilResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TABS.RESULTS);
  const [aiOpen, setAiOpen] = useState(false);

  const update = useCallback((patch: Partial<HeatingCoilInputs>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Simulação ──
  const handleSimulate = useCallback(() => {
    setIsSimulating(true);
    try {
      const r = calculateHeatingCoil(draft);
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

  // ── Envelope Tair_in × Q ──
  const envelope = useMemo(() => {
    if (!result) return [];
    return Array.from({ length: 11 }, (_, i) => {
      const Tair_in = -10 + i * 3;
      const r = calculateHeatingCoil({ ...inputs, Tair_in_C: Tair_in });
      return {
        Tair_in_C: Tair_in,
        Tair_out_C: r.Tair_out_C,
        Q_kW: r.Q_heating_W / 1000,
        epsilon: r.epsilon,
      };
    });
  }, [result, inputs]);

  // ── Dados psicrométricos ──
  const psychroData = useMemo(() => {
    if (!result) return [];
    const stateIn = calculateMoistAirState(inputs.Tair_in_C, inputs.RH_in, inputs.altitude_m);
    const stateOut = calculateMoistAirState(result.Tair_out_C, result.RH_out, inputs.altitude_m);
    return [
      { T: inputs.Tair_in_C, W: stateIn.W_kgkg * 1000, label: "Entrada" },
      { T: result.Tair_out_C, W: stateOut.W_kgkg * 1000, label: "Saída" },
    ];
  }, [result, inputs]);

  // ── Exportação CSV ──
  const handleExportCsv = useCallback(() => {
    if (!result) { toast.error("Execute o cálculo antes de exportar."); return; }
    const rows = [
      ["Parâmetro", "Valor"],
      ["T ar saída (°C)", result.Tair_out_C.toFixed(2)],
      ["UR saída (%)", (result.RH_out * 100).toFixed(1)],
      ["Q aquecimento (kW)", (result.Q_heating_W / 1000).toFixed(2)],
      ["NTU", result.NTU.toFixed(2)],
      ["Efetividade (%)", (result.epsilon * 100).toFixed(1)],
      ["U (W/m²K)", result.U_Wm2K.toFixed(0)],
      ["ΔP ar (Pa)", result.pressureDrop_Pa.toFixed(1)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "bateria_aquecimento.csv";
    a.click();
  }, [result]);

  const handleExportExcel = handleExportCsv;

  // ── Exportação PDF ──
  const { isGenerating: isExportingPdf, exportPdf } = usePdfExport();
  const handleExportPdf = useCallback(() => {
    if (!result) { toast.error("Execute o cálculo antes de exportar o PDF."); return; }
    exportPdf(
      <WorkspacePdfReport
        componentType="heating_coil"
        title="Bateria de Aquecimento"
        inputs={{
          "Modo": inputs.mode === "heating" ? "Aquecimento" : "Reaquecimento",
          "T ar entrada (°C)": inputs.Tair_in_C,
          "UR entrada (%)": (inputs.RH_in * 100).toFixed(0),
          "Vazão ar (m³/h)": inputs.airFlowRate_m3h,
          "Fluido": inputs.heatingFluid === "hot_water" ? "Água quente" : "Vapor",
          "T fluido entrada (°C)": inputs.Tf_in_C,
          "Filas": inputs.tubeRows,
          "Tubos/fila": inputs.tubesPerRow,
          "Comprimento (m)": inputs.tubeLength_m,
          "Passo aletas (mm)": inputs.finPitch_mm,
        }}
        results={{
          "T ar saída (°C)": result.Tair_out_C.toFixed(1),
          "UR saída (%)": (result.RH_out * 100).toFixed(1),
          "Q aquecimento (kW)": (result.Q_heating_W / 1000).toFixed(2),
          "NTU": result.NTU.toFixed(2),
          "Efetividade (%)": (result.epsilon * 100).toFixed(1),
          "U (W/m²K)": result.U_Wm2K.toFixed(0),
          "ΔP ar (Pa)": result.pressureDrop_Pa.toFixed(1),
          "Área ext. (m²)": result.A_ext_m2.toFixed(3),
        }}
      />,
      "bateria_aquecimento",
    );
  }, [result, inputs, exportPdf]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado para a área de transferência.");
  }, []);

  // ── AI Context ──
  const aiContext: AIContext = useMemo(() => ({
    componentType: "Bateria de Aquecimento",
    tabName: activeTab,
    parameters: result ? {
      "Modo": inputs.mode,
      "T ar entrada (°C)": inputs.Tair_in_C,
      "UR entrada (%)": (inputs.RH_in * 100).toFixed(0),
      "Vazão ar (m³/h)": inputs.airFlowRate_m3h,
      "Fluido": inputs.heatingFluid,
    } : undefined,
    results: result ? {
      "T ar saída (°C)": result.Tair_out_C.toFixed(1),
      "Q aquecimento (kW)": (result.Q_heating_W / 1000).toFixed(2),
      "Efetividade (%)": (result.epsilon * 100).toFixed(1),
      "ΔP ar (Pa)": result.pressureDrop_Pa.toFixed(1),
    } : undefined,
    warnings: [],
  }), [activeTab, inputs, result]);

  // ── Badges ──
  const badges = useMemo(() => {
    const b: string[] = [];
    b.push(inputs.heatingFluid === "hot_water" ? "Água Quente" : "Vapor");
    if (result) b.push(`${(result.Q_heating_W / 1000).toFixed(1)} kW`);
    if (result) b.push(`Tsaída ${result.Tair_out_C.toFixed(1)} °C`);
    return b;
  }, [inputs.heatingFluid, result]);

  // ── Sidebar ──
  const sidebar = (
    <div className="flex h-full flex-col gap-0">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <Accordion type="multiple" defaultValue={["mode", "air", "fluid", "geom"]} className="space-y-1">

          {/* Modo de Operação */}
          <AccordionItem value="mode" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              ⚙️ Modo de Operação
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Modo</Label>
                <Select value={draft.mode} onValueChange={(v) => update({ mode: v as HeatingCoilInputs["mode"] })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heating" className="text-xs">Aquecimento</SelectItem>
                    <SelectItem value="reheat" className="text-xs">Reaquecimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Fluido de aquecimento</Label>
                <Select value={draft.heatingFluid} onValueChange={(v) => update({ heatingFluid: v as HeatingCoilInputs["heatingFluid"] })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot_water" className="text-xs">Água quente</SelectItem>
                    <SelectItem value="steam" className="text-xs">Vapor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Lado Ar */}
          <AccordionItem value="air" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              🌬️ Lado Ar
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">T entrada (°C)</Label>
                  <span className="text-[10px] font-medium">{draft.Tair_in_C} °C</span>
                </div>
                <Slider min={-20} max={35} step={0.5} value={[draft.Tair_in_C]}
                  onValueChange={([v]) => update({ Tair_in_C: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">UR entrada (%)</Label>
                  <span className="text-[10px] font-medium">{(draft.RH_in * 100).toFixed(0)} %</span>
                </div>
                <Slider min={10} max={100} step={5} value={[draft.RH_in * 100]}
                  onValueChange={([v]) => update({ RH_in: v / 100 })} className="h-4" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Vazão ar (m³/h)</Label>
                <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.airFlowRate_m3h}
                  onChange={(e) => update({ airFlowRate_m3h: Number(e.target.value) })}
                  className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Altitude (m)</Label>
                <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.altitude_m}
                  onChange={(e) => update({ altitude_m: Number(e.target.value) })}
                  className="h-7 text-xs" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Fluido de Aquecimento */}
          <AccordionItem value="fluid" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              🔥 Fluido de Aquecimento
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">T entrada fluido (°C)</Label>
                  <span className="text-[10px] font-medium">{draft.Tf_in_C} °C</span>
                </div>
                <Slider min={40} max={150} step={1} value={[draft.Tf_in_C]}
                  onValueChange={([v]) => update({ Tf_in_C: v })} className="h-4" />
              </div>
              {draft.heatingFluid === "hot_water" && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label className="text-[10px] text-muted-foreground">T saída fluido (°C)</Label>
                    <span className="text-[10px] font-medium">{draft.Tf_out_C} °C</span>
                  </div>
                  <Slider min={30} max={130} step={1} value={[draft.Tf_out_C]}
                    onValueChange={([v]) => update({ Tf_out_C: v })} className="h-4" />
                </div>
              )}
              {draft.heatingFluid === "hot_water" && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Vazão fluido (m³/h)</Label>
                  <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.fluidFlowRate_m3h}
                    onChange={(e) => update({ fluidFlowRate_m3h: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Geometria */}
          <AccordionItem value="geom" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              📐 Geometria do Aletado
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Filas de tubos</Label>
                  <span className="text-[10px] font-medium">{draft.tubeRows}</span>
                </div>
                <Slider min={1} max={8} step={1} value={[draft.tubeRows]}
                  onValueChange={([v]) => update({ tubeRows: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Tubos por fila</Label>
                  <span className="text-[10px] font-medium">{draft.tubesPerRow}</span>
                </div>
                <Slider min={4} max={40} step={1} value={[draft.tubesPerRow]}
                  onValueChange={([v]) => update({ tubesPerRow: v })} className="h-4" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Comprimento (m)</Label>
                  <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.tubeLength_m}
                    onChange={(e) => update({ tubeLength_m: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Passo aletas (mm)</Label>
                  <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.finPitch_mm}
                    onChange={(e) => update({ finPitch_mm: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Ø tubo (mm)</Label>
                <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.tubeDiameter_mm}
                  onChange={(e) => update({ tubeDiameter_mm: Number(e.target.value) })}
                  className="h-7 text-xs" />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Botões de ação */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        <Button
          className="w-full h-9 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white"
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
          title="Bateria de Aquecimento"
          icon={<ThermometerSun className="h-4 w-4" />}
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
            <TabsTrigger value={TABS.RESULTS} className="shrink-0 text-xs font-semibold data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              📋 Resultados
            </TabsTrigger>
            <TabsTrigger value={TABS.PSYCHRO} className="shrink-0 text-xs">🌡️ Psicrométrico</TabsTrigger>
            <TabsTrigger value={TABS.ENVELOPE} className="shrink-0 text-xs">📊 Envelope Tar×Q</TabsTrigger>
            <TabsTrigger value={TABS.DRAWING} className="shrink-0 text-xs">🏗️ Desenho</TabsTrigger>
            <TabsTrigger value={TABS.REPORT} className="shrink-0 text-xs">📄 Relatório</TabsTrigger>
          </TabsList>

          {/* ── Resultados ── */}
          <TabsContent value={TABS.RESULTS} className="mt-3 flex-1">
            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  <ResultCard label="T ar saída" value={fmtBR(result.Tair_out_C, 1)} unit="°C" variant="success"
                    hint="Temperatura de saída do ar" />
                  <ResultCard label="UR saída" value={fmtBR(result.RH_out * 100, 1)} unit="%"
                    variant={result.RH_out < 0.3 ? "warning" : "success"} />
                  <ResultCard label="Q aquecimento" value={fmtBR(result.Q_heating_W / 1000, 2)} unit="kW"
                    hint="Capacidade de aquecimento" />
                  <ResultCard label="NTU" value={fmtBR(result.NTU, 2)} unit=""
                    hint="Número de unidades de transferência" />
                  <ResultCard label="Efetividade" value={fmtBR(result.epsilon * 100, 1)} unit="%"
                    variant={result.epsilon > 0.8 ? "success" : result.epsilon > 0.6 ? "warning" : "danger"} />
                  <ResultCard label="U global" value={fmtBR(result.U_Wm2K, 0)} unit="W/m²K" />
                  <ResultCard label="Área ext." value={fmtBR(result.A_ext_m2, 3)} unit="m²" />
                  <ResultCard label="ΔP ar" value={fmtBR(result.pressureDrop_Pa, 1)} unit="Pa"
                    variant={result.pressureDrop_Pa > 150 ? "warning" : "success"} />
                  <ResultCard label="W entrada ar" value={fmtBR(result.W_in_gkg, 1)} unit="g/kg" />
                  <ResultCard label="W saída ar" value={fmtBR(result.W_out_gkg, 1)} unit="g/kg" />
                  <ResultCard label="h entrada ar" value={fmtBR(result.h_in_kJkg, 1)} unit="kJ/kg" />
                  <ResultCard label="h saída ar" value={fmtBR(result.h_out_kJkg, 1)} unit="kJ/kg" />
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <ResultCard label="ṁ ar" value={fmtBR(result.mDot_air_kgs, 3)} unit="kg/s" />
                  <ResultCard label="T média fluido" value={fmtBR(result.Tf_mean_C, 1)} unit="°C" />
                  <ResultCard label="h ar" value={fmtBR(result.h_air_Wm2K, 0)} unit="W/m²K" />
                  <ResultCard label="h fluido" value={fmtBR(result.h_fluid_Wm2K, 0)} unit="W/m²K" />
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Psicrométrico ── */}
          <TabsContent value={TABS.PSYCHRO} className="mt-3">
            {result ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Diagrama Psicrométrico (T × W)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="T" name="T (°C)" label={{ value: "T (°C)", position: "insideBottom", offset: -5 }} type="number" domain={["auto", "auto"]} />
                        <YAxis dataKey="W" name="W (g/kg)" label={{ value: "W (g/kg)", angle: -90, position: "insideLeft" }} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: number) => fmtBR(v, 2)} />
                        <Scatter data={psychroData} fill="#f97316" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Estado de Entrada</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">T</span>
                        <span className="font-medium">{inputs.Tair_in_C} °C</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UR</span>
                        <span className="font-medium">{(inputs.RH_in * 100).toFixed(0)} %</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">W</span>
                        <span className="font-medium">{fmtBR(result.W_in_gkg, 1)} g/kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">h</span>
                        <span className="font-medium">{fmtBR(result.h_in_kJkg, 1)} kJ/kg</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3">
                    <h4 className="mb-2 text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase">Estado de Saída</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">T</span>
                        <span className="font-medium">{fmtBR(result.Tair_out_C, 1)} °C</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UR</span>
                        <span className="font-medium">{fmtBR(result.RH_out * 100, 1)} %</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">W</span>
                        <span className="font-medium">{fmtBR(result.W_out_gkg, 1)} g/kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">h</span>
                        <span className="font-medium">{fmtBR(result.h_out_kJkg, 1)} kJ/kg</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Envelope Tar×Q ── */}
          <TabsContent value={TABS.ENVELOPE} className="mt-3">
            {result ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Envelope T ar entrada × Q aquecimento</h3>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={envelope}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Tair_in_C" label={{ value: "T ar entrada (°C)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Q (kW)", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => fmtBR(v, 2)} />
                        <Line type="monotone" dataKey="Q_kW" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Q (kW)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">T ar entrada (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">T ar saída (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">Q (kW)</th>
                        <th className="px-3 py-2 text-right font-semibold">Efetividade (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envelope.map((pt, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          <td className="px-3 py-1.5">{pt.Tair_in_C}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.Tair_out_C, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.Q_kW, 2)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.epsilon * 100, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Desenho ── */}
          <TabsContent value={TABS.DRAWING} className="mt-3">
            <DrawingTab
              heightMm={inputs.tubesPerRow * 25}
              widthMm={inputs.tubeLength_m * 1000}
              depthMm={inputs.tubeRows * 25}
              rows={inputs.tubeRows}
              tubesPerRow={inputs.tubesPerRow}
              tubeOuterDiamMm={inputs.tubeDiameter_mm}
              finPitchMm={inputs.finPitch_mm}
              circuits={Math.max(1, Math.floor(inputs.tubesPerRow / 4))}
              refrigerantId="water"
              componentType="heater"
              projectName="Bateria de Aquecimento"
            />
          </TabsContent>

          {/* ── Relatório ── */}
          <TabsContent value={TABS.REPORT} className="mt-3">
            {result ? (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Relatório Técnico — Bateria de Aquecimento</h3>
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <h4 className="mb-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Entradas</h4>
                    <table className="w-full">
                      <tbody className="divide-y divide-border">
                        {[
                          ["Modo", inputs.mode === "heating" ? "Aquecimento" : "Reaquecimento"],
                          ["Fluido", inputs.heatingFluid === "hot_water" ? "Água quente" : "Vapor"],
                          ["T ar entrada", `${inputs.Tair_in_C} °C`],
                          ["UR entrada", `${(inputs.RH_in * 100).toFixed(0)} %`],
                          ["Vazão ar", `${inputs.airFlowRate_m3h} m³/h`],
                          ["T fluido entrada", `${inputs.Tf_in_C} °C`],
                          ["Filas", inputs.tubeRows],
                          ["Tubos/fila", inputs.tubesPerRow],
                          ["Comprimento", `${inputs.tubeLength_m} m`],
                          ["Passo aletas", `${inputs.finPitch_mm} mm`],
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
                          ["T ar saída", `${result.Tair_out_C.toFixed(1)} °C`],
                          ["UR saída", `${(result.RH_out * 100).toFixed(1)} %`],
                          ["Q aquecimento", `${(result.Q_heating_W / 1000).toFixed(2)} kW`],
                          ["NTU", result.NTU.toFixed(2)],
                          ["Efetividade", `${(result.epsilon * 100).toFixed(1)} %`],
                          ["U global", `${result.U_Wm2K.toFixed(0)} W/m²K`],
                          ["Área ext.", `${result.A_ext_m2.toFixed(3)} m²`],
                          ["ΔP ar", `${result.pressureDrop_Pa.toFixed(1)} Pa`],
                          ["h ar", `${result.h_air_Wm2K.toFixed(0)} W/m²K`],
                          ["h fluido", `${result.h_fluid_Wm2K.toFixed(0)} W/m²K`],
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
      <ThermometerSun className="h-12 w-12 opacity-30" />
      <p className="text-sm">
        Configure os parâmetros e clique em <strong>Calcular</strong>
      </p>
    </div>
  );
}
