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

  // Reseta TODOS os formulários ao estado inicial.
  const resetAllForms = () => {
    setCompressor({ refrigerant: "R404A" });
    setCondenser({});
    setEvaporator({});
    setConditions({});
    setGridConfig({
      evap_temps: [-15, -10, -5, 0],
      cond_temps: [30, 35, 40, 45],
    });
    setCatalogWarnings([]);
    setCatalogEvaporatorInput(undefined);
  };

  // Mesmo fluxo de pré-preenchimento usado em SimulationPage. Ao detectar
  // troca de equipamento, zera primeiro os formulários para evitar mistura
  // de dados do equipamento anterior. Em seguida aplica os valores do
  // novo catálogo (substituição, não merge).
  useEffect(() => {
    const motor = buildMotorComponentsFromCatalog({
      compressor: selectedCompressor,
      condenser: selectedCondenser,
      evaporator: selectedEvaporator,
      reheat_coil: selectedReheatCoil,
    });

    setCatalogWarnings(motor.warnings);
    setCatalogEvaporatorInput(motor.evaporator);

    const compressorChanged =
      (selectedCompressor?.id ?? undefined) !== lastAppliedCompressorId.current;
    const condenserChanged =
      (selectedCondenser?.id ?? undefined) !== lastAppliedCondenserId.current;
    const evaporatorChanged =
      (selectedEvaporator?.id ?? undefined) !== lastAppliedEvaporatorId.current;

    if (compressorChanged || condenserChanged || evaporatorChanged) {
      setCompressor({ refrigerant: "R404A" });
      setCondenser({});
      setEvaporator({});
      // Conditions e gridConfig são preservados (gridConfig será resugerido abaixo).
    }

    if (selectedCompressor && compressorChanged) {
      lastAppliedCompressorId.current = selectedCompressor.id;
      const compressorPatch = motor.compressor ?? motor.compressor_partial;
      if (compressorPatch) {
        setCompressor((prev) => ({ ...prev, ...compressorPatch }));
      }
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

    if (selectedCondenser && condenserChanged) {
      lastAppliedCondenserId.current = selectedCondenser.id;
      if (motor.condenser) {
        setCondenser((prev) => ({ ...prev, ...motor.condenser }));
      }
    }
    if (!selectedCondenser) lastAppliedCondenserId.current = undefined;

    if (selectedEvaporator && evaporatorChanged) {
      lastAppliedEvaporatorId.current = selectedEvaporator.id;
      const ev = selectedEvaporator;
      // Substituição completa — campos ausentes ficam undefined.
      setEvaporator({
        T_evaporating_c: ev.tempEvaporacaoC,
        airflow_m3_h: ev.vazaoArEvaporadorM3H,
        air_temperature_in_c: ev.evaporadorAirTemperatureInC,
        air_relative_humidity_in: ev.evaporadorAirRelativeHumidityIn,
        tube_outer_diameter_mm: ev.evaporadorTuboDiametroMm,
        tube_inner_diameter_mm: ev.evaporadorTubeInnerDiameterMm,
        tube_pitch_transverse_mm: ev.evaporadorTubePitchTransverseMm,
        tube_pitch_longitudinal_mm: ev.evaporadorTubePitchLongitudinalMm,
        fin_spacing_mm: ev.evaporadorFinSpacingMm,
        rows_total: ev.evaporadorRows,
        fin_thickness_mm: ev.evaporadorFinThicknessMm,
        fin_height_mm: ev.evaporadorFinHeightMm,
        coil_width_m: ev.evaporadorCoilWidthM,
        coil_height_m: ev.evaporadorCoilHeightM,
        tube_material: ev.evaporadorTubeMaterial as EvaporatorFormValue["tube_material"],
        fin_material: ev.evaporadorFinMaterial as EvaporatorFormValue["fin_material"],
      });
    }
    if (!selectedEvaporator) lastAppliedEvaporatorId.current = undefined;
  }, [selectedCompressor, selectedCondenser, selectedEvaporator, selectedReheatCoil]);

  // NOTA: a seleção do catálogo persiste entre navegações para permitir
  // alternar entre Equilíbrio e Curva sem perder os dados. Limpeza só via
  // botão "Limpar" ou ao salvar/excluir cálculo.

  const handleClearAll = () => {
    clearSelection();
    lastAppliedCompressorId.current = undefined;
    lastAppliedCondenserId.current = undefined;
    lastAppliedEvaporatorId.current = undefined;
    resetAllForms();
  };

  const hasCatalogSelection = !!(
    selectedCompressor || selectedCondenser || selectedEvaporator || selectedReheatCoil
  );

  const missingFields: string[] = [];
  if (!compressor.cooling_capacity_w) missingFields.push("Compressor: capacidade de refrigeração");
  if (!compressor.power_w) missingFields.push("Compressor: potência");
  if (compressor.evap_temp_c === undefined) missingFields.push("Compressor: T evap nominal");
  if (compressor.cond_temp_c === undefined) missingFields.push("Compressor: T cond nominal");
  if (!compressor.refrigerant) missingFields.push("Compressor: refrigerante");
  if (!condenser.heat_rejection_capacity_w) missingFields.push("Condensador: capacidade de rejeição");
  if (condenser.max_cond_temp_c === undefined) missingFields.push("Condensador: T cond máxima");
  if (conditions.ambient_temp_c === undefined) missingFields.push("Condições: T ambiente");
  if (!conditions.required_airflow_m3_h) missingFields.push("Condições: vazão de ar requerida");
  if (gridConfig.evap_temps.length === 0) missingFields.push("Grade: temperaturas de evaporação");
  if (gridConfig.cond_temps.length === 0) missingFields.push("Grade: temperaturas de condensação");
  const canCalculate = missingFields.length === 0;

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
          title={
            !canCalculate
              ? `Preencha para habilitar:\n• ${missingFields.join("\n• ")}`
              : "Gerar curva de desempenho"
          }
          className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white/90"
        >
          <Play className="h-4 w-4" />
          {isCalculating ? "Calculando..." : "Gerar Curva"}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {hasCatalogSelection ? (
            <div className="rounded-lg border border-[#1E6FD9]/30 bg-[#1E6FD9]/5 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#1E6FD9]">
                  <Database className="h-3.5 w-3.5" />
                  Dados pré-carregados do catálogo CN COLD
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              </div>
              <p className="text-slate-600">
                {selectedCompressor && (
                  <>Compressor: <strong>{selectedCompressor.modeloBaseReferencia ?? selectedCompressor.modelo}</strong>. </>
                )}
                {selectedCondenser && selectedCondenser.id !== selectedCompressor?.id && (
                  <>Condensador: <strong>{selectedCondenser.modeloBaseReferencia ?? selectedCondenser.modelo}</strong>. </>
                )}
                {selectedEvaporator && (
                  <>Evaporador: <strong>{selectedEvaporator.modeloBaseReferencia ?? selectedEvaporator.modelo}</strong>. </>
                )}
                {selectedReheatCoil && (
                  <>Reaquecimento: <strong>{selectedReheatCoil.modeloBaseReferencia ?? selectedReheatCoil.modelo}</strong>. </>
                )}
                Os campos abaixo continuam editáveis. A grade foi sugerida ao redor das condições nominais.
              </p>
              {catalogWarnings.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[11px] text-amber-700">
                  {catalogWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Dica: você pode pré-carregar os componentes a partir do{" "}
              <Link to="/coldpro/catalog" className="font-medium text-[#1E6FD9] hover:underline">
                Catálogo CN COLD
              </Link>{" "}
              ou preencher manualmente.
            </div>
          )}
          <CompressorForm value={compressor} onChange={setCompressor} />
          <CondenserForm value={condenser} onChange={setCondenser} />
          <EvaporatorForm value={evaporator} onChange={setEvaporator} />
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
