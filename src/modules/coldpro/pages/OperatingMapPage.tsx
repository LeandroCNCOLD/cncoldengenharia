import { useState, useMemo } from "react";
import { Play } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { CompressorForm } from "../components/forms/CompressorForm";
import { CondenserForm } from "../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../components/forms/SystemConditionsForm";
import { OperatingGridForm, type GridConfig } from "../components/forms/OperatingGridForm";
import { buildMinimalEvaporatorInput } from "../components/forms/EvaporatorForm";
import { OperatingMapChart } from "../components/charts/OperatingMapChart";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ModeGate } from "../components/mode/ModeGate";
import { WarningBanner } from "../components/ui/WarningBanner";
import { useOperatingMap } from "../hooks/useOperatingMap";
import { formatCapacity, formatCOP, formatTemp } from "../utils/formatting";
import type { CompressorSpec, CondenserSpec, OperatingEnvelope } from "@/modules/coldpro_v2";

interface EnvelopeBounds {
  min_evap_temp_c: number | null;
  max_evap_temp_c: number | null;
  min_cond_temp_c: number | null;
  max_cond_temp_c: number | null;
}

function computeEnvelopeBounds(envelope: OperatingEnvelope): EnvelopeBounds {
  const pts = envelope.feasible_points;
  if (pts.length === 0) {
    return {
      min_evap_temp_c: null,
      max_evap_temp_c: null,
      min_cond_temp_c: null,
      max_cond_temp_c: null,
    };
  }
  let minE = pts[0].evap_temp_c;
  let maxE = pts[0].evap_temp_c;
  let minC = pts[0].cond_temp_c;
  let maxC = pts[0].cond_temp_c;
  for (const p of pts) {
    if (p.evap_temp_c < minE) minE = p.evap_temp_c;
    if (p.evap_temp_c > maxE) maxE = p.evap_temp_c;
    if (p.cond_temp_c < minC) minC = p.cond_temp_c;
    if (p.cond_temp_c > maxC) maxC = p.cond_temp_c;
  }
  return { min_evap_temp_c: minE, max_evap_temp_c: maxE, min_cond_temp_c: minC, max_cond_temp_c: maxC };
}

export function OperatingMapPage() {
  const { result, isCalculating, calculate } = useOperatingMap();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    evap_temps: [-20, -15, -10, -5, 0, 5],
    cond_temps: [25, 30, 35, 40, 45, 50, 55],
  });

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
      grid: {
        evap_temps_c: gridConfig.evap_temps,
        cond_temps_c: gridConfig.cond_temps,
      },
    });
  };

  const envelopeBounds = useMemo<EnvelopeBounds | null>(() => {
    if (!result?.success) return null;
    return computeEnvelopeBounds(result.data.envelope);
  }, [result]);

  const feasibleCount =
    result?.success
      ? result.data.stats.approved_points + result.data.stats.warning_points
      : 0;

  return (
    <PageContainer
      title="Mapa Operacional"
      subtitle="Mapeia o envelope operacional do sistema"
      actions={
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate || isCalculating}
          className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Play className="h-4 w-4" />
          {isCalculating ? "Calculando..." : "Gerar Mapa"}
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
              <LoadingSpinner label="Gerando mapa..." />
            </div>
          )}

          {result?.success && !isCalculating && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 grid grid-cols-4 gap-3">
                  <Stat value={String(result.data.stats.total_points)} label="Pontos Total" />
                  <Stat value={String(feasibleCount)} label="Viáveis" tone="emerald" />
                  <Stat
                    value={formatCapacity(result.data.stats.max_capacity_w)}
                    label="Cap. Máx."
                  />
                  <Stat value={formatCOP(result.data.stats.max_cop)} label="COP Máx." />
                </div>
                <OperatingMapChart points={result.data.map_points} />
              </section>

              {result.data.capacity_isolines.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Isolinhas de Capacidade</h3>
                  <div className="space-y-2">
                    {result.data.capacity_isolines.map((iso, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs"
                      >
                        <span className="font-mono font-semibold text-slate-900">
                          {formatCapacity(iso.value)}
                        </span>
                        <span className="text-slate-500">{iso.points.length} pontos</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.data.warnings.length > 0 && <WarningBanner warnings={result.data.warnings} />}

              <ModeGate minMode="intermediate">
                {envelopeBounds && envelopeBounds.min_evap_temp_c !== null && (
                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Envelope Operacional</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Row label="T_evap mín." value={formatTemp(envelopeBounds.min_evap_temp_c!)} />
                      <Row label="T_evap máx." value={formatTemp(envelopeBounds.max_evap_temp_c!)} />
                      <Row label="T_cond mín." value={formatTemp(envelopeBounds.min_cond_temp_c!)} />
                      <Row label="T_cond máx." value={formatTemp(envelopeBounds.max_cond_temp_c!)} />
                    </div>
                  </section>
                )}
              </ModeGate>
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
                Configure o sistema e clique em "Gerar Mapa".
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
  tone = "slate",
}: {
  value: string;
  label: string;
  tone?: "slate" | "emerald";
}) {
  const color = tone === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-md bg-slate-50 p-3 text-center">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono text-slate-900">{value}</span>
    </div>
  );
}
