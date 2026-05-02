import { useEffect, useState } from "react";
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
import {
  validateFluidSideInputs,
  type FluidSideValidationResult,
} from "../services/fluidSideValidation";
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
  /** mantido por compatibilidade com a página; o painel usa loadRefrigerants() diretamente */
  refrigerants?: unknown;
  disabled?: boolean;
  result?: UnilabSimulationResult;
}

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || !Number.isFinite(n)) return "---";
  return n.toFixed(digits);
}

/**
 * FluidSidePanel — Etapa 4 (Lado Fluido / Refrigerante).
 *
 * Replica o bloco "LADO FLUIDO" do Unilab Coils 9.0:
 *  - Inputs editáveis à esquerda
 *  - Coluna "Obt." à direita (read-only "---" — calculada na Etapa 5)
 *
 * Sem cálculo termodinâmico nesta etapa.
 */
export function FluidSidePanel({ componentType, disabled, result }: FluidSidePanelProps) {
  const cfg = getApplicationConfig(componentType);

  const fluid = useUnilabSimulationStore((s) => s.fluid);
  const fluidMassFlow_kg_h = useUnilabSimulationStore((s) => s.fluidMassFlow_kg_h);
  const fluidOperatingTemp_C = useUnilabSimulationStore((s) => s.fluidOperatingTemp_C);
  const fluidTempReference = useUnilabSimulationStore((s) => s.fluidTempReference);
  const superheat_K = useUnilabSimulationStore((s) => s.superheat_K);
  const subcooling_K = useUnilabSimulationStore((s) => s.subcooling_K);
  const foulingFactorFluid = useUnilabSimulationStore((s) => s.foulingFactorFluid);
  const setFluid = useUnilabSimulationStore((s) => s.setFluid);
  const setFluidMassFlow = useUnilabSimulationStore((s) => s.setFluidMassFlow);
  const setFluidOperatingTemp = useUnilabSimulationStore((s) => s.setFluidOperatingTemp);
  const setFluidTempReference = useUnilabSimulationStore((s) => s.setFluidTempReference);
  const setSuperheat = useUnilabSimulationStore((s) => s.setSuperheat);
  const setSubcooling = useUnilabSimulationStore((s) => s.setSubcooling);
  const setFoulingFactorFluid = useUnilabSimulationStore(
    (s) => s.setFoulingFactorFluid,
  );

  const [refrigerants, setRefrigerants] = useState<RefrigerantOption[]>([]);
  const [search, setSearch] = useState("");

  // Unidades selecionáveis por linha
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
        if (!cancelled) setRefrigerants(list);
      })
      .catch(() => {
        if (!cancelled) setRefrigerants([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRefrigerants =
    search.trim().length === 0
      ? refrigerants
      : refrigerants.filter((r) => {
          const q = search.toLowerCase();
          return (
            r.id.toLowerCase().includes(q) ||
            (r.name?.toLowerCase().includes(q) ?? false)
          );
        });

  const validation: FluidSideValidationResult = validateFluidSideInputs({
    fluid,
    fluidMassFlow_kg_h,
    fluidOperatingTemp_C,
    superheat_K,
    subcooling_K,
    foulingFactorFluid,
  });

  // Label dinâmico da temperatura de operação, conforme tipo de serpentina
  const operatingTempLabel = (() => {
    switch (cfg.type) {
      case "condenser_air":
      case "condenser_shell_tube":
        return "Temperatura de Condensação";
      case "evaporator_dx":
      case "evaporator_pumped":
        return "Temperatura de Evaporação";
      default:
        return "Temperatura de Operação do Fluido";
    }
  })();

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="grid grid-cols-[1fr_88px] border-b border-slate-300 bg-[#1E6FD9] text-white">
        <div className="px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider">
          Lado Fluido / Refrigerante
        </div>
        <div className="border-l border-white/30 px-2 py-1.5 text-center text-xs font-bold">
          Obt.
        </div>
      </div>

      <div className="space-y-1.5 p-2">
        {/* 1) Fluido — dropdown pesquisável + fallback manual */}
        <div className="grid grid-cols-[160px_84px_1fr_88px] items-center gap-1.5">
          <label className="truncate text-[11px] font-medium text-slate-700">
            Fluido
          </label>
          <div className="rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-[11px] text-slate-600">
            —
          </div>
          <div className="space-y-1">
            {refrigerants.length > 0 ? (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar refrigerante…"
                  disabled={disabled}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100"
                />
                <select
                  value={fluid}
                  onChange={(e) => setFluid(e.target.value)}
                  disabled={disabled}
                  size={Math.min(5, Math.max(2, filteredRefrigerants.length))}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100"
                >
                  {filteredRefrigerants.length === 0 && (
                    <option value="" disabled>
                      Nenhum resultado
                    </option>
                  )}
                  {filteredRefrigerants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name ?? r.id}
                      {r.type ? ` (${r.type === "pure" ? "puro" : r.type === "mixture" ? "mistura" : r.type})` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <input
                type="text"
                value={fluid}
                onChange={(e) => setFluid(e.target.value)}
                placeholder="Ex.: R404A"
                disabled={disabled}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100"
              />
            )}
          </div>
          <div className="rounded border border-slate-300 bg-slate-200 px-2 py-1 text-right font-mono text-[11px] text-slate-700">
            {fluid || "---"}
          </div>
        </div>

        {/* 2) Vazão Mássica — editável */}
        <Row
          label="Vazão Mássica"
          unitNode={<UnitSelect value={uMassFlow} onChange={setUMassFlow} options={MASS_FLOW_UNITS} disabled={disabled} />}
          input={
            <NumberCell
              value={massFlowConv.fromCanonical(fluidMassFlow_kg_h, uMassFlow)}
              onChange={(v) => setFluidMassFlow(massFlowConv.toCanonical(v, uMassFlow))}
              min={0}
              disabled={disabled}
            />
          }
          obtained={
            fluidMassFlow_kg_h > 0
              ? massFlowConv.fromCanonical(fluidMassFlow_kg_h, uMassFlow).toFixed(uMassFlow === "kg_s" || uMassFlow === "g_s" ? 4 : 1)
              : "---"
          }
        />

        {/* 3) Temperatura de Operação (label dinâmico) */}
        <Row
          label={operatingTempLabel}
          unitNode={<UnitSelect value={uOpTemp} onChange={setUOpTemp} options={TEMP_UNITS} disabled={disabled} />}
          input={
            <NumberCell
              value={tempConv.fromCanonical(fluidOperatingTemp_C, uOpTemp)}
              onChange={(v) => setFluidOperatingTemp(tempConv.toCanonical(v, uOpTemp))}
              disabled={disabled}
            />
          }
          obtained={tempConv.fromCanonical(fluidOperatingTemp_C, uOpTemp).toFixed(1)}
        />

        {/* 4) Referência da Temperatura */}
        <Row
          label="Referência da Temperatura"
          unitNode={<UnitText text="—" />}
          input={
            <select
              value={fluidTempReference}
              onChange={(e) =>
                setFluidTempReference(e.target.value as "inlet" | "middle" | "outlet")
              }
              disabled={disabled}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100"
            >
              <option value="inlet">Entrada</option>
              <option value="middle">Meio</option>
              <option value="outlet">Saída</option>
            </select>
          }
          obtained="—"
        />

        {/* 5) Sobreaquecimento */}
        <Row
          label="Sobreaquecimento"
          unitNode={<UnitSelect value={uSH} onChange={setUSH} options={DELTA_T_UNITS} disabled={disabled} />}
          input={
            <NumberCell
              value={deltaTConv.fromCanonical(superheat_K, uSH)}
              onChange={(v) => setSuperheat(deltaTConv.toCanonical(v, uSH))}
              min={0}
              disabled={disabled}
            />
          }
          obtained={deltaTConv.fromCanonical(superheat_K, uSH).toFixed(1)}
        />

        {/* 6) Subresfriamento */}
        <Row
          label="Subresfriamento"
          unitNode={<UnitSelect value={uSC} onChange={setUSC} options={DELTA_T_UNITS} disabled={disabled} />}
          input={
            <NumberCell
              value={deltaTConv.fromCanonical(subcooling_K, uSC)}
              onChange={(v) => setSubcooling(deltaTConv.toCanonical(v, uSC))}
              min={0}
              disabled={disabled}
            />
          }
          obtained={deltaTConv.fromCanonical(subcooling_K, uSC).toFixed(1)}
        />

        {/* 7) Fator de Erro do Fluido */}
        <Row
          label="Fator de Erro do Fluido"
          unitNode={<UnitText text="(m²·K)/W" />}
          input={
            <NumberCell
              value={foulingFactorFluid}
              onChange={setFoulingFactorFluid}
              min={0}
              step={0.0001}
              disabled={disabled}
            />
          }
          obtained="---"
        />
      </div>

      {/* Outputs read-only */}
      <div className="border-t border-slate-300 bg-white p-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Resultados do Lado Fluido
        </div>
        <div className="space-y-1.5">
          <Row
            label="Queda de Pressão"
            unitNode={<UnitSelect value={uPdrop} onChange={setUPdrop} options={PRESSURE_UNITS} />}
            input={<DisabledInput />}
            obtained={
              result?.fluidPressureDropKpa !== undefined
                ? pressureConv.fromCanonical(result.fluidPressureDropKpa * 1000, uPdrop).toFixed(uPdrop === "Pa" ? 0 : 3)
                : "---"
            }
          />
          <Row
            label="Velocidade do Fluido"
            unitNode={<UnitSelect value={uVel} onChange={setUVel} options={VELOCITY_UNITS} />}
            input={<DisabledInput />}
            obtained="---"
          />
          <Row
            label="Fase do Fluido"
            unitNode={<UnitText text="—" />}
            input={<DisabledInput />}
            obtained={
              result?.regime === "WET"
                ? "Mudança de fase (úmido)"
                : result?.regime === "DRY"
                  ? "Monofásico (seco)"
                  : "Aguardando cálculo"
            }
          />
        </div>
      </div>

      {!validation.valid && (
        <ul className="mx-2 mb-2 space-y-0.5 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
          {validation.errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  unitNode,
  input,
  obtained,
}: {
  label: string;
  unitNode: React.ReactNode;
  input: React.ReactNode;
  obtained: string;
}) {
  const isEmpty = obtained === "---" || obtained === "" || obtained === "—";
  return (
    <div className="grid grid-cols-[160px_84px_1fr_88px] items-center gap-1.5">
      <label className="truncate text-[11px] font-medium text-slate-700" title={label}>
        {label}
      </label>
      <div>{unitNode}</div>
      <div>{input}</div>
      <div
        className={`rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-right font-mono text-[11px] ${
          isEmpty ? "text-emerald-700/60" : "text-emerald-900 font-semibold"
        }`}
      >
        {obtained}
      </div>
    </div>
  );
}

function UnitText({ text }: { text: string }) {
  return (
    <div className="rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-[11px] text-slate-600">
      {text}
    </div>
  );
}

function NumberCell({
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
      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

function DisabledInput() {
  return (
    <input
      type="text"
      value=""
      disabled
      className="w-full cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs"
    />
  );
}
