/**
 * EvaporatorDetailPanel.tsx
 *
 * Painel de dimensionamento do evaporador.
 * 5 abas: Geometria | Condições | Resultados | Área | Diagnóstico
 */
import { useState } from "react";
import { Grid3x3, Wind, BarChart2, Layers, AlertTriangle } from "lucide-react";
import { useApplicationEngineering } from "../hooks/useApplicationEngineering";

const TABS = [
  { id: "geometry", label: "Geometria", icon: Grid3x3 },
  { id: "conditions", label: "Condições", icon: Wind },
  { id: "results", label: "Resultados", icon: BarChart2 },
  { id: "area", label: "Área", icon: Layers },
  { id: "diagnostics", label: "Diagnóstico", icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function EvaporatorDetailPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("geometry");
  const { evaporatorInput, evaporatorResult, setEvaporatorInput } =
    useApplicationEngineering();

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Evaporador</h2>
        <p className="text-xs text-muted-foreground">
          Dimensionamento e análise do trocador de calor do evaporador
        </p>
      </div>

      <div className="flex flex-wrap border-b border-border">
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

      <div className="p-4">
        {activeTab === "geometry" && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Filas"
              value={evaporatorInput.rows ?? 4}
              onChange={(v) => setEvaporatorInput({ rows: v })}
              min={1}
              max={12}
            />
            <NumberField
              label="Tubos por fila"
              value={evaporatorInput.tubes_per_row ?? 20}
              onChange={(v) => setEvaporatorInput({ tubes_per_row: v })}
              min={4}
              max={60}
            />
            <NumberField
              label="Comprimento aletado (mm)"
              value={evaporatorInput.length_mm ?? 1000}
              onChange={(v) => setEvaporatorInput({ length_mm: v })}
              min={200}
              max={4000}
              step={50}
            />
            <NumberField
              label="Diâmetro do tubo (mm)"
              value={evaporatorInput.tube_diameter_mm ?? 9.52}
              onChange={(v) => setEvaporatorInput({ tube_diameter_mm: v })}
              min={6}
              max={25}
              step={0.01}
            />
            <NumberField
              label="Passo de aleta (mm)"
              value={evaporatorInput.fin_spacing_mm ?? 4.5}
              onChange={(v) => setEvaporatorInput({ fin_spacing_mm: v })}
              min={2}
              max={12}
              step={0.5}
            />
            <NumberField
              label="Circuitos"
              value={evaporatorInput.circuits ?? 4}
              onChange={(v) => setEvaporatorInput({ circuits: v })}
              min={1}
              max={20}
            />
          </div>
        )}

        {activeTab === "conditions" && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Capacidade requerida (W)"
              value={evaporatorInput.required_capacity_w ?? 5000}
              onChange={(v) => setEvaporatorInput({ required_capacity_w: v })}
              min={100}
              max={500000}
              step={100}
            />
            <NumberField
              label="T entrada do ar (°C)"
              value={evaporatorInput.t_air_in_c ?? -15}
              onChange={(v) => setEvaporatorInput({ t_air_in_c: v })}
              min={-50}
              max={30}
            />
            <NumberField
              label="Vazão de ar (m³/h)"
              value={evaporatorInput.airflow_m3h ?? 1800}
              onChange={(v) => setEvaporatorInput({ airflow_m3h: v })}
              min={100}
              max={50000}
              step={100}
            />
            <NumberField
              label="Umidade relativa (%)"
              value={evaporatorInput.rh_air_pct ?? 85}
              onChange={(v) => setEvaporatorInput({ rh_air_pct: v })}
              min={30}
              max={100}
            />
          </div>
        )}

        {activeTab === "results" && (
          <ResultsContent result={evaporatorResult} />
        )}

        {activeTab === "area" && (
          <AreaContent result={evaporatorResult} />
        )}

        {activeTab === "diagnostics" && (
          <DiagnosticsContent result={evaporatorResult} />
        )}
      </div>
    </div>
  );
}

function ResultsContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["evaporatorResult"];
}) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver os resultados.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Capacidade" value={`${(result.capacity_w / 1000).toFixed(2)} kW`} highlight />
      <Metric label="T saída do ar" value={`${result.t_air_out_c.toFixed(1)} °C`} />
      <Metric label="LMTD" value={`${result.lmtd_k.toFixed(2)} K`} />
      <Metric label="U global" value={`${result.u_overall_w_m2k.toFixed(1)} W/m²·K`} />
      <Metric label="Vel. face" value={`${result.face_velocity_ms.toFixed(2)} m/s`} />
      <Metric label="ΔP ar" value={`${result.dp_air_pa.toFixed(1)} Pa`} />
      {result.frost_load_kg !== undefined && (
        <Metric label="Carga de gelo" value={`${result.frost_load_kg.toFixed(2)} kg`} />
      )}
    </div>
  );
}

function AreaContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["evaporatorResult"];
}) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver a área de troca.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Área total" value={`${result.exchange_area_m2.toFixed(3)} m²`} highlight />
      <Metric label="Área de aletas" value={`${result.finned_area_m2.toFixed(3)} m²`} />
      <Metric
        label="Área tubo nu"
        value={`${(result.exchange_area_m2 - result.finned_area_m2).toFixed(3)} m²`}
      />
      <Metric
        label="% aletas"
        value={`${((result.finned_area_m2 / result.exchange_area_m2) * 100).toFixed(1)}%`}
      />
    </div>
  );
}

function DiagnosticsContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["evaporatorResult"];
}) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver o diagnóstico.
      </p>
    );
  }
  if (result.warnings.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Nenhum aviso — evaporador dentro dos parâmetros normais.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {result.warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {w}
        </p>
      ))}
    </div>
  );
}

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
