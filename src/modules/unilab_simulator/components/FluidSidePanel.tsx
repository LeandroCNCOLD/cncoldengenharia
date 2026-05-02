import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type { RefrigerantItem, UnilabComponentType } from "../types/unilab.types";
import {
  getApplicationConfig,
  type FluidFieldDef,
} from "../config/applicationConfig";

interface FluidSidePanelProps {
  componentType: UnilabComponentType;
  refrigerants: RefrigerantItem[];
  disabled?: boolean;
}

/**
 * FluidSidePanel — replica o bloco "LADO FLUIDO" do Unilab Coils 9.0.
 *
 * Os campos exibidos vêm de `applicationConfig.ts` e variam conforme o tipo
 * de equipamento (evaporador DX, condensador a ar, bateria hidrônica, etc.).
 *
 * Etapa 3: somente UI. Sem cálculo. Outputs são placeholders ("---").
 */
export function FluidSidePanel({
  componentType,
  refrigerants,
  disabled,
}: FluidSidePanelProps) {
  const cfg = getApplicationConfig(componentType);
  const thermo = useUnilabSimulationStore((s) => s.thermoInputs);
  const setThermo = useUnilabSimulationStore((s) => s.setThermoInputs);
  const fluidExtras = useUnilabSimulationStore((s) => s.fluidExtras);
  const setFluidExtras = useUnilabSimulationStore((s) => s.setFluidExtras);

  const usesRefrigerant = cfg.fluidKind === "refrigerant";

  const renderField = (field: FluidFieldDef) => {
    const obtained = "---";
    switch (field.key) {
      case "evaporatingTemp":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={thermo.evaporatingTempC}
                onChange={(v) => setThermo({ evaporatingTempC: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "condensingTemp":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={thermo.condensingTempC}
                onChange={(v) => setThermo({ condensingTempC: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "superheat":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={thermo.superheatK}
                onChange={(v) => setThermo({ superheatK: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "subcooling":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={thermo.subcoolingK}
                onChange={(v) => setThermo({ subcoolingK: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "fluidInletTemp":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={fluidExtras.fluidInletTempC}
                onChange={(v) => setFluidExtras({ fluidInletTempC: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "fluidOutletTemp":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={fluidExtras.fluidOutletTempC}
                onChange={(v) => setFluidExtras({ fluidOutletTempC: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "fluidFlowMass":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={fluidExtras.fluidFlowMassKgH}
                onChange={(v) => setFluidExtras({ fluidFlowMassKgH: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
      case "steamPressure":
        return (
          <Row
            key={field.key}
            label={field.label}
            unit={field.unit}
            input={
              <NumberCell
                value={fluidExtras.steamPressureKpa}
                onChange={(v) => setFluidExtras({ steamPressureKpa: v })}
                disabled={disabled}
              />
            }
            obtained={obtained}
          />
        );
    }
  };

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="grid grid-cols-[1fr_88px] border-b border-slate-300 bg-[#1E6FD9] text-white">
        <div className="px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider">
          {cfg.fluidPanelTitle}
        </div>
        <div className="border-l border-white/30 px-2 py-1.5 text-center text-xs font-bold">
          Obt.
        </div>
      </div>

      <div className="space-y-1.5 p-2">
        {/* Seleção de fluido */}
        <Row
          label={usesRefrigerant ? "Fluido (Refrigerante)" : "Fluido"}
          unit=""
          input={
            usesRefrigerant ? (
              <select
                value={thermo.refrigerantId ?? ""}
                onChange={(e) => setThermo({ refrigerantId: e.target.value || undefined })}
                disabled={disabled}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100"
              >
                <option value="">Selecione…</option>
                {refrigerants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.kind === "pure" ? "puro" : "mistura"})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={cfg.fluidKind === "steam" ? "Vapor d'água" : "Água/Glicol"}
                disabled
                className="w-full cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs"
              />
            )
          }
          obtained="—"
          obtainedTone="gray"
        />

        {/* Vazão (kg/h ou similar) — output, motor calcula */}
        {usesRefrigerant && (
          <Row
            label="Vazão"
            unit="kg/h"
            input={<DisabledInput />}
            obtained="---"
            obtainedTone="gray"
          />
        )}

        {/* Campos específicos da aplicação */}
        {cfg.fluidFields.map(renderField)}

        {/* Queda de pressão do fluido */}
        {cfg.showFluidPressureDrop && (
          <Row
            label="Queda de Pressão"
            unit="kPa"
            input={<DisabledInput />}
            obtained="---"
            obtainedTone="gray"
          />
        )}

        {/* Fator de erro do lado fluido */}
        <Row
          label="Fator de Erro"
          unit="(m²·K)/W"
          input={
            <NumberCell
              value={fluidExtras.fluidFoulingFactor ?? 0}
              onChange={(v) => setFluidExtras({ fluidFoulingFactor: v })}
              min={0}
              step={0.0001}
              disabled={disabled}
            />
          }
          obtained="---"
          obtainedTone="gray"
        />

        {/* Velocidade do fluido (fase gás) — output */}
        {cfg.showFluidVelocity && (
          <Row
            label="Velocidade do Fluido (Fase Gás)"
            unit="m/s"
            input={<DisabledInput />}
            obtained="---"
            obtainedTone="gray"
          />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  unit,
  input,
  obtained,
  obtainedTone = "gray",
}: {
  label: string;
  unit: string;
  input: React.ReactNode;
  obtained: string;
  obtainedTone?: "gray" | "green";
}) {
  const obtBg = obtainedTone === "green" ? "bg-emerald-100" : "bg-slate-200";
  return (
    <div className="grid grid-cols-[160px_60px_1fr_88px] items-center gap-1.5">
      <label className="truncate text-[11px] font-medium text-slate-700" title={label}>
        {label}
      </label>
      <div className="rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-[11px] text-slate-600">
        {unit || "—"}
      </div>
      <div>{input}</div>
      <div
        className={`rounded border border-slate-300 ${obtBg} px-2 py-1 text-right font-mono text-[11px] text-slate-700`}
      >
        {obtained}
      </div>
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
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={value === undefined || Number.isNaN(value) ? "" : value}
      min={min}
      max={max}
      step={step ?? "any"}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(undefined);
          return;
        }
        const n = parseFloat(raw);
        onChange(Number.isFinite(n) ? n : undefined);
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
