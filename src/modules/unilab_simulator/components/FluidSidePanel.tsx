import { useEffect, useState } from "react";
import { Lock, Unlock, Zap } from "lucide-react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  UnilabComponentType,
  UnilabSimulationResult,
} from "../types/unilab.types";
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

interface FluidSidePanelProps {
  componentType: UnilabComponentType;
  refrigerants?: unknown;
  disabled?: boolean;
  result?: UnilabSimulationResult;
}

/**
 * FluidSidePanel — Etapa 4 (LADO FLUIDO).
 *
 * Ordem exata da spec UNILAB:
 *  1) Fluido (dropdown)
 *  2) Vazão (input + cadeado funcional)
 *  3) Temp. Condensação/Evaporação (label dinâmico)
 *  4) Sobreaquecimento (apenas evaporadores)
 *  5) Subresfriamento (apenas condensadores)
 *  6) Queda de Pressão (resultado)
 *  7) Fator de Erro (input)
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

  const fluid = useUnilabSimulationStore((s) => s.fluid);
  const fluidMassFlow_kg_h = useUnilabSimulationStore((s) => s.fluidMassFlow_kg_h);
  const isMassFlowLocked = useUnilabSimulationStore((s) => s.isMassFlowLocked);
  const fluidOperatingTemp_C = useUnilabSimulationStore(
    (s) => s.fluidOperatingTemp_C,
  );
  const superheat_K = useUnilabSimulationStore((s) => s.superheat_K);
  const subcooling_K = useUnilabSimulationStore((s) => s.subcooling_K);
  const foulingFactorFluid = useUnilabSimulationStore((s) => s.foulingFactorFluid);
  const pairedTempC = useUnilabSimulationStore((s) => s.pairedTempC);
  const dischargeSuperheatK = useUnilabSimulationStore((s) => s.dischargeSuperheatK);
  const selectedCompressorId = useUnilabSimulationStore((s) => s.selectedCompressorId);
  const setFluid = useUnilabSimulationStore((s) => s.setFluid);
  const setFluidMassFlow = useUnilabSimulationStore((s) => s.setFluidMassFlow);
  const toggleMassFlowLock = useUnilabSimulationStore((s) => s.toggleMassFlowLock);
  const setFluidOperatingTemp = useUnilabSimulationStore(
    (s) => s.setFluidOperatingTemp,
  );
  const setSuperheat = useUnilabSimulationStore((s) => s.setSuperheat);
  const setSubcooling = useUnilabSimulationStore((s) => s.setSubcooling);
  const setFoulingFactorFluid = useUnilabSimulationStore(
    (s) => s.setFoulingFactorFluid,
  );
  const setPairedTempC = useUnilabSimulationStore((s) => s.setPairedTempC);
  const setDischargeSuperheatK = useUnilabSimulationStore((s) => s.setDischargeSuperheatK);
  const setSelectedCompressor = useUnilabSimulationStore((s) => s.setSelectedCompressor);

  const [refrigerants, setRefrigerants] = useState<RefrigerantOption[]>([]);

  const [uMassFlow, setUMassFlow] = useState<MassFlowUnit>("kg_h");
  const [uOpTemp, setUOpTemp] = useState<TempUnit>("C");
  const [uSH, setUSH] = useState<DeltaTUnit>("K");
  const [uSC, setUSC] = useState<DeltaTUnit>("K");
  const [uPdrop, setUPdrop] = useState<PressureUnit>("kPa");
  const [uVel, setUVel] = useState<VelocityUnit>("m_s");

  useEffect(() => {
    let cancelled = false;
    loadRefrigerants()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) =>
          (a.shortName ?? a.name ?? a.id).localeCompare(
            b.shortName ?? b.name ?? b.id,
          ),
        );
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
  const thermalInputsDisabled = false;

  // Validações (Etapa 4)
  const errors: string[] = [];
  if (!fluid) errors.push("Selecione um fluido refrigerante.");
  if (!isMassFlowLocked && !(fluidMassFlow_kg_h > 0)) {
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

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-300 bg-[#1E6FD9] px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">
        Lado Fluido
      </div>

      <div className="space-y-1.5 p-2">
        {/* 1) Fluido */}
        <FieldRow label="Fluido">
          <select
            value={fluid}
            onChange={(e) => setFluid(e.target.value)}
            disabled={disabled}
            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100"
          >
            {refrigerants.length === 0 && <option value={fluid}>{fluid}</option>}
            {refrigerants.map((r) => {
              const label = r.shortName ?? r.name ?? r.id;
              const suffix =
                r.commercialName && r.commercialName !== label
                  ? ` (${r.commercialName})`
                  : "";
              return (
                <option key={r.id} value={r.id}>
                  {label}
                  {suffix}
                </option>
              );
            })}
          </select>
        </FieldRow>

        {/* 2) Vazão + cadeado */}
        <FieldRow
          label="Vazão"
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
            <input
              type="number"
              value={
                Number.isFinite(fluidMassFlow_kg_h)
                  ? massFlowConv.fromCanonical(fluidMassFlow_kg_h, uMassFlow)
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
            <button
              type="button"
              onClick={toggleMassFlowLock}
              disabled={disabled}
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
          <NumInput
            value={tempConv.fromCanonical(fluidOperatingTemp_C, uOpTemp)}
            onChange={(v) =>
              setFluidOperatingTemp(tempConv.toCanonical(v, uOpTemp))
            }
            disabled={thermalInputsDisabled}
          />
        </FieldRow>

        {/* 4) Sobreaquecimento — só evaporadores */}
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

        {/* 5) Subresfriamento — só condensadores */}
        {isCondenser && (
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
        )}

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
                    .fromCanonical(result.fluidPressureDropKpa * 1000, uPdrop)
                    .toFixed(uPdrop === "Pa" ? 0 : 3)
                : "---"
            }
          />
        </FieldRow>

        {/* 7) Fator de Erro */}
        <FieldRow label="Fator de Erro" unit={<UnitText text="(m²·K)/W" />}>
          <NumInput
            value={foulingFactorFluid}
            onChange={setFoulingFactorFluid}
            min={0}
            step={0.0001}
            disabled={disabled}
          />
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
                      (result as unknown as { fluidVelocityMs: number })
                        .fluidVelocityMs,
                      uVel,
                    )
                    .toFixed(2)
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
  );
}

function FieldRow({
  label,
  unit,
  children,
}: {
  label: string;
  unit?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(90px,1fr)_60px_minmax(0,1.2fr)] items-center gap-1">
      <label
        className="truncate text-[10px] font-medium text-slate-700"
        title={label}
      >
        {label}
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
  step,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step ?? "any"}
      disabled={disabled}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
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
