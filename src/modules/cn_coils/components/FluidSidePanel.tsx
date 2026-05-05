import { useEffect, useState } from "react";
import { Lock, Unlock, Zap, Search } from "lucide-react";
import { useNumericInput } from "../hooks/useNumericInput";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { CompressorPickerModal } from "./CompressorPickerModal";
import { RefrigerantPickerModal } from "./RefrigerantPickerModal";
import type {
  CnCoilsComponentType,
  CnCoilsSimulationResult,
} from "../types/cncoils.types";
import { getApplicationConfig } from "../config/applicationConfig";
import {
  loadRefrigerants,
  type RefrigerantOption,
} from "../services/refrigerantCatalogService";
import { UnitSelect } from "./UnitSelect";
import {
  DELTA_T_UNITS,
  MASS_FLOW_UNITS,
  PRESSURE_UNITS,
  TEMP_UNITS,
  VELOCITY_UNITS,
  deltaTConv,
  fmtBR,
  massFlowConv,
  pressureConv,
  tempConv,
  velocityConv,
  type DeltaTUnit,
  type MassFlowUnit,
  type PressureUnit,
  type TempUnit,
  type VelocityUnit,
} from "../utils/unitConversions";

/** Badge de origem do valor */
function BadgeCell({
  type,
}: {
  type: "auto" | "manual" | "catalog" | "calculated" | "pending";
}) {
  const styles = {
    auto: "bg-slate-100 text-slate-500 border-slate-200",
    manual: "bg-amber-50 text-amber-700 border-amber-200",
    catalog: "bg-blue-50 text-blue-700 border-blue-200",
    calculated: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-slate-50 text-slate-400 border-slate-200",
  };
  const labels = {
    auto: "Auto",
    manual: "Manual",
    catalog: "Catálogo",
    calculated: "Calculado",
    pending: "Pendente",
  };
  return (
    <span
      className={`inline-block rounded border px-1 py-0.5 text-[8px] font-semibold leading-none ${styles[type]}`}
    >
      {labels[type]}
    </span>
  );
}

interface FluidSidePanelProps {
  componentType: CnCoilsComponentType;
  refrigerants?: unknown;
  disabled?: boolean;
  result?: CnCoilsSimulationResult;
}

/**
 * FluidSidePanel — Etapa 4 (LADO FLUIDO).
 *
 * Ordem exata da spec CN Coils:
 *  1) Fluido (dropdown)
 *  2) Vazão (input + cadeado funcional)
 *  3) Temp. Condensação/Evaporação (label dinâmico)
 *  4) Sobreaquecimento (apenas evaporadores)
 *  5) Subresfriamento (apenas condensadores)
 *  6) Queda de Pressão (resultado)
 *  7) Fator de Segurança (input)
 *  8) Velocidade do Fluido (resultado)
 *
 * Cadeado funcional:
 *  - 🔒 (locked): vazão é incógnita (motor resolve via balanço de energia)
 *  - 🔓 (unlocked): vazão fixa pelo usuário; motor resolve T_saída
 */
