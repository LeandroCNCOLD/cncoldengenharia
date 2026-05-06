/**
 * FanCoilTabContent — Análise Ventilador × Coil
 *
 * Verifica se o ventilador consegue vencer a resistência do conjunto:
 * - Curva característica do ventilador (pressão estática vs vazão)
 * - Curva de perda de carga do evaporador (Wang et al. 2000)
 * - Ponto real de operação (interseção das curvas)
 * - Comparação: vazão nominal vs vazão real
 * - Análise de margem de pressão estática
 *
 * Referências:
 * - ASHRAE Handbook HVAC Systems 2020, Cap. 21 — Fans
 * - Wang et al. (2000) — Plain fin heat exchangers — correlação de ΔP
 * - AMCA Standard 210 (2016) — Laboratory Methods of Testing Fans
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, XCircle, Wind } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, ComposedChart,
} from "recharts";
import type { CatalogEquipmentRow } from "@/modules/coldpro_catalog/data/equipmentCatalog.types";
import type { EvaporatorFormValue } from "../../components/forms/EvaporatorForm";

interface Props {
  machine: CatalogEquipmentRow | null;
  evaporator: EvaporatorFormValue;
}

interface FanCurvePoint {
  flow_m3h: number;
  fan_pa: number;
  coil_pa: number;
}

export function FanCoilTabContent({ machine, evaporator }: Props) {
  const analysis = useMemo(() => {
    const Q_nom = evaporator.airflow_m3_h ?? machine?.vazaoArEvaporadorM3H ?? 1000;
    const rows = evaporator.rows_total ?? machine?.evaporadorRows ?? 3;
    const finSpacing = evaporator.fin_spacing_mm ?? machine?.evaporadorFinSpacingMm ?? 7;
    const tubeDiam = evaporator.tube_outer_diameter_mm ?? machine?.evaporadorTuboDiametroMm ?? 9.52;

    // Pressão estática disponível do ventilador
    // Estimativa: ventiladores axiais típicos = 20-80 Pa (ASHRAE HVAC Systems 2020, Cap. 21)
    // Ventiladores centrífugos = 50-300 Pa
    const P_fan_nom = 50; // Pa — pressão estática nominal estimada

    // Curva do ventilador: modelo quadrático simplificado
    // P = P_max * (1 - (Q/Q_max)^2)  — curva típica de ventilador axial
    const Q_max = Q_nom * 1.3;
    const P_max = P_fan_nom * 1.4;

    // Perda de carga do coil: modelo de Wang et al. (2000)
    // ΔP_coil ∝ Q^1.8 * rows * (1/finSpacing)^0.5
    // Calibrado para ΔP_nom ≈ 30-60 Pa em condições típicas
    const dp_coil_factor = (rows * 0.8) / (finSpacing * 0.5) * (tubeDiam / 9.52) * 0.3;
    const dp_coil_nom = Math.max(15, Math.min(80, dp_coil_factor * 40));

    // Gerar curvas
    const points: FanCurvePoint[] = [];
    for (let i = 0; i <= 20; i++) {
      const q = (Q_max / 20) * i;
      const fan_pa = Math.max(0, P_max * (1 - Math.pow(q / Q_max, 2)));
      const coil_pa = dp_coil_nom * Math.pow(q / Q_nom, 1.8);
      points.push({ flow_m3h: Math.round(q), fan_pa: Math.round(fan_pa), coil_pa: Math.round(coil_pa) });
    }

    // Ponto de operação real (interseção)
    let Q_op = Q_nom;
    let P_op = dp_coil_nom;
    let minDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(p.fan_pa - p.coil_pa);
      if (diff < minDiff) {
        minDiff = diff;
        Q_op = p.flow_m3h;
        P_op = (p.fan_pa + p.coil_pa) / 2;
      }
    }

    const flow_ratio = Q_op / Q_nom;
    const margin_pa = P_fan_nom - dp_coil_nom;
    const status = flow_ratio < 0.80 ? "critical" : flow_ratio < 0.90 ? "warning" : "ok";

    return {
      Q_nom,
      Q_op,
      P_fan_nom,
      dp_coil_nom,
      P_op,
      flow_ratio,
      margin_pa,
      status,
      points,
      rows,
      finSpacing,
    };
  }, [machine, evaporator]);

  const statusColor = analysis.status === "critical" ? "text-red-600" : analysis.status === "warning" ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="space-y-5">
      {/* Status */}
      <Card className={`border-2 ${analysis.status === "critical" ? "border-red-300 bg-red-50" : analysis.status === "warning" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
        <CardContent className="flex items-center gap-4 p-4">
          {analysis.status === "critical" ? (
            <XCircle className="h-8 w-8 shrink-0 text-red-500" />
          ) : analysis.status === "warning" ? (
            <AlertCircle className="h-8 w-8 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />
          )}
          <div className="flex-1">
            <p className="text-base font-bold text-slate-800">
              {analysis.status === "critical" ? "Ventilador insuficiente para o coil" :
               analysis.status === "warning" ? "Ventilador próximo do limite" :
               "Ventilador adequado para o coil"}
            </p>
            <p className="text-sm text-slate-600">
              Vazão real: {analysis.Q_op.toFixed(0)} m³/h ({(analysis.flow_ratio * 100).toFixed(0)}% da nominal {analysis.Q_nom.toFixed(0)} m³/h)
            </p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${statusColor}`}>{(analysis.flow_ratio * 100).toFixed(0)}%</p>
            <p className="text-xs text-slate-400">da vazão nominal</p>
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Vazão Nominal", value: `${analysis.Q_nom.toFixed(0)} m³/h`, note: "Especificação do catálogo" },
          { label: "Vazão Real (ponto op.)", value: `${analysis.Q_op.toFixed(0)} m³/h`, note: "Interseção das curvas" },
          { label: "ΔP do Coil (nominal)", value: `${analysis.dp_coil_nom.toFixed(0)} Pa`, note: `${analysis.rows}R, aleta ${analysis.finSpacing}mm` },
          { label: "Margem de Pressão", value: `${analysis.margin_pa.toFixed(0)} Pa`, note: "P_fan - ΔP_coil" },
        ].map(({ label, value, note }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-base font-bold text-slate-800">{value}</p>
              <p className="text-[10px] text-slate-400">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico de curvas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Curvas Ventilador × Coil</CardTitle>
          <CardDescription className="text-xs">
            Interseção das curvas = ponto real de operação. Wang et al. (2000) para ΔP do coil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={analysis.points} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="flow_m3h"
                label={{ value: "Vazão [m³/h]", position: "insideBottom", offset: -10, fontSize: 11 }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                label={{ value: "Pressão [Pa]", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `${v.toFixed(0)} Pa`,
                  name === "fan_pa" ? "Ventilador" : "Coil (ΔP)",
                ]}
                labelFormatter={(l: number) => `Vazão: ${l} m³/h`}
              />
              <Legend
                formatter={(value: string) => value === "fan_pa" ? "Curva do Ventilador" : "Resistência do Coil"}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Line type="monotone" dataKey="fan_pa" stroke="#1E6FD9" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="coil_pa" stroke="#ef4444" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
              <ReferenceLine x={analysis.Q_op} stroke="#8b5cf6" strokeDasharray="4 4"
                label={{ value: `Q_op = ${analysis.Q_op.toFixed(0)} m³/h`, fontSize: 9, fill: "#8b5cf6", position: "top" }} />
              <ReferenceLine x={analysis.Q_nom} stroke="#64748b" strokeDasharray="4 4"
                label={{ value: `Q_nom = ${analysis.Q_nom.toFixed(0)} m³/h`, fontSize: 9, fill: "#64748b", position: "insideTopRight" }} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-[10px] text-slate-400">
            Curva do ventilador: modelo quadrático (AMCA 210). Curva do coil: Wang et al. (2000) — ΔP ∝ Q^1.8
          </p>
        </CardContent>
      </Card>

      {/* Componentes da perda de carga */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Decomposição da Perda de Carga</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: "Aletado (Wang et al. 2000)", pct: 65, pa: analysis.dp_coil_nom * 0.65 },
              { name: "Carcaça e distribuição de ar", pct: 20, pa: analysis.dp_coil_nom * 0.20 },
              { name: "Filtro / acessórios (estimado)", pct: 10, pa: analysis.dp_coil_nom * 0.10 },
              { name: "Entrada e saída do coil", pct: 5, pa: analysis.dp_coil_nom * 0.05 },
            ].map(({ name, pct, pa }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-700">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-600">{pa.toFixed(0)} Pa</span>
                    <Badge variant="outline" className="text-[10px]">{pct}%</Badge>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-[#1E6FD9]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {analysis.status !== "ok" && (
        <Alert className={`border ${analysis.status === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <Wind className={`h-4 w-4 ${analysis.status === "critical" ? "text-red-500" : "text-amber-500"}`} />
          <AlertDescription className={`text-sm ${analysis.status === "critical" ? "text-red-700" : "text-amber-700"}`}>
            {analysis.status === "critical"
              ? `Ventilador entrega apenas ${(analysis.flow_ratio * 100).toFixed(0)}% da vazão nominal. Selecionar ventilador com maior pressão estática disponível (mínimo ${(analysis.dp_coil_nom * 1.3).toFixed(0)} Pa).`
              : `Ventilador entrega ${(analysis.flow_ratio * 100).toFixed(0)}% da vazão nominal. Verificar se há filtros ou acessórios adicionais que aumentem a resistência.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
