/**
 * CondenserDetailPanel.tsx
 *
 * Painel de dimensionamento do condensador.
 * Abas: Geometria | Condições | Resultados | Área | Refrigerante | Cobertura | Diagnóstico
 */
import { useState } from "react";
import {
  Grid3x3,
  Wind,
  BarChart2,
  Layers,
  AlertTriangle,
  Droplets,
  Target,
} from "lucide-react";
import { useApplicationEngineering } from "../hooks/useApplicationEngineering";

const TABS = [
  { id: "geometry", label: "Geometria", icon: Grid3x3 },
  { id: "conditions", label: "Condições", icon: Wind },
  { id: "results", label: "Resultados", icon: BarChart2 },
  { id: "area", label: "Área", icon: Layers },
  { id: "refrigerant", label: "Refrigerante", icon: Droplets },
  { id: "coverage", label: "Cobertura", icon: Target },
  { id: "diagnostics", label: "Diagnóstico", icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CondenserDetailPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("geometry");
  const {
    condenserInput,
    condenserResult,
    setCondenserInput,
    compressorOperatingPoints,
    condenserCoverageRatio,
  } = useApplicationEngineering();

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Condensador</h2>
            <p className="text-xs text-muted-foreground">
              Dimensionamento e análise do trocador de calor do condensador
            </p>
          </div>
          {condenserCoverageRatio !== null && (
            <div
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                condenserCoverageRatio >= 0.9
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : condenserCoverageRatio >= 0.7
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {(condenserCoverageRatio * 100).toFixed(0)}% cobertura
            </div>
          )}
        </div>
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
                  ? "border-b-2 border-orange-500 text-orange-600"
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
              value={condenserInput.rows ?? 2}
              onChange={(v) => setCondenserInput({ rows: v })}
              min={1}
              max={12}
            />
            <NumberField
              label="Tubos por fila"
              value={condenserInput.tubes_per_row ?? 20}
              onChange={(v) => setCondenserInput({ tubes_per_row: v })}
              min={4}
              max={60}
            />
            <NumberField
              label="Comprimento aletado (mm)"
              value={condenserInput.length_mm ?? 1200}
              onChange={(v) => setCondenserInput({ length_mm: v })}
              min={200}
              max={4000}
              step={50}
            />
            <NumberField
              label="Diâmetro do tubo (mm)"
              value={condenserInput.tube_diameter_mm ?? 9.52}
              onChange={(v) => setCondenserInput({ tube_diameter_mm: v })}
              min={6}
              max={25}
              step={0.01}
            />
            <NumberField
              label="Passo de aleta (mm)"
              value={condenserInput.fin_spacing_mm ?? 2.0}
              onChange={(v) => setCondenserInput({ fin_spacing_mm: v })}
              min={1.5}
              max={8}
              step={0.5}
            />
            <NumberField
              label="Circuitos"
              value={condenserInput.circuits ?? 2}
              onChange={(v) => setCondenserInput({ circuits: v })}
              min={1}
              max={20}
            />
          </div>
        )}

        {activeTab === "conditions" && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="T ambiente (°C)"
              value={condenserInput.t_ambient_c ?? 32}
              onChange={(v) => setCondenserInput({ t_ambient_c: v })}
              min={-10}
              max={55}
            />
            <NumberField
              label="Vazão de ar (m³/h)"
              value={condenserInput.airflow_m3h ?? 4000}
              onChange={(v) => setCondenserInput({ airflow_m3h: v })}
              min={100}
              max={100000}
              step={100}
            />
            <p className="col-span-2 text-xs text-muted-foreground">
              O calor a rejeitar é calculado automaticamente a partir da capacidade do
              evaporador + potência do compressor.
            </p>
          </div>
        )}

        {activeTab === "results" && (
          <ResultsContent result={condenserResult} />
        )}

        {activeTab === "area" && (
          <AreaContent result={condenserResult} />
        )}

        {activeTab === "refrigerant" && (
          <RefrigerantContent result={condenserResult} />
        )}

        {activeTab === "coverage" && (
          <CoverageContent
            points={compressorOperatingPoints}
            coverageRatio={condenserCoverageRatio}
            type="cond"
          />
        )}

        {activeTab === "diagnostics" && (
          <DiagnosticsContent result={condenserResult} />
        )}
      </div>
    </div>
  );
}

function ResultsContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["condenserResult"];
}) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver os resultados.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <SectionTitle>Capacidade</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Calor rejeitado" value={`${(result.heat_rejection_w / 1000).toFixed(3)} kW`} highlight />
        {result.sensible_capacity_w !== undefined && (
          <Metric label="Capacidade sensível" value={`${(result.sensible_capacity_w / 1000).toFixed(3)} kW`} />
        )}
        {result.safety_factor !== undefined && (
          <Metric label="Fator de segurança" value={result.safety_factor.toFixed(3)} />
        )}
      </div>

      <SectionTitle>Ar</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="T saída do ar" value={`${result.t_air_out_c.toFixed(2)} °C`} />
        <Metric label="Vel. de face" value={`${result.face_velocity_ms.toFixed(3)} m/s`} />
        <Metric label="ΔP ar" value={`${result.dp_air_pa.toFixed(1)} Pa`} />
      </div>

      <SectionTitle>Transferência de Calor</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="LMTD" value={`${result.lmtd_k.toFixed(3)} K`} />
        <Metric label="U global" value={`${result.u_overall_w_m2k.toFixed(2)} W/m²·K`} />
      </div>
    </div>
  );
}

function AreaContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["condenserResult"];
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
      <Metric label="Área total" value={`${result.exchange_area_m2.toFixed(4)} m²`} highlight />
      <Metric label="Área de aletas" value={`${result.finned_area_m2.toFixed(4)} m²`} />
      <Metric
        label="Área tubo nu"
        value={`${(result.exchange_area_m2 - result.finned_area_m2).toFixed(4)} m²`}
      />
      <Metric
        label="% aletas"
        value={`${((result.finned_area_m2 / result.exchange_area_m2) * 100).toFixed(1)}%`}
      />
    </div>
  );
}

function RefrigerantContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["condenserResult"];
}) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver os dados do refrigerante.
      </p>
    );
  }
  const hasData =
    result.refrigerant_outlet_temp_c !== undefined ||
    result.fluid_pressure_drop_kpa !== undefined;

  if (!hasData) {
    return (
      <p className="text-xs text-muted-foreground">
        Dados do refrigerante não disponíveis para esta configuração.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {result.refrigerant_outlet_temp_c !== undefined && (
        <Metric label="T saída refrigerante" value={`${result.refrigerant_outlet_temp_c.toFixed(2)} °C`} highlight />
      )}
      {result.fluid_pressure_drop_kpa !== undefined && (
        <Metric label="ΔP refrigerante" value={`${result.fluid_pressure_drop_kpa.toFixed(3)} kPa`} />
      )}
    </div>
  );
}

function CoverageContent({
  points,
  coverageRatio,
  type,
}: {
  points: ReturnType<typeof useApplicationEngineering>["compressorOperatingPoints"];
  coverageRatio: number | null;
  type: "evap" | "cond";
}) {
  if (!points || points.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute o cálculo para ver a cobertura ponto a ponto.
      </p>
    );
  }

  const meetsKey = type === "evap" ? "evap_meets" : "cond_meets";
  const metCount = points.filter((p) => p[meetsKey]).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-full px-3 py-1.5 text-sm font-bold ${
            (coverageRatio ?? 0) >= 0.9
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : (coverageRatio ?? 0) >= 0.7
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {metCount}/{points.length} pontos atendidos ({((coverageRatio ?? 0) * 100).toFixed(0)}%)
        </div>
      </div>

      <div className="max-h-64 overflow-auto rounded-md border border-border">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-muted/80">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Te (°C)</th>
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Tc (°C)</th>
              <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">Q_rej_req (kW)</th>
              <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">Q_cond (kW)</th>
              <th className="px-2 py-1.5 text-center font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const meets = p[meetsKey];
              const heatRejReq = (p.comp_capacity_w + p.comp_power_w) / 1000;
              return (
                <tr
                  key={i}
                  className={`border-t border-border ${
                    meets ? "" : "bg-red-50/50 dark:bg-red-950/20"
                  }`}
                >
                  <td className="px-2 py-1 text-foreground">{p.te_c.toFixed(1)}</td>
                  <td className="px-2 py-1 text-foreground">{p.tc_c.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right text-foreground">
                    {heatRejReq.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-right text-foreground">
                    {(p.cond_heat_rejection_w / 1000).toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {meets ? (
                      <span className="text-green-600 dark:text-green-400">✓</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiagnosticsContent({
  result,
}: {
  result: ReturnType<typeof useApplicationEngineering>["condenserResult"];
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
        Nenhum aviso — condensador dentro dos parâmetros normais.
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
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
        className={`text-xs font-semibold ${highlight ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
