/**
 * CompressorSelectionPanel.tsx
 *
 * Painel de seleção de compressor e ponto de operação.
 * 5 abas: Ponto de Operação | Seleção | Resultados | Envelope | Diagnóstico
 */
import { useState } from "react";
import { Thermometer, Zap, BarChart2, AlertTriangle, CheckCircle } from "lucide-react";
import { useApplicationEngineering } from "../hooks/useApplicationEngineering";
import type { OperatingPointInput } from "../types/application-engineering.types";

const TABS = [
  { id: "operating-point", label: "Ponto de Operação", icon: Thermometer },
  { id: "selection", label: "Seleção", icon: Zap },
  { id: "results", label: "Resultados", icon: BarChart2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CompressorSelectionPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("operating-point");
  const {
    operatingPointInput,
    operatingPointResult,
    compressorInput,
    compressorResult,
    setOperatingPointInput,
    setCompressorInput,
  } = useApplicationEngineering();

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Compressor</h2>
        <p className="text-xs text-muted-foreground">
          Ponto de operação e seleção por catálogo
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "operating-point" && (
          <OperatingPointTab
            input={operatingPointInput}
            result={operatingPointResult}
            onChange={setOperatingPointInput}
          />
        )}
        {activeTab === "selection" && (
          <SelectionTab
            input={compressorInput}
            onChange={setCompressorInput}
          />
        )}
        {activeTab === "results" && (
          <ResultsTab result={compressorResult} />
        )}
      </div>
    </div>
  );
}

// ─── Aba: Ponto de Operação ───────────────────────────────────────────────────

function OperatingPointTab({
  input,
  result,
  onChange,
}: {
  input: OperatingPointInput;
  result: ReturnType<typeof useApplicationEngineering>["operatingPointResult"];
  onChange: (v: OperatingPointInput) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Modo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({
              mode: "B",
              t_room_c: -18,
              t_ambient_c: 32,
              dt_evap_k: 8,
              dt_cond_k: 12,
              superheat_k: 10,
              subcooling_k: 5,
            })
          }
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            input.mode === "B"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "border-border text-muted-foreground hover:border-blue-300"
          }`}
        >
          Modo B — Câmara + Ambiente
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              mode: "A",
              te_c: -25,
              tc_c: 45,
              superheat_k: 10,
              subcooling_k: 5,
            })
          }
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            input.mode === "A"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "border-border text-muted-foreground hover:border-blue-300"
          }`}
        >
          Modo A — Te / Tc direto
        </button>
      </div>

      {/* Campos */}
      {input.mode === "B" ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="T câmara (°C)"
            value={input.t_room_c}
            onChange={(v) => onChange({ ...input, t_room_c: v })}
            min={-50}
            max={15}
          />
          <NumberField
            label="T ambiente (°C)"
            value={input.t_ambient_c}
            onChange={(v) => onChange({ ...input, t_ambient_c: v })}
            min={-10}
            max={55}
          />
          <NumberField
            label="ΔT evaporador (K)"
            value={input.dt_evap_k ?? 8}
            onChange={(v) => onChange({ ...input, dt_evap_k: v })}
            min={3}
            max={20}
          />
          <NumberField
            label="ΔT condensador (K)"
            value={input.dt_cond_k ?? 12}
            onChange={(v) => onChange({ ...input, dt_cond_k: v })}
            min={5}
            max={25}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Te (°C)"
            value={input.te_c}
            onChange={(v) => onChange({ ...input, te_c: v })}
            min={-50}
            max={15}
          />
          <NumberField
            label="Tc (°C)"
            value={input.tc_c}
            onChange={(v) => onChange({ ...input, tc_c: v })}
            min={20}
            max={70}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Superaquecimento (K)"
          value={
            input.mode === "A"
              ? (input.superheat_k ?? 10)
              : (input.superheat_k ?? 10)
          }
          onChange={(v) => onChange({ ...input, superheat_k: v })}
          min={0}
          max={30}
        />
        <NumberField
          label="Sub-resfriamento (K)"
          value={
            input.mode === "A"
              ? (input.subcooling_k ?? 5)
              : (input.subcooling_k ?? 5)
          }
          onChange={(v) => onChange({ ...input, subcooling_k: v })}
          min={0}
          max={20}
        />
      </div>

      {/* Resultado calculado */}
      {result && (
        <div className="rounded-md bg-muted/50 p-3 text-xs">
          <p className="font-medium text-foreground">Ponto resolvido:</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <Metric label="Te" value={`${result.te_c.toFixed(1)} °C`} />
            <Metric label="Tc" value={`${result.tc_c.toFixed(1)} °C`} />
            <Metric label="Tc - Te" value={`${(result.tc_c - result.te_c).toFixed(1)} K`} />
            <Metric label="Superaq." value={`${result.superheat_k} K`} />
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Aba: Seleção ─────────────────────────────────────────────────────────────

function SelectionTab({
  input,
  onChange,
}: {
  input: ReturnType<typeof useApplicationEngineering>["compressorInput"];
  onChange: (v: Parameters<ReturnType<typeof useApplicationEngineering>["setCompressorInput"]>[0]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Refrigerante
          </label>
          <select
            value={input.refrigerant ?? "R404A"}
            onChange={(e) => onChange({ refrigerant: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {["R404A", "R507A", "R134a", "R410A", "R448A", "R449A", "R452A", "R290"].map(
              (r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Aplicação
          </label>
          <select
            value={input.application ?? "LT"}
            onChange={(e) =>
              onChange({ application: e.target.value as "LT" | "MT" | "HT" })
            }
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="LT">LT — Baixa Temperatura</option>
            <option value="MT">MT — Média Temperatura</option>
            <option value="HT">HT — Alta Temperatura</option>
          </select>
        </div>
      </div>
      <NumberField
        label="Capacidade requerida (W)"
        value={input.required_capacity_w ?? 5000}
        onChange={(v) => onChange({ required_capacity_w: v })}
        min={100}
        max={500000}
        step={100}
      />
      <p className="text-xs text-muted-foreground">
        O cálculo buscará automaticamente o melhor compressor do catálogo ao clicar em
        "Calcular Sistema".
      </p>
    </div>
  );
}

// ─── Aba: Resultados ──────────────────────────────────────────────────────────

function ResultsTab({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["compressorResult"];
}) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver os resultados do compressor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <div>
          <p className="text-sm font-semibold text-foreground">{result.model}</p>
          <p className="text-xs text-muted-foreground">{result.manufacturer}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Capacidade" value={`${(result.capacity_w / 1000).toFixed(2)} kW`} highlight />
        <Metric label="Potência" value={`${(result.power_w / 1000).toFixed(2)} kW`} />
        <Metric label="COP" value={result.cop_compressor.toFixed(2)} highlight />
        <Metric label="Corrente" value={result.current_a ? `${result.current_a.toFixed(1)} A` : "—"} />
        <Metric label="Te usado" value={`${result.te_used_c.toFixed(1)} °C`} />
        <Metric label="Tc usado" value={`${result.tc_used_c.toFixed(1)} °C`} />
      </div>

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={`text-xs font-semibold ${highlight ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
