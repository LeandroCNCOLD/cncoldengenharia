import { useCnCoilsSimulationStore } from "../store/useUnilabSimulationStore";

/**
 * Esquema visual simples (SVG) da serpentina, baseado em:
 *  - rows                  (nº de fileiras)
 *  - tubesPerRow           (derivado de finnedHeightMm / tubePitchTransverseMm)
 *  - tubeOuterDiameterMm   (apenas para escala visual)
 *
 * Sem cálculo termodinâmico. Puramente ilustrativo, atualiza em tempo real
 * conforme o usuário muda valores na barra inferior ou seleciona geometria.
 */
export function CoilSchematic() {
  const physical = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const selected = useCnCoilsSimulationStore((s) => s.selectedGeometry);

  const rows = Math.max(0, Math.min(20, Math.round(physical.rows ?? 0)));
  const tubesPerRow =
    physical.finnedHeightMm && physical.tubePitchTransverseMm
      ? Math.max(
          0,
          Math.min(
            40,
            Math.round(physical.finnedHeightMm / physical.tubePitchTransverseMm),
          ),
        )
      : 0;

  const hasData = rows > 0 && tubesPerRow > 0;

  // Layout
  const padding = 24;
  const width = 360;
  const height = 220;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const cx = (i: number) =>
    padding + (rows > 1 ? (i * innerW) / (rows - 1) : innerW / 2);
  const cy = (j: number) =>
    padding + (tubesPerRow > 1 ? (j * innerH) / (tubesPerRow - 1) : innerH / 2);
  const r = hasData
    ? Math.max(2, Math.min(8, innerW / (rows * 2.5), innerH / (tubesPerRow * 2.5)))
    : 4;

  return (
    <div className="rounded border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-[#1E6FD9] px-3 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-white">
        Esquema da Serpentina
      </div>
      <div className="flex flex-col items-center gap-2 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full max-w-[360px]"
          role="img"
          aria-label="Esquema da serpentina"
        >
          {/* moldura: comprimento aletado x altura */}
          <rect
            x={padding - 8}
            y={padding - 8}
            width={innerW + 16}
            height={innerH + 16}
            rx={4}
            fill="#F1F5F9"
            stroke="#94A3B8"
            strokeDasharray="4 3"
          />
          {hasData ? (
            Array.from({ length: rows }).map((_, i) =>
              Array.from({ length: tubesPerRow }).map((__, j) => (
                <circle
                  key={`${i}-${j}`}
                  cx={cx(i)}
                  cy={cy(j)}
                  r={r}
                  fill="#1E6FD9"
                  stroke="#0F4FB0"
                  strokeWidth={0.5}
                />
              )),
            )
          ) : (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              className="fill-slate-400 text-[11px]"
            >
              Selecione a geometria
            </text>
          )}
        </svg>
        <div className="grid w-full grid-cols-3 gap-2 text-center text-[10px] text-slate-700">
          <div>
            <div className="font-mono text-sm text-slate-900">{rows || "—"}</div>
            <div className="text-slate-500">filas</div>
          </div>
          <div>
            <div className="font-mono text-sm text-slate-900">
              {tubesPerRow || "—"}
            </div>
            <div className="text-slate-500">tubos/fila</div>
          </div>
          <div>
            <div className="font-mono text-sm text-slate-900">
              {physical.tubeOuterDiameterMm
                ? `Ø ${physical.tubeOuterDiameterMm} mm`
                : "—"}
            </div>
            <div className="text-slate-500">tubo</div>
          </div>
        </div>
        {selected ? (
          <div className="w-full truncate text-center text-[10px] text-slate-500">
            <span className="font-mono">{selected.id}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
