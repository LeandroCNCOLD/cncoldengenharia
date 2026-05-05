/**
 * EvaporativeCondenserWorkspacePage
 *
 * Workspace completo para condensadores evaporativos.
 * Segue o padrão do EvaporatorUnifiedWorkspacePage:
 *  - Sidebar esquerda com inputs organizados em Accordion + Sliders
 *  - Área central com abas (Resultados, Consumo de Água, Envelope, Desenho, Relatório)
 *  - WorkspaceAIPanel integrado
 *  - Exportação PDF/CSV/Excel
 */

import { useCallback, useMemo, useState } from "react";
import { Droplets, Save } from "lucide-react";
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
  calculateEvaporativeCondenser,
  type EvaporativeCondenserInputs,
  type EvaporativeCondenserResult,
} from "../hooks/useEvaporativeCondenserSimulation";
import { useCoilEnvelopeStore } from "../store/useCoilEnvelopeStore";
import type { AIContext } from "../components/WorkspaceAIChat";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBR = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

// ── Abas ─────────────────────────────────────────────────────────────────────
const TABS = {
  RESULTS: "results",
  WATER: "water",
  ENVELOPE: "envelope",
  DRAWING: "drawing",
  REPORT: "report",
} as const;

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_INPUTS: EvaporativeCondenserInputs = {
  Q_total_W: 30_000,
  Twb_C: 24,
  Tdb_C: 35,
  altitude_m: 0,
  tubeRows: 4,
  tubesPerRow: 20,
  tubeLength_m: 2.4,
  tubeDiameter_mm: 19.05,
  waterFlowRate_Lmin: 15,
  airVelocity_ms: 3,
};

