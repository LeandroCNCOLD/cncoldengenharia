import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, ChevronDown, ChevronUp, Database, X } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { CompressorForm } from "../components/forms/CompressorForm";
import { CondenserForm } from "../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../components/forms/SystemConditionsForm";
import {
  EvaporatorForm,
  buildEvaporatorInputFromForm,
  type EvaporatorFormValue,
} from "../components/forms/EvaporatorForm";
import { UtilizationChart } from "../components/charts/UtilizationChart";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ModeGate } from "../components/mode/ModeGate";
import { WarningBanner } from "../components/ui/WarningBanner";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useEquilibrium } from "../hooks/useEquilibrium";
import { formatCapacity, formatCOP, formatPercent } from "../utils/formatting";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { buildMotorComponentsFromCatalog } from "@/modules/coldpro_catalog/adapters/sessionToMotorInputAdapter";
import { useCatalogRevisionStore } from "@/modules/coldpro_catalog/store/useCatalogRevisionStore";

function isComplete(
  c: Partial<CompressorSpec>,
  cd: Partial<CondenserSpec>,
  s: Partial<SystemConditions>,
): boolean {
  return Boolean(
    c.cooling_capacity_w &&
      c.power_w &&
      c.evap_temp_c !== undefined &&
      c.cond_temp_c !== undefined &&
      c.refrigerant &&
      cd.heat_rejection_capacity_w &&
      cd.max_cond_temp_c !== undefined &&
      s.ambient_temp_c !== undefined &&
      s.required_airflow_m3_h,
  );
}

