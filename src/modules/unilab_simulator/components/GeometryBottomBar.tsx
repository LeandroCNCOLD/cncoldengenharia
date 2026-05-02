import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";

/**
 * GeometryBottomBar — Etapa 3.5
 *
 * Barra horizontal fixa no rodapé da área de trabalho com os parâmetros
 * numéricos da geometria. Os campos `Passo da Aleta` e dimensões de tubo são
 * herdados automaticamente da geometria selecionada (ver store). O usuário
 * pode sobrescrever manualmente.
 */
export function GeometryBottomBar() {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const setPhysical = useUnilabSimulationStore((s) => s.setPhysicalInputs);

  // tubesPerRow não existe no schema do motor — derivamos via altura/pitch
  // e mantemos como override armazenado em physicalInputs.finnedHeightMm
  const tubesPerRow =
    physical.finnedHeightMm && physical.tubePitchTransverseMm
      ? Math.max(1, Math.round(physical.finnedHeightMm / physical.tubePitchTransverseMm))
      : 0;

  const setTubesPerRow = (n: number) => {
    if (n > 0 && physical.tubePitchTransverseMm) {
      setPhysical({ finnedHeightMm: n * physical.tubePitchTransverseMm });
    }
  };

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-300 bg-[#1E6FD9] px-3 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-white">
        Geometria — Parâmetros Numéricos
      </div>
      <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-7">
        <Field
          label="Nº Tubos por fila"
          value={tubesPerRow}
          onChange={setTubesPerRow}
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
        <Field
          label="Passo da Aleta (mm)"
          value={physical.finPitchMm}
          onChange={(v) => setPhysical({ finPitchMm: v })}
          step={0.1}
          min={0}
        />
        <Field
          label="Nº Tubos não utilizados"
          value={(physical as { unusedTubes?: number }).unusedTubes}
          onChange={(v) =>
            setPhysical({ ...(physical as object), unusedTubes: v } as never)
          }
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
          value={(physical as { dividers?: number }).dividers}
          onChange={(v) =>
            setPhysical({ ...(physical as object), dividers: v } as never)
          }
          step={1}
          min={0}
        />
      </div>
    </div>
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
        value={Number.isFinite(value) ? value : ""}
        step={step ?? "any"}
        min={min}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-[11px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
      />
    </label>
  );
}
