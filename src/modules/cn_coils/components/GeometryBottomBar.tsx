import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import { FIN_PITCH_TOOLS_MM, snapFinPitchToTool } from "../config/finPitchTools";

/**
 * GeometryBottomBar — Etapa 3.5 (CN COILS)
 *
 * Barra horizontal com os parâmetros numéricos da geometria.
 * - Passo de Aleta restrito à lista de ferramentas (colares) da fábrica
 * - Toggle "Passo Variável (Fila a Fila)" para evaporadores BT
 * - Alerta de tubos não aproveitados (resto da divisão por circuitos)
 */
export function GeometryBottomBar() {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const setPhysical = useUnilabSimulationStore((s) => s.setPhysicalInputs);

  const tubesPerRow = Math.max(0, Math.floor(physical.tubesPerRow ?? 0));
  const rows = Math.max(0, Math.floor(physical.rows ?? 0));
  const circuits = Math.max(0, Math.floor(physical.circuits ?? 0));
  const totalTubos = tubesPerRow * rows;
  const tubosNaoAproveitados =
    circuits > 0 && totalTubos > 0 ? totalTubos % circuits : 0;
  const aproveitamentoOk = circuits > 0 && totalTubos > 0 && tubosNaoAproveitados === 0;

  const isVariable = !!physical.isVariableFinPitch;
  const rowPitches = physical.rowFinPitchesMm ?? [];

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-300 bg-[#1E6FD9] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
        <span>Geometria — Parâmetros Numéricos</span>
        <label className="flex items-center gap-1 text-[10px] font-medium normal-case">
          <input
            type="checkbox"
            checked={isVariable}
            onChange={(e) => setPhysical({ isVariableFinPitch: e.target.checked })}
            className="h-3 w-3 accent-white"
          />
          Passo Variável (Fila a Fila)
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-7">
        <Field
          label="Nº Tubos por fila"
          value={physical.tubesPerRow}
          onChange={(v) => setPhysical({ tubesPerRow: v })}
          step={1}
          min={1}
        />
        <Field
          label="Nº de Filas"
          value={physical.rows}
          onChange={(v) => setPhysical({ rows: v })}
          step={1}
          min={1}
        />
        <FinPitchSelect
          label="Passo da Aleta (mm)"
          value={physical.finPitchMm}
          onChange={(v) => setPhysical({ finPitchMm: v })}
          disabled={isVariable}
        />
        <Field
          label="Nº Tubos não utilizados"
          value={physical.unusedTubes}
          onChange={(v) => setPhysical({ unusedTubes: v })}
          step={1}
          min={0}
        />
        <Field
          label="Comprimento Aletado (mm)"
          value={physical.finnedLengthMm}
          onChange={(v) => setPhysical({ finnedLengthMm: v })}
          step={1}
          min={0}
        />
        <Field
          label="Nº de Circuitos"
          value={physical.circuits}
          onChange={(v) => setPhysical({ circuits: v })}
          step={1}
          min={1}
        />
        <Field
          label="Nº Divisores"
          value={physical.dividers}
          onChange={(v) => setPhysical({ dividers: v })}
          step={1}
          min={0}
        />
      </div>

      {/* Alerta de aproveitamento de tubos */}
      {(totalTubos > 0 && circuits > 0) && (
        <div className="border-t border-slate-200 px-2 py-1.5">
          {aproveitamentoOk ? (
            <div className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">
              <CheckCircle2 className="h-3 w-3" />
              Aproveitamento total dos tubos ({totalTubos} tubos /{" "}
              {circuits} circuitos = {totalTubos / circuits} tubos/circuito).
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900">
              <AlertTriangle className="h-3 w-3" />
              Atenção: {tubosNaoAproveitados}{" "}
              {tubosNaoAproveitados === 1 ? "tubo não aproveitado" : "tubos não aproveitados"}{" "}
              nesta configuração de circuitagem ({totalTubos} tubos /{" "}
              {circuits} circuitos).
            </div>
          )}
        </div>
      )}

      {/* Tabela de passo variável por fila */}
      {isVariable && rows > 0 && (
        <div className="border-t border-slate-200 px-2 py-2">
          <div className="mb-1 text-[10px] font-semibold text-slate-700">
            Passo de Aleta por Fila (Row 1 = face de entrada do ar)
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: rows }).map((_, i) => {
              const v = rowPitches[i] ?? snapFinPitchToTool(physical.finPitchMm ?? 2.5);
              return (
                <label
                  key={i}
                  className="flex min-w-0 flex-col gap-0.5 rounded border border-slate-200 bg-white p-1"
                >
                  <span className="truncate text-[9px] font-medium text-slate-600">
                    Row {i + 1}
                  </span>
                  <select
                    value={v}
                    onChange={(e) => {
                      const next = [...rowPitches];
                      // garante tamanho
                      while (next.length < rows) next.push(v);
                      next[i] = Number(e.target.value);
                      setPhysical({ rowFinPitchesMm: next });
                    }}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
                  >
                    {FIN_PITCH_TOOLS_MM.map((p) => (
                      <option key={p} value={p}>
                        {p.toFixed(1)} mm
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FinPitchSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const current = snapFinPitchToTool(value ?? 2.5);
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span
        className="truncate text-[10px] font-medium text-slate-700"
        title={label}
      >
        {label}
      </span>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-[11px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        title={disabled ? "Defina o passo por fila no painel abaixo" : undefined}
      >
        {FIN_PITCH_TOOLS_MM.map((p) => (
          <option key={p} value={p}>
            {p.toFixed(1)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
  min,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  const displayValue =
    value === undefined || value === null || !Number.isFinite(value)
      ? ""
      : value;
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span
        className="truncate text-[10px] font-medium text-slate-700"
        title={label}
      >
        {label}
      </span>
      <input
        type="number"
        value={displayValue}
        step={step ?? "any"}
        min={min}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-[11px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
      />
    </label>
  );
}