export function SimulationPage() {
  const { result, isCalculating, calculate } = useEquilibrium();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [evaporator, setEvaporator] = useState<EvaporatorFormValue>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Pré-preenche os formulários com dados do catálogo quando a seleção muda.
  // Aplica apenas no momento em que o ID selecionado muda — não sobrescreve
  // edições manuais posteriores. Catálogo só tem prioridade no instante da seleção.
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
      // Aplica o pré-preenchimento parcial sempre que existir — mesmo quando
      // o compressor não está 100% completo, os campos disponíveis no catálogo
      // (T_evap, T_cond, potência, refrigerante, etc.) já são populados.
      const compressorPatch = motor.compressor ?? motor.compressor_partial;
      if (compressorPatch) {
        setCompressor((prev) => ({ ...prev, ...compressorPatch }));
      }
    }
    if (!selectedCompressor) {
      lastAppliedCompressorId.current = undefined;
    }

    if (selectedCondenser && selectedCondenser.id !== lastAppliedCondenserId.current) {
      lastAppliedCondenserId.current = selectedCondenser.id;
      if (motor.condenser) {
        setCondenser((prev) => ({ ...prev, ...motor.condenser }));
      }
      if (motor.compressor && !selectedCompressor) {
        setCompressor((prev) => ({ ...prev, cond_temp_c: motor.compressor!.cond_temp_c }));
      }
    }
    if (!selectedCondenser) {
      lastAppliedCondenserId.current = undefined;
    }

    if (selectedEvaporator && selectedEvaporator.id !== lastAppliedEvaporatorId.current) {
      lastAppliedEvaporatorId.current = selectedEvaporator.id;
      // T_evap do evaporador também ajuda a calibrar o compressor
      if (selectedEvaporator.tempEvaporacaoC !== undefined && !selectedCompressor) {
        setCompressor((prev) => ({
          ...prev,
          evap_temp_c: selectedEvaporator.tempEvaporacaoC,
        }));
      }
      // Pré-preenche o form do Evaporador com TODOS os campos disponíveis
      // do catálogo. Campos faltantes ficam vazios para o usuário preencher.
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
          ev.evaporadorRows !== undefined && ev.evaporadorTubesPorRow !== undefined
            ? ev.evaporadorRows
            : prev.rows_total,
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
    if (!selectedEvaporator) {
      lastAppliedEvaporatorId.current = undefined;
    }
  }, [selectedCompressor, selectedCondenser, selectedEvaporator, selectedReheatCoil]);

  const hasCatalogSelection = !!(
    selectedCompressor ||
    selectedCondenser ||
    selectedEvaporator ||
    selectedReheatCoil
  );
  const canCalculate = isComplete(compressor, condenser, conditions);

  const addRevision = useCatalogRevisionStore((s) => s.addRevision);

  const handleCalculate = () => {
    if (!canCalculate) return;
    // Catálogo tem prioridade no input do evaporador SOMENTE se conseguiu gerar
    // ProgressiveCoilInput completo. Caso contrário, fallback no input manual.
    const evaporatorInput =
      catalogEvaporatorInput ?? {
        progressive_input: buildMinimalEvaporatorInput(compressor, conditions),
      };
    calculate({
      compressor: compressor as CompressorSpec,
      evaporator: evaporatorInput,
      condenser: condenser as CondenserSpec,
      system_conditions: {
        ambient_temp_c: conditions.ambient_temp_c!,
        required_airflow_m3_h: conditions.required_airflow_m3_h!,
      },
    });
    // Gera revisão automática para cada equipamento do catálogo usado na simulação
    const seen = new Set<string>();
    for (const eq of [
      selectedCompressor,
      selectedCondenser,
      selectedEvaporator,
      selectedReheatCoil,
    ]) {
      if (eq && !seen.has(eq.id)) {
        seen.add(eq.id);
        addRevision(eq, "simulation", "Snapshot gerado durante simulação de equilíbrio");
      }
    }
  };

  return (
    <PageContainer
      title="Equilíbrio do Sistema"
      subtitle="Calcula o ponto de equilíbrio térmico do sistema completo"
      actions={
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate || isCalculating}
          className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Play className="h-4 w-4" />
          {isCalculating ? "Calculando..." : "Calcular Equilíbrio"}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {hasCatalogSelection ? (
            <div className="rounded-lg border border-[#1E6FD9]/30 bg-[#1E6FD9]/5 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#1E6FD9]">
                  <Database className="h-3.5 w-3.5" />
                  Dados pré-carregados do catálogo CN COLD
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
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
                Os campos abaixo continuam editáveis.
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
          <SystemConditionsForm value={conditions} onChange={setConditions} />
          <ModeGate minMode="professional">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Configuração Avançada do Evaporador
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showAdvanced && (
                <div className="border-t border-slate-100 p-5 text-xs text-slate-600">
                  Configuração detalhada da serpentina progressiva disponível em prompts futuros. Os
                  parâmetros básicos são preenchidos automaticamente com valores típicos.
                </div>
              )}
            </section>
          </ModeGate>
        </div>

        <div className="space-y-4">
          {isCalculating && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <LoadingSpinner label="Calculando equilíbrio..." />
            </div>
          )}

          {result && !isCalculating && result.success && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Balanço Térmico</h3>
                  <StatusBadge status={result.data.status} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Capacidade Real" value={formatCapacity(result.data.thermal_balance.q_evap_w)} />
                  <Metric
                    label="COP"
                    value={formatCOP(
                      result.data.thermal_balance.q_evap_w /
                        Math.max(result.data.thermal_balance.compressor_power_w, 1e-9),
                    )}
                  />
                  <Metric
                    label="Potência Compressor"
                    value={formatCapacity(result.data.thermal_balance.compressor_power_w)}
                  />
                  <Metric
                    label="Erro de Balanço"
                    value={formatPercent(result.data.thermal_balance.balance_error_pct)}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Utilização dos Componentes</h3>
                <UtilizationChart utilization={result.data.utilization} />
              </section>

              {result.data.warnings.length > 0 && <WarningBanner warnings={result.data.warnings} />}

              <ModeGate minMode="intermediate">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Detalhes do Balanço</h3>
                  <div className="space-y-2 text-sm">
                    <Row
                      label="q_cond_required"
                      value={formatCapacity(result.data.thermal_balance.q_cond_required_w)}
                    />
                    <Row
                      label="q_cond_available"
                      value={formatCapacity(result.data.thermal_balance.q_cond_available_w)}
                    />
                  </div>
                  {result.data.bottlenecks.length > 0 && (
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs">
                      <div className="mb-1 font-semibold text-slate-700">Gargalos identificados</div>
                      <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
                        {result.data.bottlenecks.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
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
                Preencha os parâmetros e clique em "Calcular Equilíbrio".
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono text-slate-900">{value}</span>
    </div>
  );
}