// ── Componente principal ──────────────────────────────────────────────────────
export function EvaporativeCondenserWorkspacePage() {
  const setCondenserEnvelope = useCoilEnvelopeStore((s) => s.setCondenserEnvelope);

  const [draft, setDraft] = useState<EvaporativeCondenserInputs>(DEFAULT_INPUTS);
  const [inputs, setInputs] = useState<EvaporativeCondenserInputs>(DEFAULT_INPUTS);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<EvaporativeCondenserResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TABS.RESULTS);
  const [aiOpen, setAiOpen] = useState(false);

  const update = useCallback((patch: Partial<EvaporativeCondenserInputs>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Simulação ──
  const handleSimulate = useCallback(() => {
    setIsSimulating(true);
    try {
      const r = calculateEvaporativeCondenser(draft);
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

  // ── Envelope Twb × Tc ──
  const envelope = useMemo(() => {
    if (!result) return [];
    return Array.from({ length: 13 }, (_, i) => {
      const Twb = 18 + i;
      const r = calculateEvaporativeCondenser({ ...inputs, Twb_C: Twb });
      return {
        Twb_C: Twb,
        Tc_C: r.Tc_C,
        Q_rejected_W: r.Q_rejected_W,
        waterMakeup_Lh: r.waterMakeup_Lh,
      };
    });
  }, [result, inputs]);

  // ── Salvar envelope no store ──
  const handleSaveEnvelope = useCallback(() => {
    if (envelope.length === 0) {
      toast.error("Execute o cálculo antes de salvar o envelope.");
      return;
    }
    setCondenserEnvelope(
      envelope.map((pt) => ({
        Tc: pt.Tc_C,
        Q_cond_W: pt.Q_rejected_W,
        UA: 0,
        LMTD: 0,
        Tair_out: 0,
      })),
    );
    toast.success("Envelope salvo no store de projeto.");
  }, [envelope, setCondenserEnvelope]);

  // ── Exportação CSV ──
  const handleExportCsv = useCallback(() => {
    if (!result) { toast.error("Execute o cálculo antes de exportar."); return; }
    const rows = [
      ["Parâmetro", "Valor"],
      ["Tc (°C)", result.Tc_C.toFixed(2)],
      ["Q rejeitado (W)", result.Q_rejected_W.toFixed(0)],
      ["UA (W/K)", result.UA_WK.toFixed(1)],
      ["Eficiência (%)", (result.eta_rejection * 100).toFixed(1)],
      ["Consumo água (L/h)", result.waterMakeup_Lh.toFixed(1)],
      ["W ventiladores (W)", result.W_fans_W.toFixed(0)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "cond_evaporativo.csv";
    a.click();
  }, [result]);

  const handleExportExcel = handleExportCsv;

  // ── Exportação PDF ──
  const { isGenerating: isExportingPdf, exportPdf } = usePdfExport();
  const handleExportPdf = useCallback(() => {
    if (!result) { toast.error("Execute o cálculo antes de exportar o PDF."); return; }
    exportPdf(
      <WorkspacePdfReport
        componentType="evaporative_condenser"
        title="Condensador Evaporativo"
        inputs={{
          "Q total (kW)": (inputs.Q_total_W / 1000).toFixed(1),
          "Twb (°C)": inputs.Twb_C,
          "Tdb (°C)": inputs.Tdb_C,
          "Altitude (m)": inputs.altitude_m,
          "Filas de tubos": inputs.tubeRows,
          "Tubos por fila": inputs.tubesPerRow,
          "Comprimento (m)": inputs.tubeLength_m,
          "Ø tubo (mm)": inputs.tubeDiameter_mm,
          "Vazão água (L/min)": inputs.waterFlowRate_Lmin,
          "Vel. ar (m/s)": inputs.airVelocity_ms,
        }}
        results={{
          "Tc (°C)": result.Tc_C.toFixed(1),
          "Approach (K)": (result.Tc_C - inputs.Twb_C).toFixed(1),
          "Q rejeitado (kW)": (result.Q_rejected_W / 1000).toFixed(1),
          "UA (kW/K)": (result.UA_WK / 1000).toFixed(2),
          "NTU": result.NTU.toFixed(2),
          "Eficiência (%)": (result.eta_rejection * 100).toFixed(1),
          "Consumo água (L/h)": result.waterMakeup_Lh.toFixed(1),
          "W ventiladores (W)": result.W_fans_W.toFixed(0),
        }}
      />,
      "condensador_evaporativo",
    );
  }, [result, inputs, exportPdf]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado para a área de transferência.");
  }, []);

  // ── AI Context ──
  const aiContext: AIContext = useMemo(() => ({
    componentType: "Condensador Evaporativo",
    tabName: activeTab,
    parameters: result ? {
      "Q total (kW)": (inputs.Q_total_W / 1000).toFixed(1),
      "Twb (°C)": inputs.Twb_C,
      "Tdb (°C)": inputs.Tdb_C,
      "Vel. ar (m/s)": inputs.airVelocity_ms,
    } : undefined,
    results: result ? {
      "Tc (°C)": result.Tc_C.toFixed(1),
      "Approach (K)": (result.Tc_C - inputs.Twb_C).toFixed(1),
      "Q rejeitado (kW)": (result.Q_rejected_W / 1000).toFixed(1),
      "Consumo água (L/h)": result.waterMakeup_Lh.toFixed(1),
    } : undefined,
    warnings: [],
  }), [activeTab, inputs, result]);

  // ── Badges ──
  const badges = useMemo(() => {
    const b: string[] = [];
    if (result) b.push(`Tc ${result.Tc_C.toFixed(1)} °C`);
    if (result) b.push(`${(result.Q_rejected_W / 1000).toFixed(1)} kW`);
    return b;
  }, [result]);

  // ── Sidebar ──
  const sidebar = (
    <div className="flex h-full flex-col gap-0">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <Accordion type="multiple" defaultValue={["load", "air", "geom", "water_spray"]} className="space-y-1">

          {/* Carga Térmica */}
          <AccordionItem value="load" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              🔥 Carga Térmica
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Q total (kW)</Label>
                <Input
                  type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
                  value={draft.Q_total_W / 1000}
                  onChange={(e) => update({ Q_total_W: Number(e.target.value) * 1000 })}
                  className="h-7 text-xs"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Condições do Ar */}
          <AccordionItem value="air" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              🌬️ Condições do Ar
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Twb (°C)</Label>
                  <span className="text-[10px] font-medium">{draft.Twb_C} °C</span>
                </div>
                <Slider min={10} max={35} step={0.5} value={[draft.Twb_C]}
                  onValueChange={([v]) => update({ Twb_C: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Tdb (°C)</Label>
                  <span className="text-[10px] font-medium">{draft.Tdb_C} °C</span>
                </div>
                <Slider min={15} max={50} step={0.5} value={[draft.Tdb_C]}
                  onValueChange={([v]) => update({ Tdb_C: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Vel. ar (m/s)</Label>
                  <span className="text-[10px] font-medium">{draft.airVelocity_ms} m/s</span>
                </div>
                <Slider min={1} max={6} step={0.1} value={[draft.airVelocity_ms]}
                  onValueChange={([v]) => update({ airVelocity_ms: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Altitude (m)</Label>
                <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.altitude_m}
                  onChange={(e) => update({ altitude_m: Number(e.target.value) })}
                  className="h-7 text-xs" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Geometria */}
          <AccordionItem value="geom" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              📐 Geometria dos Tubos
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Filas de tubos</Label>
                  <span className="text-[10px] font-medium">{draft.tubeRows}</span>
                </div>
                <Slider min={1} max={10} step={1} value={[draft.tubeRows]}
                  onValueChange={([v]) => update({ tubeRows: v })} className="h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Tubos por fila</Label>
                  <span className="text-[10px] font-medium">{draft.tubesPerRow}</span>
                </div>
                <Slider min={4} max={60} step={1} value={[draft.tubesPerRow]}
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
                  <Label className="text-[10px] text-muted-foreground">Ø tubo (mm)</Label>
                  <Input type="text" inputMode="decimal" onFocus={(e) => e.target.select()} value={draft.tubeDiameter_mm}
                    onChange={(e) => update({ tubeDiameter_mm: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Água de Aspersão */}
          <AccordionItem value="water_spray" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              💧 Água de Aspersão
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Vazão (L/min)</Label>
                  <span className="text-[10px] font-medium">{draft.waterFlowRate_Lmin}</span>
                </div>
                <Slider min={5} max={60} step={1} value={[draft.waterFlowRate_Lmin]}
                  onValueChange={([v]) => update({ waterFlowRate_Lmin: v })} className="h-4" />
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
          title="Condensador Evaporativo"
          icon={<Droplets className="h-4 w-4" />}
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
            <TabsTrigger value={TABS.WATER} className="shrink-0 text-xs">💧 Consumo de Água</TabsTrigger>
            <TabsTrigger value={TABS.ENVELOPE} className="shrink-0 text-xs">📊 Envelope Twb×Tc</TabsTrigger>
            <TabsTrigger value={TABS.DRAWING} className="shrink-0 text-xs">🏗️ Desenho</TabsTrigger>
            <TabsTrigger value={TABS.REPORT} className="shrink-0 text-xs">📄 Relatório</TabsTrigger>
          </TabsList>

          {/* ── Resultados ── */}
          <TabsContent value={TABS.RESULTS} className="mt-3 flex-1">
            {result ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                <ResultCard label="Tc condensação" value={fmtBR(result.Tc_C, 1)} unit="°C" variant="success"
                  hint="Temperatura de condensação estimada" />
                <ResultCard label="Approach (Tc−Twb)" value={fmtBR(result.Tc_C - inputs.Twb_C, 1)} unit="K"
                  variant={result.Tc_C - inputs.Twb_C > 8 ? "danger" : result.Tc_C - inputs.Twb_C > 5 ? "warning" : "success"} />
                <ResultCard label="Q rejeitado" value={fmtBR(result.Q_rejected_W / 1000, 1)} unit="kW" />
                <ResultCard label="UA" value={fmtBR(result.UA_WK / 1000, 2)} unit="kW/K" />
                <ResultCard label="NTU" value={fmtBR(result.NTU, 2)} unit="" />
                <ResultCard label="Eficiência" value={fmtBR(result.eta_rejection * 100, 1)} unit="%"
                  variant={result.eta_rejection > 0.85 ? "success" : result.eta_rejection > 0.7 ? "warning" : "danger"} />
                <ResultCard label="T saída ar" value={fmtBR(result.Tair_out_C, 1)} unit="°C" />
                <ResultCard label="W ar entrada" value={fmtBR(result.W_in_gkg, 1)} unit="g/kg" />
                <ResultCard label="Vazão ar" value={fmtBR(result.mDot_air_kgs, 2)} unit="kg/s" />
                <ResultCard label="Consumo água" value={fmtBR(result.waterMakeup_Lh, 1)} unit="L/h" variant="warning"
                  hint="Evaporação + purga + drift" />
                <ResultCard label="W ventiladores" value={fmtBR(result.W_fans_W, 0)} unit="W" />
                <ResultCard label="Área tubos" value={fmtBR(result.A_ext_m2, 2)} unit="m²" />
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Consumo de Água ── */}
          <TabsContent value={TABS.WATER} className="mt-3">
            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <ResultCard label="Evaporação" value={fmtBR(result.waterEvaporation_Lh, 1)} unit="L/h" />
                  <ResultCard label="Purga (blowdown)" value={fmtBR(result.waterBlowdown_Lh, 1)} unit="L/h" />
                  <ResultCard label="Drift (arraste)" value={fmtBR(result.waterDrift_Lh, 2)} unit="L/h" />
                  <ResultCard label="Reposição total" value={fmtBR(result.waterMakeup_Lh, 1)} unit="L/h" variant="warning" />
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <ResultCard label="Mensal (720 h)" value={fmtBR((result.waterMakeup_Lh * 720) / 1000, 1)} unit="m³/mês" />
                  <ResultCard label="Anual (8760 h)" value={fmtBR((result.waterMakeup_Lh * 8760) / 1000, 0)} unit="m³/ano" />
                  <ResultCard label="CoC (ciclos conc.)" value="3" unit="ciclos" />
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Consumo de Água × Twb</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={envelope}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Twb_C" label={{ value: "Twb (°C)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Reposição (L/h)", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => fmtBR(v, 1)} />
                        <Line type="monotone" dataKey="waterMakeup_Lh" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          {/* ── Envelope Twb×Tc ── */}
          <TabsContent value={TABS.ENVELOPE} className="mt-3">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Envelope Twb × Tc</h3>
                  <Button size="sm" variant="outline" onClick={handleSaveEnvelope}>
                    <Save className="mr-1 h-3 w-3" /> Salvar no Projeto
                  </Button>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={envelope}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Twb_C" label={{ value: "Twb (°C)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Tc (°C)", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: number) => fmtBR(v, 1)} />
                        <Line type="monotone" dataKey="Tc_C" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Twb (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">Tc (°C)</th>
                        <th className="px-3 py-2 text-right font-semibold">Q rej. (kW)</th>
                        <th className="px-3 py-2 text-right font-semibold">Água (L/h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envelope.map((pt, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          <td className="px-3 py-1.5">{pt.Twb_C}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.Tc_C, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.Q_rejected_W / 1000, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtBR(pt.waterMakeup_Lh, 1)}</td>
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
              finPitchMm={3}
              circuits={Math.max(1, Math.floor(inputs.tubesPerRow / 4))}
              refrigerantId="R404A"
              componentType="condenser"
              projectName="Condensador Evaporativo"
            />
          </TabsContent>

          {/* ── Relatório ── */}
          <TabsContent value={TABS.REPORT} className="mt-3">
            {result ? (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Relatório Técnico — Condensador Evaporativo</h3>
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <h4 className="mb-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Entradas</h4>
                    <table className="w-full">
                      <tbody className="divide-y divide-border">
                        {[
                          ["Q total", `${(inputs.Q_total_W / 1000).toFixed(1)} kW`],
                          ["Twb", `${inputs.Twb_C} °C`],
                          ["Tdb", `${inputs.Tdb_C} °C`],
                          ["Altitude", `${inputs.altitude_m} m`],
                          ["Filas de tubos", inputs.tubeRows],
                          ["Tubos por fila", inputs.tubesPerRow],
                          ["Comprimento", `${inputs.tubeLength_m} m`],
                          ["Ø tubo", `${inputs.tubeDiameter_mm} mm`],
                          ["Vazão água", `${inputs.waterFlowRate_Lmin} L/min`],
                          ["Vel. ar", `${inputs.airVelocity_ms} m/s`],
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
                          ["Approach (Tc−Twb)", `${(result.Tc_C - inputs.Twb_C).toFixed(1)} K`],
                          ["Q rejeitado", `${(result.Q_rejected_W / 1000).toFixed(1)} kW`],
                          ["UA", `${(result.UA_WK / 1000).toFixed(2)} kW/K`],
                          ["NTU", result.NTU.toFixed(2)],
                          ["Eficiência", `${(result.eta_rejection * 100).toFixed(1)} %`],
                          ["T saída ar", `${result.Tair_out_C.toFixed(1)} °C`],
                          ["Consumo água", `${result.waterMakeup_Lh.toFixed(1)} L/h`],
                          ["W ventiladores", `${result.W_fans_W.toFixed(0)} W`],
                          ["Área tubos", `${result.A_ext_m2.toFixed(2)} m²`],
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
      <Droplets className="h-12 w-12 opacity-30" />
      <p className="text-sm">
        Configure os parâmetros e clique em <strong>Calcular</strong>
      </p>
    </div>
  );
}
