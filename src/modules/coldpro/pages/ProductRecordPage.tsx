import { useState } from "react";
import { Play, FileText } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { CompressorForm } from "../components/forms/CompressorForm";
import { CondenserForm } from "../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../components/forms/SystemConditionsForm";
import { OperatingGridForm, generateGrid, type GridConfig } from "../components/forms/OperatingGridForm";
import { buildMinimalEvaporatorInput } from "../components/forms/EvaporatorForm";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WarningBanner } from "../components/ui/WarningBanner";
import { TechnicalField } from "../components/ui/TechnicalField";
import { validateRequired } from "../utils/validation";
import { useProductRecord } from "../hooks/useProductRecord";
import { formatCapacity, formatCOP, formatTemp } from "../utils/formatting";
import type {
  CompressorSpec,
  CondenserSpec,
  ProductIdentity,
} from "@/modules/coldpro_v2";

export function ProductRecordPage() {
  const { result, isCalculating, calculate } = useProductRecord();
  const [identity, setIdentity] = useState<Partial<ProductIdentity>>({
    refrigerant: "R404A",
  });
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    evap_temps: [-15, -10, -5, 0],
    cond_temps: [30, 35, 40, 45],
  });

  const canCalculate = Boolean(
    identity.id &&
      identity.model &&
      identity.family &&
      identity.line &&
      identity.refrigerant &&
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
      identity: identity as ProductIdentity,
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

  const setIdField = (field: keyof ProductIdentity, raw: string) => {
    setIdentity({ ...identity, [field]: raw });
  };

  return (
    <PageContainer
      title="Ficha Técnica do Produto"
      subtitle="Constrói o registro técnico completo (equilíbrio + curva + polinômios)"
      actions={
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate || isCalculating}
          className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Play className="h-4 w-4" />
          {isCalculating ? "Construindo..." : "Gerar Ficha"}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Identidade do Produto</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TechnicalField
                label="ID"
                value={identity.id}
                onChange={(v) => setIdField("id", v)}
                required
                placeholder="Ex: CN-001"
                validation={validateRequired(identity.id)}
              />
              <TechnicalField
                label="Modelo"
                value={identity.model}
                onChange={(v) => setIdField("model", v)}
                required
                placeholder="Ex: UCM-5000"
                validation={validateRequired(identity.model)}
              />
              <TechnicalField
                label="Família"
                value={identity.family}
                onChange={(v) => setIdField("family", v)}
                required
                placeholder="Ex: UCM"
                validation={validateRequired(identity.family)}
              />
              <TechnicalField
                label="Linha"
                value={identity.line}
                onChange={(v) => setIdField("line", v)}
                required
                placeholder="Ex: Comercial"
                validation={validateRequired(identity.line)}
              />
              <TechnicalField
                label="Refrigerante"
                value={identity.refrigerant}
                onChange={(v) => setIdField("refrigerant", v)}
                required
                placeholder="R404A"
                validation={validateRequired(identity.refrigerant)}
              />
              <TechnicalField
                label="Aplicação"
                value={identity.application}
                onChange={(v) => setIdField("application", v)}
                placeholder="Ex: Câmara fria"
              />
            </div>
          </section>

          <CompressorForm value={compressor} onChange={setCompressor} />
          <CondenserForm value={condenser} onChange={setCondenser} />
          <SystemConditionsForm value={conditions} onChange={setConditions} />
          <OperatingGridForm value={gridConfig} onChange={setGridConfig} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          {isCalculating && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <LoadingSpinner label="Construindo ficha..." />
            </div>
          )}

          {result?.success && !isCalculating && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#1E6FD9]" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {result.data.identity.model}
                    </h3>
                  </div>
                  <StatusBadge status={result.data.validation.final_status} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <KV label="ID" value={result.data.identity.id} />
                  <KV label="Família" value={result.data.identity.family} />
                  <KV label="Linha" value={result.data.identity.line} />
                  <KV label="Refrigerante" value={result.data.identity.refrigerant} />
                  <KV
                    label="Engine"
                    value={result.data.traceability.engine_version}
                  />
                  <KV label="Origem" value={result.data.traceability.source} />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Validação</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <ValidationRow label="Equilíbrio" status={result.data.validation.equilibrium_status} />
                  <ValidationRow label="Curva" status={result.data.validation.curve_status} />
                  <ValidationRow
                    label="Polinômios"
                    status={result.data.validation.polynomial_status}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Limites Operacionais</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <KV
                    label="T_evap"
                    value={`${formatTemp(result.data.operating_limits.min_evap_temp_c)} → ${formatTemp(result.data.operating_limits.max_evap_temp_c)}`}
                  />
                  <KV
                    label="T_cond"
                    value={`${formatTemp(result.data.operating_limits.min_cond_temp_c)} → ${formatTemp(result.data.operating_limits.max_cond_temp_c)}`}
                  />
                  <KV
                    label="Capacidade"
                    value={`${formatCapacity(result.data.operating_limits.min_capacity_w)} → ${formatCapacity(result.data.operating_limits.max_capacity_w)}`}
                  />
                  <KV
                    label="COP"
                    value={`${formatCOP(result.data.operating_limits.min_cop)} → ${formatCOP(result.data.operating_limits.max_cop)}`}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Polinômios Gerados</h3>
                {result.data.polynomial_coefficients.coefficients.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum polinômio gerado.</p>
                ) : (
                  <div className="space-y-2">
                    {result.data.polynomial_coefficients.coefficients.map((c, i) => (
                      <div key={i} className="rounded-md bg-slate-50 p-3 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{c.target}</span>
                          <span className="text-slate-500">
                            R² = {c.fit_quality.r2.toFixed(4)} • RMSE = {c.fit_quality.rmse.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {result.data.warnings.length > 0 && <WarningBanner warnings={result.data.warnings} />}
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
                Preencha identidade, sistema e grade, depois clique em "Gerar Ficha".
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-slate-900">{value}</div>
    </div>
  );
}

function ValidationRow({
  label,
  status,
}: {
  label: string;
  status: "approved" | "warning" | "rejected" | "ok" | "error";
}) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md bg-slate-50 p-2.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <StatusBadge status={status} />
    </div>
  );
}
