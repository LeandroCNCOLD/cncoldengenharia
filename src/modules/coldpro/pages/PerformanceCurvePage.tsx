import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, BarChart2, Database, X } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { CompressorForm } from "../components/forms/CompressorForm";
import { CondenserForm } from "../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../components/forms/SystemConditionsForm";
import { OperatingGridForm, generateGrid, type GridConfig } from "../components/forms/OperatingGridForm";
import {
  EvaporatorForm,
  buildEvaporatorInputFromForm,
  type EvaporatorFormValue,
} from "../components/forms/EvaporatorForm";
import { PerformanceCurveChart, type PerformanceMetric } from "../components/charts/PerformanceCurveChart";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WarningBanner } from "../components/ui/WarningBanner";
import { usePerformanceCurve } from "../hooks/usePerformanceCurve";
import { formatCapacity, formatCOP } from "../utils/formatting";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { buildMotorComponentsFromCatalog } from "@/modules/coldpro_catalog/adapters/sessionToMotorInputAdapter";

const METRIC_OPTIONS: { value: PerformanceMetric; label: string }[] = [
  { value: "capacity_w", label: "Capacidade" },
  { value: "cop", label: "COP" },
  { value: "compressor_power_w", label: "Potência" },
];

export function PerformanceCurvePage() {
  const { result, isCalculating, calculate } = usePerformanceCurve();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [evaporator, setEvaporator] = useState<EvaporatorFormValue>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    evap_temps: [-15, -10, -5, 0],
    cond_temps: [30, 35, 40, 45],
  });
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric>("capacity_w");

  const {
    selectedCompressor,
    selectedCondenser,
    selectedEvaporator,
    selectedReheatCoil,
    clearSelection,
  } = useCatalogSessionStore();
  const lastAppliedCompressorId = useRef<string | undefined>(undefined);
  const lastAppliedCondenserId = useRef<string | undefined>(undefined);
  const lastAppliedEvaporatorId = useRef<string | undefined>(undefined);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [catalogEvaporatorInput, setCatalogEvaporatorInput] = useState<
    ReturnType<typeof buildMotorComponentsFromCatalog>["evaporator"] | undefined
  >(undefined);

  // Mesmo fluxo de pré-preenchimento usado em SimulationPage. Cada bloco do
  // catálogo é aplicado uma única vez (no instante em que o ID muda) — não
  // sobrescreve edições manuais subsequentes.
  useEffect(() => {
    const motor = buildMotorComponentsFromCatalog({
      compressor: selectedCompressor,
      condenser: selectedCondenser,
      evaporator: selectedEvaporator,
      reheat_coil: selectedReheatCoil,
    });

    setCatalogWarnings(motor.warnings);
    setCatalogEvaporatorInput(motor.evaporator);

    if (selectedCompressor && selectedCompressor.id !== lastAppliedCompressorId.current) {
      lastAppliedCompressorId.current = selectedCompressor.id;
      const compressorPatch = motor.compressor ?? motor.compressor_partial;
      if (compressorPatch) {
        setCompressor((prev) => ({ ...prev, ...compressorPatch }));
      }
      // Sugere uma grade ao redor das condições nominais do catálogo
      const evapNom = selectedCompressor.tempEvaporacaoC;
      const condNom = selectedCompressor.tempCondensacaoC;
      if (evapNom !== undefined || condNom !== undefined) {
        setGridConfig((prev) => ({
          evap_temps:
            evapNom !== undefined
              ? [evapNom - 10, evapNom - 5, evapNom, evapNom + 5].map((t) => Math.round(t))
              : prev.evap_temps,
          cond_temps:
            condNom !== undefined
              ? [condNom - 10, condNom - 5, condNom, condNom + 5].map((t) => Math.round(t))
              : prev.cond_temps,
        }));
      }
    }
    if (!selectedCompressor) lastAppliedCompressorId.current = undefined;

    if (selectedCondenser && selectedCondenser.id !== lastAppliedCondenserId.current) {
      lastAppliedCondenserId.current = selectedCondenser.id;
      if (motor.condenser) {
        setCondenser((prev) => ({ ...prev, ...motor.condenser }));
      }
    }
    if (!selectedCondenser) lastAppliedCondenserId.current = undefined;

    if (selectedEvaporator && selectedEvaporator.id !== lastAppliedEvaporatorId.current) {
      lastAppliedEvaporatorId.current = selectedEvaporator.id;
      const ev = selectedEvaporator;
      setEvaporator((prev) => ({
        ...prev,
        T_evaporating_c: ev.tempEvaporacaoC ?? prev.T_evaporating_c,
        airflow_m3_h: ev.vazaoArEvaporadorM3H ?? prev.airflow_m3_h,
        air_temperature_in_c: ev.evaporadorAirTemperatureInC ?? prev.air_temperature_in_c,
        air_relative_humidity_in:
          ev.evaporadorAirRelativeHumidityIn ?? prev.air_relative_humidity_in,
        tube_outer_diameter_mm: ev.evaporadorTuboDiametroMm ?? prev.tube_outer_diameter_mm,
        tube_inner_diameter_mm: ev.evaporadorTubeInnerDiameterMm ?? prev.tube_inner_diameter_mm,
        tube_pitch_transverse_mm:
          ev.evaporadorTubePitchTransverseMm ?? prev.tube_pitch_transverse_mm,
        tube_pitch_longitudinal_mm:
          ev.evaporadorTubePitchLongitudinalMm ?? prev.tube_pitch_longitudinal_mm,
        fin_spacing_mm: ev.evaporadorFinSpacingMm ?? prev.fin_spacing_mm,
        rows_total:
          ev.evaporadorRows !== undefined ? ev.evaporadorRows : prev.rows_total,
        fin_thickness_mm: ev.evaporadorFinThicknessMm ?? prev.fin_thickness_mm,
        fin_height_mm: ev.evaporadorFinHeightMm ?? prev.fin_height_mm,
        coil_width_m: ev.evaporadorCoilWidthM ?? prev.coil_width_m,
        coil_height_m: ev.evaporadorCoilHeightM ?? prev.coil_height_m,
        tube_material:
          (ev.evaporadorTubeMaterial as EvaporatorFormValue["tube_material"]) ??
          prev.tube_material,
        fin_material:
          (ev.evaporadorFinMaterial as EvaporatorFormValue["fin_material"]) ??
          prev.fin_material,
      }));
    }
    if (!selectedEvaporator) lastAppliedEvaporatorId.current = undefined;
  }, [selectedCompressor, selectedCondenser, selectedEvaporator, selectedReheatCoil]);

  const hasCatalogSelection = !!(
    selectedCompressor || selectedCondenser || selectedEvaporator || selectedReheatCoil
  );

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
    const evaporatorInput =
      catalogEvaporatorInput ?? {
        progressive_input: buildEvaporatorInputFromForm(evaporator, compressor, conditions),
      };
    calculate({
      system: {
        compressor: compressor as CompressorSpec,
        evaporator: evaporatorInput,
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
