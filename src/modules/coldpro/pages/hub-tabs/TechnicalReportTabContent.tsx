/**
 * TechnicalReportTabContent — Relatório Técnico
 *
 * Gera um relatório técnico completo do sistema com:
 * - Identificação da máquina
 * - Resultados de todas as análises
 * - Diagnóstico da IA
 * - Recomendações priorizadas
 * - Referências técnicas
 *
 * Pode ser copiado para clipboard ou impresso.
 */
import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, Printer, CheckCircle2 } from "lucide-react";
import { useTestHubStore } from "../../stores/useTestHubStore";
import type { CatalogEquipmentRow } from "@/modules/coldpro_catalog/data/equipmentCatalog.types";
import { useState } from "react";

interface Props {
  machine: CatalogEquipmentRow | null;
}

const KCALH_TO_W = 1.163;

export function TechnicalReportTabContent({ machine }: Props) {
  const { compressor, condenser, evaporator, conditions, ph, montecarlo, optimization, ai } = useTestHubStore();
  const [copied, setCopied] = useState(false);

  const reportText = useMemo(() => {
    const now = new Date().toLocaleString("pt-BR");
    const Q_kW = (compressor.cooling_capacity_w ?? 0) / 1000;
    const W_kW = (compressor.power_w ?? Q_kW / 2.5) / 1000;
    const COP = W_kW > 0 ? Q_kW / W_kW : 0;

    const lines: string[] = [
      "═══════════════════════════════════════════════════════════════",
      "  RELATÓRIO TÉCNICO — HUB DE TESTES CN COILS / COLDPRO",
      "═══════════════════════════════════════════════════════════════",
      `  Data: ${now}`,
      "",
      "─── 1. IDENTIFICAÇÃO DO EQUIPAMENTO ────────────────────────────",
      `  Modelo: ${machine?.modelo ?? "—"}`,
      `  Aplicação: ${machine?.application ?? "—"}`,
      `  Refrigerante: ${machine?.refrigerante ?? compressor.refrigerant ?? "—"}`,
      `  Linha: ${machine?.linha ?? "—"}`,
      `  Tensão: ${machine?.tensaoComercial ?? `${machine?.tensaoV ?? "—"}V/${machine?.frequenciaHz ?? "—"}Hz`}`,
      `  Compressor: ${machine?.compressorModelo ?? "—"}`,
      "",
      "─── 2. PARÂMETROS NOMINAIS ─────────────────────────────────────",
      `  Capacidade frigorífica: ${Q_kW.toFixed(2)} kW (${(Q_kW / KCALH_TO_W * 1000).toFixed(0)} kcal/h)`,
      `  Potência elétrica: ${W_kW.toFixed(2)} kW`,
      `  COP: ${COP.toFixed(3)}`,
      `  EER: ${(COP * 3.412).toFixed(3)}`,
      `  Te: ${(compressor.evap_temp_c ?? machine?.tempEvaporacaoC ?? "—")}°C`,
      `  Tc: ${(compressor.cond_temp_c ?? machine?.tempCondensacaoC ?? "—")}°C`,
      `  T_ambiente: ${(conditions.ambient_temp_c ?? machine?.tempAmbienteC ?? "—")}°C`,
      `  Vazão ar evaporador: ${(evaporator.airflow_m3_h ?? machine?.vazaoArEvaporadorM3H ?? "—")} m³/h`,
      `  Vazão ar condensador: ${(machine?.vazaoArCondensadorM3H ?? "—")} m³/h`,
      "",
    ];

    if (ph.result) {
      lines.push("─── 3. DIAGRAMA P-H (CICLO DE MOLLIER) ─────────────────────────");
      lines.push(`  COP do ciclo: ${ph.result.COP.toFixed(3)}`);
      lines.push(`  EER: ${ph.result.EER.toFixed(3)}`);
      lines.push(`  Razão de compressão: ${ph.result.compressionRatio.toFixed(2)}`);
      lines.push(`  Temperatura de descarga: ${ph.result.dischargeTemp_C.toFixed(1)}°C`);
      lines.push(`  Superaquecimento: ${ph.result.superheatK.toFixed(1)} K`);
      lines.push(`  Subresfriamento: ${ph.result.subcoolingK.toFixed(1)} K`);
      lines.push(`  Efeito frigorífico: ${ph.result.qEvap_kJkg.toFixed(2)} kJ/kg`);
      lines.push(`  Trabalho de compressão: ${ph.result.wComp_kJkg.toFixed(2)} kJ/kg`);
      lines.push(`  Calor rejeitado: ${ph.result.qCond_kJkg.toFixed(2)} kJ/kg`);
      lines.push("");
      lines.push("  Pontos do ciclo:");
      ph.result.points.forEach((p) => {
        lines.push(`    ${p.label}: T=${p.T_C.toFixed(1)}°C, P=${p.P_kPa.toFixed(1)} kPa, h=${p.h_kJkg.toFixed(2)} kJ/kg`);
      });
      lines.push("");
    }

    if (montecarlo.result) {
      lines.push("─── 4. ANÁLISE DE MONTE CARLO (N=500) ──────────────────────────");
      lines.push(`  COP — IC90%: [${montecarlo.result.cop.lower.toFixed(3)}, ${montecarlo.result.cop.upper.toFixed(3)}] | nominal: ${montecarlo.result.cop.nominal.toFixed(3)} | σ: ${montecarlo.result.cop.stdDev.toFixed(3)}`);
      lines.push(`  Capacidade — IC90%: [${(montecarlo.result.capacity.lower / 1000).toFixed(2)}, ${(montecarlo.result.capacity.upper / 1000).toFixed(2)}] kW | nominal: ${(montecarlo.result.capacity.nominal / 1000).toFixed(2)} kW`);
      lines.push(`  Amostras: ${montecarlo.result.samples} | IC: ${montecarlo.result.confidenceLevel * 100}%`);
      if (montecarlo.result.sensitivityRanking.length > 0) {
        lines.push("  Variáveis mais sensíveis:");
        montecarlo.result.sensitivityRanking.slice(0, 3).forEach((s, i) => {
          lines.push(`    ${i + 1}. ${s.parameter} (impacto: ${s.impact_pct.toFixed(1)}%)`);
        });
      }
      lines.push("");
    }

    if (optimization.result?.bestEquilibrium) {
      const opt = optimization.result.bestEquilibrium;
      lines.push("─── 5. OTIMIZAÇÃO AUTOMÁTICA ────────────────────────────────────");
      lines.push(`  Te ótimo: ${opt.Te_C.toFixed(1)}°C`);
      lines.push(`  Tc ótimo: ${opt.Tc_C.toFixed(1)}°C`);
      lines.push(`  Q_evap ótimo: ${(opt.Q_evap_W / 1000).toFixed(2)} kW`);
      lines.push(`  COP ótimo: ${opt.COP.toFixed(3)}`);
      lines.push(`  Erro de balanço: ${opt.balance_error_pct.toFixed(2)}%`);
      if (optimization.result.adjustments.length > 0) {
        lines.push("  Ajustes recomendados:");
        optimization.result.adjustments.forEach((adj) => {
          lines.push(`    [${adj.priority.toUpperCase()}] ${adj.parameter}: ${adj.current} → ${adj.suggested} (${adj.expectedGain})`);
        });
      }
      lines.push("");
    }

    if (ai.result) {
      lines.push("─── 6. DIAGNÓSTICO DE IA ────────────────────────────────────────");
      lines.push(`  Nota: ${ai.result.grade} (${ai.result.score}/100)`);
      lines.push(`  Diagnóstico: ${ai.result.summary}`);
      lines.push("");
      lines.push("  Diagnósticos por categoria:");
      ai.result.diagnoses.forEach((d) => {
        const sev = d.severity === "critical" ? "CRÍTICO" : d.severity === "warning" ? "ATENÇÃO" : "OK";
        lines.push(`    [${sev}] ${d.category}: ${d.finding}`);
        lines.push(`           ${d.explanation}`);
        lines.push(`           Ref: ${d.reference}`);
      });
      lines.push("");
      lines.push("  Recomendações:");
      ai.result.recommendations.forEach((r) => {
        lines.push(`    ${r.priority}. ${r.action}`);
        lines.push(`       Impacto: ${r.expectedImpact}`);
        lines.push(`       Ref: ${r.reference}`);
      });
      lines.push("");
    }

    lines.push("─── REFERÊNCIAS TÉCNICAS ────────────────────────────────────────");
    lines.push("  - ASHRAE Handbook Refrigeration (2022)");
    lines.push("  - ASHRAE Handbook Fundamentals (2021)");
    lines.push("  - AHRI Standard 540 (2020) — Compressor Performance Ratings");
    lines.push("  - EN 12900:2013 — Refrigerant compressors — Rating conditions");
    lines.push("  - Bitzer Technical Information A-501 (2019)");
    lines.push("  - Incropera et al. (2011) — Fundamentals of Heat and Mass Transfer, 7th ed.");
    lines.push("  - Wang et al. (2000) — Plain fin heat exchangers");
    lines.push("  - Bejan, A. (2016) — Advanced Engineering Thermodynamics, 4th ed.");
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("  Gerado por CN Coils / ColdPro — Hub de Testes");
    lines.push("═══════════════════════════════════════════════════════════════");

    return lines.join("\n");
  }, [machine, compressor, condenser, evaporator, conditions, ph.result, montecarlo.result, optimization.result, ai.result]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [reportText]);

  const handlePrint = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Relatório Técnico</title><style>body{font-family:monospace;font-size:12px;white-space:pre;padding:20px;}</style></head><body>${reportText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`);
    win.document.close();
    win.print();
  }, [reportText]);

  const completedAnalyses = [ph.result, montecarlo.result, optimization.result, ai.result].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-[#1E6FD9]" />
            <div>
              <p className="text-sm font-bold text-slate-800">Relatório Técnico Completo</p>
              <p className="text-xs text-slate-500">
                {completedAnalyses}/4 análises incluídas · {machine?.modelo ?? "Máquina não selecionada"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />Copiado!</>
              ) : (
                <><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatório */}
      <Card>
        <CardContent className="p-0">
          <pre className="overflow-auto rounded-lg bg-slate-900 p-5 text-[11px] leading-relaxed text-slate-200 font-mono">
            {reportText}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