export function FluidSidePanel({
  componentType,
  disabled,
  result,
}: FluidSidePanelProps) {
  const cfg = getApplicationConfig(componentType);
  const isCondenser =
    cfg.type === "condenser_air" || cfg.type === "condenser_shell_tube";
  const isEvaporator =
    cfg.type === "evaporator_dx" || cfg.type === "evaporator_pumped";

  const fluid = useCnCoilsSimulationStore((s) => s.fluid);
  const fluidMassFlow_kg_h = useCnCoilsSimulationStore((s) => s.fluidMassFlow_kg_h);
  const isMassFlowLocked = useCnCoilsSimulationStore((s) => s.isMassFlowLocked);
  const fluidOperatingTemp_C = useCnCoilsSimulationStore(
    (s) => s.fluidOperatingTemp_C,
  );
  const superheat_K = useCnCoilsSimulationStore((s) => s.superheat_K);
  const subcooling_K = useCnCoilsSimulationStore((s) => s.subcooling_K);
  const foulingFactorFluid = useCnCoilsSimulationStore((s) => s.foulingFactorFluid);
  const pairedTempC = useCnCoilsSimulationStore((s) => s.pairedTempC);
  const dischargeSuperheatK = useCnCoilsSimulationStore((s) => s.dischargeSuperheatK);
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);
  const setFluid = useCnCoilsSimulationStore((s) => s.setFluid);
  const setFluidMassFlow = useCnCoilsSimulationStore((s) => s.setFluidMassFlow);
  const toggleMassFlowLock = useCnCoilsSimulationStore((s) => s.toggleMassFlowLock);
  const setFluidOperatingTemp = useCnCoilsSimulationStore(
    (s) => s.setFluidOperatingTemp,
  );
  const setSuperheat = useCnCoilsSimulationStore((s) => s.setSuperheat);
  const setSubcooling = useCnCoilsSimulationStore((s) => s.setSubcooling);
  const setFoulingFactorFluid = useCnCoilsSimulationStore(
    (s) => s.setFoulingFactorFluid,
  );
  const errorFactorPercent = useCnCoilsSimulationStore((s) => s.errorFactorPercent);
  const setErrorFactorPercent = useCnCoilsSimulationStore(
    (s) => s.setErrorFactorPercent,
  );
  const setPairedTempC = useCnCoilsSimulationStore((s) => s.setPairedTempC);
  const setDischargeSuperheatK = useCnCoilsSimulationStore((s) => s.setDischargeSuperheatK);
  const setSelectedCompressor = useCnCoilsSimulationStore((s) => s.setSelectedCompressor);

  const [refrigerants, setRefrigerants] = useState<RefrigerantOption[]>([]);
  const [compressors, setCompressors] = useState<Array<{ id: string; label: string }>>([]);
  const [compressorModalOpen, setCompressorModalOpen] = useState(false);
  const [refrigerantModalOpen, setRefrigerantModalOpen] = useState(false);
  const compressorCount = useCnCoilsSimulationStore((s) => s.compressorCount);

  const [uMassFlow, setUMassFlow] = useState<MassFlowUnit>("kg_h");
  const [uOpTemp, setUOpTemp] = useState<TempUnit>("C");
  const [uPaired, setUPaired] = useState<TempUnit>("C");
  const [uSH, setUSH] = useState<DeltaTUnit>("K");
  const [uSC, setUSC] = useState<DeltaTUnit>("K");
  const [uDSH, setUDSH] = useState<DeltaTUnit>("K");
  const [uPdrop, setUPdrop] = useState<PressureUnit>("kPa");
  const [uVel, setUVel] = useState<VelocityUnit>("m_s");

  // Carrega lista de compressores do catálogo
  useEffect(() => {
    let cancelled = false;
    fetch("/data/catalogs/compressors.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        if (cancelled || !Array.isArray(list)) return;
        const items = list
          .map((c) => {
            const obj = c as Record<string, unknown>;
            const id = String(obj.id ?? obj.model ?? "");
            const model = String(obj.model ?? id);
            const series = obj.series ? ` · ${obj.series}` : "";
            return { id, label: `${model}${series}` };
          })
          .filter((x) => x.id);
        setCompressors(items);
      })
      .catch(() => {
        if (!cancelled) setCompressors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRefrigerants()
      .then((list) => {
        if (cancelled) return;
        // Ordena: primeiro refrigerantes comerciais (R + dígito, ex: R404A,
        // R32, R134a, R410A), depois os demais em ordem alfabética.
        const isCommercial = (r: RefrigerantOption) => {
          const s = r.shortName ?? r.name ?? r.id;
          return /^R-?\d/i.test(s);
        };
        const sorted = [...list].sort((a, b) => {
          const ca = isCommercial(a);
          const cb = isCommercial(b);
          if (ca !== cb) return ca ? -1 : 1;
          const la = a.shortName ?? a.name ?? a.id;
          const lb = b.shortName ?? b.name ?? b.id;
          return la.localeCompare(lb, undefined, { numeric: true });
        });
        setRefrigerants(sorted);
        // Só preenche o fluido padrão se o usuário ainda não tiver um
        // selecionado (evita sobrescrever uma escolha válida ao recarregar
        // a lista — bug do binding aparente).
        if (sorted.length > 0 && !fluid) {
          setFluid(sorted[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setRefrigerants([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operatingTempLabel = isCondenser
    ? "Temp. Condensação"
    : isEvaporator
      ? "Temp. Evaporação"
      : "Temp. Operação";
  const pairedTempLabel = isCondenser ? "Temp. Evaporação" : "Temp. Condensação";
  const thermalInputsDisabled = false;
  const hasCompressor = !!selectedCompressorId;
  const pairedRequired = hasCompressor;
  const pairedMissing = pairedRequired && (pairedTempC == null || !Number.isFinite(pairedTempC));
  // Quando há compressor, a temperatura "principal" e a vazão são resolvidas
  // pelo ponto de equilíbrio.
  const opTempReadOnly = hasCompressor;
  const massFlowReadOnly = hasCompressor;

  // Validações (Etapa 4)
  const errors: string[] = [];
  if (!fluid) errors.push("Selecione um fluido refrigerante.");
  if (!isMassFlowLocked && !massFlowReadOnly && !(fluidMassFlow_kg_h > 0)) {
    errors.push("Vazão deve ser maior que zero quando desbloqueada.");
  }
  if (fluidOperatingTemp_C < -50 || fluidOperatingTemp_C > 90) {
    errors.push("Temperatura de saturação fora dos limites (-50 a 90 °C).");
  }
  if (isEvaporator && superheat_K < 0) {
    errors.push("Sobreaquecimento não pode ser negativo.");
  }
  if (isCondenser && subcooling_K < 0) {
    errors.push("Subresfriamento não pode ser negativo.");
  }
  if (pairedMissing) {
    errors.push(
      `${pairedTempLabel} é obrigatória quando há compressor selecionado.`,
    );
  }
  const fluidSafetyFactor = 1 + (Number.isFinite(errorFactorPercent) ? errorFactorPercent : 0) / 100;
  const resultMassFlowKgH =
    result?.fluidMassFlowKgS !== undefined ? result.fluidMassFlowKgS * 3600 : undefined;
  const displayedMassFlowKgH =
    resultMassFlowKgH !== undefined && resultMassFlowKgH > 0
      ? resultMassFlowKgH * fluidSafetyFactor
      : fluidMassFlow_kg_h * fluidSafetyFactor;
  const displayedFluidDpKpa =
    result?.fluidPressureDropKpa !== undefined
      ? result.fluidPressureDropKpa * fluidSafetyFactor
      : undefined;
  const fluidVelocityMs = result?.fluidVelocityMs;
  const fluidDpDigits = uPdrop === "Pa" ? 0 : 3;

  return (
    <>
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-300 bg-[#1E6FD9] px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">
        Lado Fluido
      </div>

      <div className="space-y-1.5 p-2">
        {/* 1) Fluido */}
        <FieldRow label="Fluido">
          <button
            type="button"
            onClick={() => setRefrigerantModalOpen(true)}
            disabled={disabled}
            className="flex w-full min-w-0 items-center justify-between gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-left text-xs text-slate-900 hover:border-sky-400 hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {(() => {
                const r = refrigerants.find((x) => x.id === fluid);
                if (!r) return fluid || "Selecionar fluido…";
                const label = r.shortName ?? r.name ?? r.id;
                const suffix =
                  r.commercialName && r.commercialName !== label
                    ? ` (${r.commercialName})`
                    : "";
                return `${label}${suffix}`;
              })()}
            </span>
            <Search className="h-3 w-3 shrink-0 text-slate-400" />
          </button>
        </FieldRow>

        {/* 1.5) Compressor (acopla cálculo ao polinômio ASHRAE) */}
        <FieldRow
          label="Compressor"
          badge={hasCompressor ? <BadgeCell type="catalog" /> : undefined}
          unit={
            <div className="flex w-full items-center justify-center rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-amber-900">
              {compressorCount}×
            </div>
          }
        >
          <button
            type="button"
            onClick={() => setCompressorModalOpen(true)}
            disabled={disabled}
            className="flex w-full min-w-0 items-center justify-between gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-left text-xs text-slate-900 hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <span className="min-w-0 flex-1 truncate">
              {hasCompressor
                ? compressors.find((c) => c.id === selectedCompressorId)?.label ??
                  selectedCompressorId
                : "— sem compressor —"}
            </span>
            <Search className="h-3 w-3 shrink-0 text-slate-400" />
          </button>
        </FieldRow>

        {/* 2) Vazão + cadeado */}
        <FieldRow
          label="Vazão"
          badge={
            massFlowReadOnly ? (
              <BadgeCell type="auto" />
            ) : !isMassFlowLocked ? (
              <BadgeCell type="manual" />
            ) : undefined
          }
          unit={
            <UnitSelect
              value={uMassFlow}
              onChange={setUMassFlow}
              options={MASS_FLOW_UNITS}
              disabled={disabled}
            />
          }
        >
          <div className="flex min-w-0 items-center gap-1">
            {massFlowReadOnly ? (
              <div className="w-full min-w-0 truncate rounded border border-amber-300 bg-amber-50 px-1.5 py-1 text-right text-[10px] italic text-amber-900">
                Calculado pelo Compressor
              </div>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                value={
                  Number.isFinite(displayedMassFlowKgH)
                    ? Number(
                        massFlowConv
                          .fromCanonical(displayedMassFlowKgH, uMassFlow)
                          .toFixed(1),
                      )
                    : 0
                }
                step="any"
                min={0}
                disabled={disabled || isMassFlowLocked}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  setFluidMassFlow(
                    massFlowConv.toCanonical(Number.isFinite(n) ? n : 0, uMassFlow),
                  );
                }}
                className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              />
            )}
            <button
              type="button"
              onClick={toggleMassFlowLock}
              disabled={disabled || massFlowReadOnly}
              title={
                isMassFlowLocked
                  ? "Vazão como incógnita (motor resolve)"
                  : "Vazão fixa pelo usuário"
              }
              className={`shrink-0 rounded border px-1.5 py-1 transition ${
                isMassFlowLocked
                  ? "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "border-emerald-400 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isMassFlowLocked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </FieldRow>

        {/* 3) Temp. Condensação / Evaporação */}
        <FieldRow
          label={operatingTempLabel}
          unit={
            <UnitSelect
              value={uOpTemp}
              onChange={setUOpTemp}
              options={TEMP_UNITS}
              disabled={disabled}
            />
          }
        >
          {opTempReadOnly ? (
            <div className="w-full min-w-0 truncate rounded border border-amber-300 bg-amber-50 px-1.5 py-1 text-right text-[10px] italic text-amber-900">
              Buscando Equilíbrio…
            </div>
          ) : (
            <NumInput
              value={tempConv.fromCanonical(fluidOperatingTemp_C, uOpTemp)}
              onChange={(v) =>
                setFluidOperatingTemp(tempConv.toCanonical(v, uOpTemp))
              }
              disabled={thermalInputsDisabled}
            />
          )}
        </FieldRow>

        {/* 3.5) Temperatura emparelhada (Tc para evap, Te para condensador) */}
        <FieldRow
          label={pairedTempLabel + (pairedRequired ? " *" : "")}
          unit={
            <UnitSelect
              value={uPaired}
              onChange={setUPaired}
              options={TEMP_UNITS}
              disabled={disabled}
            />
          }
        >
          <div className="min-w-0">
            <input
              type="text"
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              value={
                pairedTempC != null && Number.isFinite(pairedTempC)
                  ? tempConv.fromCanonical(pairedTempC, uPaired)
                  : ""
              }
              step="any"
              placeholder={pairedRequired ? "Obrigatório" : "Opcional"}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setPairedTempC(null);
                  return;
                }
                const n = parseFloat(raw);
                setPairedTempC(
                  Number.isFinite(n) ? tempConv.toCanonical(n, uPaired) : null,
                );
              }}
              className={`w-full min-w-0 rounded border px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 ${
                pairedMissing
                  ? "border-red-500 bg-red-50 text-red-900 focus:border-red-600 focus:ring-red-500"
                  : "border-slate-300 bg-white text-slate-900 focus:border-[#1E6FD9] focus:ring-[#1E6FD9]"
              }`}
            />
          </div>
        </FieldRow>

        {/* 4) Sobreaquecimento — evaporadores (útil) e condensadores (descarga) */}
        {isEvaporator && (
          <FieldRow
            label="Sobreaquecimento"
            unit={
              <UnitSelect
                value={uSH}
                onChange={setUSH}
                options={DELTA_T_UNITS}
                disabled={thermalInputsDisabled}
              />
            }
          >
            <NumInput
              value={deltaTConv.fromCanonical(superheat_K, uSH)}
              onChange={(v) => setSuperheat(deltaTConv.toCanonical(v, uSH))}
              min={0}
              disabled={thermalInputsDisabled}
            />
          </FieldRow>
        )}
        {isCondenser && (
          <FieldRow
            label="Sobreaq. Descarga"
            unit={
              <UnitSelect
                value={uDSH}
                onChange={setUDSH}
                options={DELTA_T_UNITS}
                disabled={thermalInputsDisabled}
              />
            }
          >
            <NumInput
              value={
                dischargeSuperheatK != null
                  ? deltaTConv.fromCanonical(dischargeSuperheatK, uDSH)
                  : 0
              }
              onChange={(v) =>
                setDischargeSuperheatK(deltaTConv.toCanonical(v, uDSH))
              }
              min={0}
              disabled={thermalInputsDisabled}
            />
          </FieldRow>
        )}

        {/* 5) Subresfriamento — sempre disponível (necessário para entalpia da válvula) */}
        <FieldRow
          label="Subresfriamento"
          unit={
            <UnitSelect
              value={uSC}
              onChange={setUSC}
              options={DELTA_T_UNITS}
              disabled={thermalInputsDisabled}
            />
          }
        >
          <NumInput
            value={deltaTConv.fromCanonical(subcooling_K, uSC)}
            onChange={(v) => setSubcooling(deltaTConv.toCanonical(v, uSC))}
            min={0}
            disabled={thermalInputsDisabled}
          />
        </FieldRow>

        {/* 6) Queda de Pressão (resultado) */}
        <FieldRow
          label="Queda de Pressão"
          unit={
            <UnitSelect
              value={uPdrop}
              onChange={setUPdrop}
              options={PRESSURE_UNITS}
            />
          }
        >
          <ReadOnly
            value={
              result?.fluidPressureDropKpa !== undefined
                ? pressureConv
                    .fromCanonical((displayedFluidDpKpa ?? 0) * 1000, uPdrop)
                    .toLocaleString("pt-BR", {
                      minimumFractionDigits: fluidDpDigits,
                      maximumFractionDigits: fluidDpDigits,
                    })
                : "---"
            }
          />
        </FieldRow>

        {/* 7) Fator de Segurança — auto-preenchido pelo SecurityFactor da geometria */}
        <FieldRow label="Fator de Segurança" unit={<UnitText text="%" />}>
          <NumInput
            value={errorFactorPercent}
            onChange={setErrorFactorPercent}
            step={0.1}
            disabled={disabled}
            placeholder="0 (sem margem)"
          />
          <span className="text-[10px] text-slate-400 mt-0.5">0% = sem margem | 10% = capacidade +10%</span>
        </FieldRow>

        {/* 8) Velocidade do Fluido (resultado) */}
        <FieldRow
          label="Vel. do Fluido"
          unit={
            <UnitSelect value={uVel} onChange={setUVel} options={VELOCITY_UNITS} />
          }
        >
          <ReadOnly
            value={
              result && (result as unknown as { fluidVelocityMs?: number })
                .fluidVelocityMs !== undefined
                ? velocityConv
                    .fromCanonical(
                      fluidVelocityMs ?? 0,
                      uVel,
                    )
                    .toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                : "---"
            }
          />
        </FieldRow>
      </div>

      {errors.length > 0 && (
        <ul className="mx-2 mb-2 space-y-0.5 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
    <CompressorPickerModal
      open={compressorModalOpen}
      onClose={() => setCompressorModalOpen(false)}
    />
    <RefrigerantPickerModal
      open={refrigerantModalOpen}
      onClose={() => setRefrigerantModalOpen(false)}
    />
    </>
  );
}

function FieldRow({
  label,
  unit,
  children,
  badge,
}: {
  label: string;
  unit?: React.ReactNode;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(90px,1fr)_60px_minmax(0,1.2fr)] items-center gap-1">
      <label
        className="flex min-w-0 items-center gap-1 truncate text-[10px] font-medium text-slate-700"
        title={label}
      >
        <span className="truncate">{label}</span>
        {badge}
      </label>
      <div className="min-w-0">{unit ?? <UnitText text="—" />}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function UnitText({ text }: { text: string }) {
  return (
    <div className="truncate rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-[10px] text-slate-600">
      {text}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const inputProps = useNumericInput(value, (v) => onChange(v ?? 0), { min, max });
  return (
    <input
      type="text"
      inputMode="decimal"
      {...inputProps}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

function ReadOnly({ value }: { value: string }) {
  const empty = value === "---" || value === "";
  return (
    <div
      className={`w-full truncate rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-right font-mono text-xs ${
        empty ? "text-emerald-700/60" : "font-semibold text-emerald-900"
      }`}
    >
      {value}
    </div>
  );
}
