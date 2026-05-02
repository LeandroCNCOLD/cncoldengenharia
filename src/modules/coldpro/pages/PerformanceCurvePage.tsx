import { useState } from "react";
import { Play, BarChart2 } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { CompressorForm } from "../components/forms/CompressorForm";
import { CondenserForm } from "../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../components/forms/SystemConditionsForm";
import { OperatingGridForm, generateGrid, type GridConfig } from "../components/forms/OperatingGridForm";
import { buildMinimalEvaporatorInput } from "../components/forms/EvaporatorForm";
import { PerformanceCurveChart, type PerformanceMetric } from "../components/charts/PerformanceCurveChart";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WarningBanner } from "../components/ui/WarningBanner";
import { usePerformanceCurve } from "../hooks/usePerformanceCurve";
import { formatCapacity, formatCOP } from "../utils/formatting";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";

const METRIC_OPTIONS: { value: PerformanceMetric; label: string }[] = [
  { value: "capacity_w", label: "Capacidade" },
  { value: "cop", label: "COP" },
  { value: "compressor_power_w", label: "Potência" },
];

export function PerformanceCurvePage() {
  const { result, isCalculating, calculate } = usePerformanceCurve();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    evap_temps: [-15, -10, -5, 0],
    cond_temps: [30, 35, 40, 45],
  });
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric>("capacity_w");

  const canCalculate = Boolean(
    compressor.cooling_capacity_w &&
      compressor.power_w &&
      compressor.evap_temp_c !== undefined &&
      compressor.cond_temp_c !== undefined &&
      compressor.refrigerant &&
      condenser.heat_rejection_capacity_w &&
      condenser.max_cond_temp_c !== undefined &&
      conditions.ambient_temp_c !== undefined &&
      conditions.required_airflow_m3_h &&
      gridConfig.evap_temps.length > 0 &&
      gridConfig.cond_temps.length > 0,
  );

  const handleCalculate = () => {
    if (!canCalculate) return;
    calculate({
      system: {
        compressor: compressor as CompressorSpec,
        evaporator: { progressive_input: buildMinimalEvaporatorInput(compressor, conditions) },
        condenser: condenser as CondenserSpec,
        system_conditions: {
          ambient_temp_c: conditions.ambient_temp_c!,
          required_airflow_m3_h: conditions.required_airflow_m3_h!,
        },
      },
      operating_points: generateGrid(gridConfig),
    });
  };

  return (
    <PageContainer
      title="Curva de Desempenho"
      subtitle="Gera a curva de desempenho do produto em uma grade de pontos"
      actions={
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate || isCalculating}
          className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Play className="h-4 w-4" />
          {isCalculating ? "Calculando..." : "Gerar Curva"}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <CompressorForm value={compressor} onChange={setCompressor} />
          <CondenserForm value={condenser} onChange={setCondenser} />
          <SystemConditionsForm value={conditions} onChange={setConditions} />
          <OperatingGridForm value={gridConfig} onChange={setGridConfig} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          {isCalculating && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <LoadingSpinner label="Calculando curva..." />
            </div>
          )}

          {result?.success && !isCalculating && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 grid grid-cols-4 gap-3">
                  <Stat value={result.data.summary.total_points} label="Total" tone="slate" />
                  <Stat value={result.data.summary.approved_points} label="Aprovados" tone="emerald" />
                  <Stat value={result.data.summary.warning_points} label="Atenção" tone="amber" />
                  <Stat value={result.data.summary.rejected_points} label="Rejeitados" tone="red" />
                </div>

                <div className="mb-3 flex items-center gap-2">
                  {METRIC_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSelectedMetric(m.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        selectedMetric === m.value
                          ? "bg-[#1E6FD9] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <PerformanceCurveChart points={result.data.points} metric={selectedMetric} />
              </section>

              {result.data.warnings.length > 0 && <WarningBanner warnings={result.data.warnings} />}

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Pontos Calculados</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200 text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">T_evap</th>
                        <th className="py-2 pr-3">T_cond</th>
                        <th className="py-2 pr-3">Capacidade</th>
                        <th className="py-2 pr-3">Potência</th>
                        <th className="py-2 pr-3">COP</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.data.points.map((p, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-3 font-mono">{p.evap_temp_c}°C</td>
                          <td className="py-1.5 pr-3 font-mono">{p.cond_temp_c}°C</td>
                          <td className="py-1.5 pr-3 font-mono">{formatCapacity(p.capacity_w)}</td>
                          <td className="py-1.5 pr-3 font-mono">{formatCapacity(p.compressor_power_w)}</td>
                          <td className="py-1.5 pr-3 font-mono">{formatCOP(p.cop)}</td>
                          <td className="py-1.5">
                            <StatusBadge status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {result && !result.success && !isCalculating && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h4 className="text-sm font-semibold text-red-900">Erro no cálculo</h4>
              <p className="mt-1 text-xs text-red-700">{result.error}</p>
            </div>
          )}

          {!result && !isCalculating && (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">
                Configure o sistema e a grade, depois clique em "Gerar Curva".
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "slate" | "emerald" | "amber" | "red";
}) {
  const colors = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  } as const;
  return (
    <div className="rounded-md bg-slate-50 p-3 text-center">
      <div className={`text-2xl font-semibold ${colors[tone]}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
