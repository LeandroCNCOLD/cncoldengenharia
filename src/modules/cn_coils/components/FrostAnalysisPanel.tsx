/**
 * FrostAnalysisPanel - Painel de análise de gelo integrado ao CycleEngine.
 */
import type { FrostAnalysisResult } from "../engines/frost/frostTypes";

interface FrostAnalysisPanelProps {
  result: FrostAnalysisResult;
  nominalCapacityW: number;
  operationTimeH: number;
}

function fmtBR(value: number, decimals = 1): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtKW(watts: number): string {
  return `${fmtBR(watts / 1000, 2)} kW`;
}

interface DegradationChartProps {
  curve: FrostAnalysisResult["degradationCurve"];
  nominalCapacityW: number;
  operationTimeH: number;
}

function DegradationChart({
  curve,
  nominalCapacityW,
  operationTimeH,
}: DegradationChartProps) {
  const W = 400;
  const H = 180;
  const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxCapacity = nominalCapacityW;
  const minCapacity = Math.min(...curve.map((p) => p.effectiveCapacityW)) * 0.95;
  const range = Math.max(maxCapacity - minCapacity, 1);
  const xScale = (t: number) => (t / Math.max(operationTimeH, 1e-6)) * chartW;
  const yScale = (q: number) => chartH - ((q - minCapacity) / range) * chartH;
  const pathD = curve
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.timeH).toFixed(1)} ${yScale(p.effectiveCapacityW).toFixed(1)}`)
    .join(" ");
  const nominalY = yScale(nominalCapacityW).toFixed(1);
  const tickCount = Math.min(6, Math.max(1, Math.ceil(operationTimeH)));
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) => (i * operationTimeH) / tickCount);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            y1={(f * chartH).toFixed(1)}
            x2={chartW}
            y2={(f * chartH).toFixed(1)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        ))}
        <line
          x1={0}
          y1={nominalY}
          x2={chartW}
          y2={nominalY}
          stroke="#6b7280"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={chartW + 4} y={nominalY} fontSize={9} fill="#6b7280" dominantBaseline="middle">
          Nominal
        </text>
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} />
        <path
          d={`${pathD} L ${xScale(operationTimeH).toFixed(1)} ${chartH} L 0 ${chartH} Z`}
          fill="#3b82f6"
          fillOpacity={0.08}
        />
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#9ca3af" strokeWidth={1} />
        {xTicks.map((t) => (
          <g key={t} transform={`translate(${xScale(t).toFixed(1)},${chartH})`}>
            <line y2={4} stroke="#9ca3af" strokeWidth={1} />
            <text y={14} fontSize={9} fill="#6b7280" textAnchor="middle">
              {fmtBR(t, 0)}h
            </text>
          </g>
        ))}
        <line x1={0} y1={0} x2={0} y2={chartH} stroke="#9ca3af" strokeWidth={1} />
        <text transform={`translate(-40,${chartH / 2}) rotate(-90)`} fontSize={9} fill="#6b7280" textAnchor="middle">
          Q efetivo (kW)
        </text>
        {[0, 0.5, 1].map((f) => {
          const q = minCapacity + f * (maxCapacity - minCapacity);
          return (
            <text key={f} x={-6} y={yScale(q).toFixed(1)} fontSize={9} fill="#6b7280" textAnchor="end" dominantBaseline="middle">
              {fmtBR(q / 1000, 1)}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

export function FrostAnalysisPanel({
  result,
  nominalCapacityW,
  operationTimeH,
}: FrostAnalysisPanelProps) {
  const modeLabel: Record<string, string> = {
    dry: "Superfície seca — sem formação de gelo",
    condensation_only: "Condensação — sem gelo (Ts > 0°C)",
    frosting: "Formação de gelo ativa",
  };
  const modeColor: Record<string, string> = {
    dry: "text-green-600",
    condensation_only: "text-yellow-600",
    frosting: "text-red-600",
  };
  const defrostMethodLabel: Record<string, string> = {
    electric: "Elétrico",
    hot_gas_reversal: "Gás quente — reversão",
    hot_gas_bypass: "Gás quente — bypass",
    natural: "Natural (ar)",
  };
  const liquidRiskColor: Record<string, string> = {
    low: "text-green-600",
    medium: "text-yellow-600",
    high: "text-red-600",
  };

  const frost = result.frostAtEndOfCycle;
  const defrost = result.defrostResult;

  return (
    <div className="space-y-4 text-sm text-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Análise de Gelo</h3>
        <span className={`font-medium ${modeColor[frost.mode] ?? "text-gray-600"}`}>
          {modeLabel[frost.mode] ?? frost.mode}
        </span>
      </div>

      {frost.mode !== "dry" && (
        <div>
          <p className="mb-1 text-xs text-gray-500">Degradação de Q(t) ao longo do ciclo</p>
          <DegradationChart
            curve={result.degradationCurve}
            nominalCapacityW={nominalCapacityW}
            operationTimeH={operationTimeH}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Espessura de gelo" value={`${fmtBR(frost.frost_thickness_mm, 2)} mm`} note={`após ${fmtBR(operationTimeH, 0)}h`} />
        <MetricCard
          label="Perda de capacidade"
          value={`${fmtBR(result.capacityLossAtEndPct, 1)}%`}
          note={`${fmtKW(result.effectiveCapacityAtEndW)} efetivo`}
          danger={result.capacityLossAtEndPct > 15}
        />
        <MetricCard label="Massa de gelo" value={`${fmtBR(frost.frost_mass_kg, 3)} kg`} />
        <MetricCard
          label="Tempo até degelo"
          value={result.estimatedTimeToDefrostH != null ? `${fmtBR(result.estimatedTimeToDefrostH, 1)}h` : "—"}
          note={result.recommendedDefrost ? "Degelo recomendado" : undefined}
          danger={result.recommendedDefrost}
        />
      </div>

      <div className="space-y-2 rounded border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">
            Ciclo de Degelo — {defrostMethodLabel[defrost.method] ?? defrost.method}
          </p>
          <span className={`text-xs font-medium ${liquidRiskColor[defrost.liquid_return_risk]}`}>
            Risco de retorno: {defrost.liquid_return_risk === "low" ? "Baixo" : defrost.liquid_return_risk === "medium" ? "Médio" : "Alto"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <DefrostMetric label="Energia necessária" value={`${fmtBR(defrost.Q_total_required_kj, 1)} kJ`} />
          <DefrostMetric label="Potência disponível" value={`${fmtBR(defrost.Q_defrost_available_kw, 2)} kW`} />
          <DefrostMetric
            label="Tempo estimado"
            value={Number.isFinite(defrost.defrost_time_min) ? `${fmtBR(defrost.defrost_time_min, 1)} min` : "∞"}
            danger={!defrost.defrost_time_feasible}
          />
        </div>
        {defrost.electric_power_w != null && (
          <p className="text-xs text-gray-500">
            Resistência elétrica: {fmtBR(defrost.electric_power_w / 1000, 2)} kW
            {" "}({fmtBR(defrost.electric_power_density_w_m2 ?? 0, 0)} W/m²)
          </p>
        )}
      </div>

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex gap-2 rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700">
              <span>⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  danger,
}: {
  label: string;
  value: string;
  note?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded bg-gray-50 p-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-semibold ${danger ? "text-red-600" : "text-gray-800"}`}>{value}</p>
      {note && <p className={`text-xs ${danger ? "text-red-500" : "text-gray-400"}`}>{note}</p>}
    </div>
  );
}

function DefrostMetric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`font-semibold ${danger ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
