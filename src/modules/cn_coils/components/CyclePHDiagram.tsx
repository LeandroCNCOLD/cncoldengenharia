import { useMemo, useState, useRef } from "react";
import type { CycleResult, CycleStatePoint } from "../engines/cycle/cycleTypes";

interface Props {
  result: CycleResult;
  refrigerantId: string;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const POINT_LABELS: Record<number, { name: string; description: string }> = {
  0: { name: "Ponto 1 — Saída do Evaporador", description: "Vapor superaquecido" },
  1: { name: "Ponto 2 — Saída do Compressor", description: "Vapor de descarga (alta T/P)" },
  2: { name: "Ponto 3 — Saída do Condensador", description: "Líquido sub-resfriado" },
  3: { name: "Ponto 4 — Saída da Válvula", description: "Mistura líquido-vapor" },
};

const PHASE_LABEL: Record<CycleStatePoint["phase"], string> = {
  liquid: "Líquido",
  vapor: "Vapor",
  two_phase: "Bifásico",
  superheated: "Superaquecido",
  subcooled: "Sub-resfriado",
};

export function CyclePHDiagram({
  result,
  refrigerantId,
  width = 600,
  height = 380,
}: Props) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; h: number; p: number } | null>(null);
  const [showGuides, setShowGuides] = useState(true);

  const { point1_evapOut, point2_compOut, point3_condOut, point4_valveOut } =
    result.statePoints;
  const points = [point1_evapOut, point2_compOut, point3_condOut, point4_valveOut];
  const hValues = points.map((p) => p.h_kJkg);
  const pValues = points.map((p) => p.P_kPa);
  const hMin = Math.min(...hValues) * 0.95;
  const hMax = Math.max(...hValues) * 1.05;
  const pMin = Math.max(1, Math.min(...pValues) * 0.7);
  const pMax = Math.max(...pValues) * 1.3;

  const scaleH = useMemo(
    () => (h: number) => ((h - hMin) / Math.max(hMax - hMin, 1e-6)) * innerW,
    [hMin, hMax, innerW],
  );
  const scaleP = useMemo(
    () => (p: number) => {
      const logMin = Math.log10(pMin);
      const logMax = Math.log10(pMax);
      return (
        innerH -
        ((Math.log10(Math.max(p, 1e-6)) - logMin) /
          Math.max(logMax - logMin, 1e-6)) *
          innerH
      );
    },
    [pMin, pMax, innerH],
  );

  const invertX = (x: number) =>
    hMin + (x / Math.max(innerW, 1)) * (hMax - hMin);
  const invertY = (y: number) => {
    const logMin = Math.log10(pMin);
    const logMax = Math.log10(pMax);
    const frac = 1 - y / Math.max(innerH, 1);
    return Math.pow(10, logMin + frac * (logMax - logMin));
  };

  const colors = {
    evaporation: "#3b82f6",
    compression: "#ef4444",
    condensation: "#f97316",
    expansion: "#8b5cf6",
  };

  const cycleLines = [
    { from: point4_valveOut, to: point1_evapOut, color: colors.evaporation, label: "Evaporação", dashed: false },
    { from: point1_evapOut, to: point2_compOut, color: colors.compression, label: "Compressão", dashed: false },
    { from: point2_compOut, to: point3_condOut, color: colors.condensation, label: "Condensação", dashed: false },
    { from: point3_condOut, to: point4_valveOut, color: colors.expansion, label: "Expansão", dashed: true },
  ];

  const pGridValues = useMemo(() => {
    const vals: number[] = [];
    let p = Math.pow(10, Math.ceil(Math.log10(pMin)));
    while (p <= pMax) {
      vals.push(p);
      p *= 2;
    }
    return vals;
  }, [pMin, pMax]);

  const hGridValues = useMemo(() => {
    const ticks: number[] = [];
    const step = Math.max(10, Math.round((hMax - hMin) / 6 / 10) * 10);
    for (let h = Math.ceil(hMin / step) * step; h <= hMax; h += step) {
      ticks.push(h);
    }
    return ticks;
  }, [hMin, hMax]);

  const pointColor = (i: number) =>
    i === 0 ? colors.evaporation : i === 1 ? colors.compression : i === 2 ? colors.condensation : colors.expansion;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursor({ x, y, h: invertX(x), p: invertY(y) });
  };

  // tooltip position helper for a point
  const renderPointTooltip = (idx: number) => {
    const pt = points[idx];
    const cx = scaleH(pt.h_kJkg);
    const cy = scaleP(pt.P_kPa);
    const tipW = 168;
    const tipH = 92;
    const flipX = cx + tipW + 12 > innerW;
    const flipY = cy - tipH - 12 < 0;
    const tx = flipX ? cx - tipW - 12 : cx + 12;
    const ty = flipY ? cy + 12 : cy - tipH - 12;
    const meta = POINT_LABELS[idx];
    return (
      <g pointerEvents="none">
        <rect
          x={tx}
          y={ty}
          width={tipW}
          height={tipH}
          rx={6}
          fill="rgba(15,23,42,0.96)"
          stroke={pointColor(idx)}
          strokeWidth={1}
        />
        <text x={tx + 8} y={ty + 14} fontSize={10} fontWeight="bold" fill="white">
          {meta.name}
        </text>
        <text x={tx + 8} y={ty + 27} fontSize={9} fill="#94a3b8">
          {meta.description} · {PHASE_LABEL[pt.phase]}
        </text>
        <text x={tx + 8} y={ty + 43} fontSize={10} fill="#e5e7eb">
          T = <tspan fontWeight="bold">{fmt(pt.T_C, 1)} °C</tspan>
        </text>
        <text x={tx + 8} y={ty + 56} fontSize={10} fill="#e5e7eb">
          P = <tspan fontWeight="bold">{pt.P_kPa >= 1000 ? `${fmt(pt.P_kPa / 1000, 2)} MPa` : `${fmt(pt.P_kPa, 1)} kPa`}</tspan>
        </text>
        <text x={tx + 8} y={ty + 69} fontSize={10} fill="#e5e7eb">
          h = <tspan fontWeight="bold">{fmt(pt.h_kJkg, 1)} kJ/kg</tspan>
        </text>
        <text x={tx + 8} y={ty + 82} fontSize={10} fill="#e5e7eb">
          s = <tspan fontWeight="bold">{fmt(pt.s_kJkgK, 3)} kJ/kg·K</tspan>
        </text>
      </g>
    );
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <div className="text-xs text-gray-400">
          Passe o mouse pelos pontos para ver os detalhes
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(e) => setShowGuides(e.target.checked)}
            className="h-3 w-3 accent-blue-500"
          />
          Linhas-guia
        </label>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Diagrama P-h do ciclo de refrigeração com ${refrigerantId}`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {pGridValues.map((p) => (
            <g key={`pg-${p}`}>
              <line x1={0} y1={scaleP(p)} x2={innerW} y2={scaleP(p)} stroke="#374151" strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={-8} y={scaleP(p) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                {p >= 1000 ? `${fmt(p / 1000, 1)}MPa` : `${fmt(p, 0)}kPa`}
              </text>
            </g>
          ))}
          {hGridValues.map((h) => (
            <line key={`hg-${h}`} x1={scaleH(h)} y1={0} x2={scaleH(h)} y2={innerH} stroke="#374151" strokeWidth={0.5} strokeDasharray="2,4" opacity={0.5} />
          ))}

          {cycleLines.map((line) => (
            <line
              key={line.label}
              x1={scaleH(line.from.h_kJkg)}
              y1={scaleP(line.from.P_kPa)}
              x2={scaleH(line.to.h_kJkg)}
              y2={scaleP(line.to.P_kPa)}
              stroke={line.color}
              strokeWidth={2.5}
              strokeDasharray={line.dashed ? "6,3" : undefined}
            />
          ))}

          {showGuides && (
            <>
              <line x1={0} y1={scaleP(point1_evapOut.P_kPa)} x2={innerW} y2={scaleP(point1_evapOut.P_kPa)} stroke={colors.evaporation} strokeWidth={1} strokeDasharray="8,4" opacity={0.35} />
              <line x1={0} y1={scaleP(point2_compOut.P_kPa)} x2={innerW} y2={scaleP(point2_compOut.P_kPa)} stroke={colors.condensation} strokeWidth={1} strokeDasharray="8,4" opacity={0.35} />
            </>
          )}

          {points.map((pt, i) => {
            const cx = scaleH(pt.h_kJkg);
            const cy = scaleP(pt.P_kPa);
            const active = hoveredIdx === i;
            return (
              <g key={i}>
                <text x={cx + 9} y={cy - 8} fontSize={11} fontWeight="bold" fill="white">
                  {i + 1}
                </text>
                <text x={cx + 9} y={cy + 4} fontSize={9} fill="#9ca3af">
                  {fmt(pt.T_C, 1)}°C
                </text>
                <circle cx={cx} cy={cy} r={active ? 8 : 6} fill={pointColor(i)} stroke="white" strokeWidth={active ? 2.5 : 1.5} />
                {/* hit area */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={14}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx((cur) => (cur === i ? null : cur))}
                />
              </g>
            );
          })}

          {/* axes */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#6b7280" />
          <text x={innerW / 2} y={innerH + 38} textAnchor="middle" fontSize={11} fill="#9ca3af">
            Entalpia específica (kJ/kg)
          </text>
          {hGridValues.map((h, i) => (
            <g key={`hx-${i}`}>
              <line x1={scaleH(h)} y1={innerH} x2={scaleH(h)} y2={innerH + 5} stroke="#6b7280" />
              <text x={scaleH(h)} y={innerH + 18} textAnchor="middle" fontSize={10} fill="#9ca3af">
                {fmt(h, 0)}
              </text>
            </g>
          ))}

          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#6b7280" />
          <text x={-innerH / 2} y={-45} textAnchor="middle" fontSize={11} fill="#9ca3af" transform="rotate(-90)">
            Pressão (kPa) — escala log
          </text>

          {cycleLines.map((line, i) => (
            <g key={`lg-${line.label}`} transform={`translate(${innerW - 130}, ${10 + i * 18})`}>
              <line x1={0} y1={7} x2={18} y2={7} stroke={line.color} strokeWidth={2} strokeDasharray={line.dashed ? "4,2" : undefined} />
              <text x={22} y={11} fontSize={10} fill="#d1d5db">
                {line.label}
              </text>
            </g>
          ))}

          <text x={innerW / 2} y={-12} textAnchor="middle" fontSize={12} fontWeight="bold" fill="white">
            Diagrama P-h — {refrigerantId}
          </text>

          {/* Crosshair */}
          {cursor && hoveredIdx === null && (
            <g pointerEvents="none">
              <line x1={cursor.x} y1={0} x2={cursor.x} y2={innerH} stroke="#64748b" strokeWidth={0.8} strokeDasharray="3,3" />
              <line x1={0} y1={cursor.y} x2={innerW} y2={cursor.y} stroke="#64748b" strokeWidth={0.8} strokeDasharray="3,3" />
              <rect x={cursor.x + 8} y={cursor.y - 28} width={130} height={32} rx={4} fill="rgba(15,23,42,0.92)" stroke="#334155" />
              <text x={cursor.x + 14} y={cursor.y - 14} fontSize={10} fill="#e5e7eb">
                h = {fmt(cursor.h, 1)} kJ/kg
              </text>
              <text x={cursor.x + 14} y={cursor.y - 2} fontSize={10} fill="#e5e7eb">
                P = {cursor.p >= 1000 ? `${fmt(cursor.p / 1000, 2)} MPa` : `${fmt(cursor.p, 1)} kPa`}
              </text>
            </g>
          )}

          {/* Tracking rect */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursor(null)}
          />

          {/* Tooltip on top */}
          {hoveredIdx !== null && renderPointTooltip(hoveredIdx)}
        </g>
      </svg>

      <div className="mt-2 grid grid-cols-4 gap-2 px-2">
        {[
          { label: "Te", value: `${fmt(result.Te_C, 1)}°C`, color: "text-blue-400" },
          { label: "Tc", value: `${fmt(result.Tc_C, 1)}°C`, color: "text-orange-400" },
          { label: "COP", value: fmt(result.COP, 2), color: "text-green-400" },
          { label: "EER", value: fmt(result.EER, 2), color: "text-purple-400" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-900 py-2 text-center">
            <div className="text-xs text-gray-500">{item.label}</div>
            <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Detailed point table */}
      <div className="mt-2 overflow-x-auto px-2">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="py-1 text-left font-medium">Ponto</th>
              <th className="py-1 text-right font-medium">T (°C)</th>
              <th className="py-1 text-right font-medium">P (kPa)</th>
              <th className="py-1 text-right font-medium">h (kJ/kg)</th>
              <th className="py-1 text-right font-medium">s (kJ/kg·K)</th>
              <th className="py-1 text-left font-medium pl-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {points.map((pt, i) => (
              <tr
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx((cur) => (cur === i ? null : cur))}
                className={`border-b border-gray-900 transition-colors ${
                  hoveredIdx === i ? "bg-gray-900" : ""
                }`}
              >
                <td className="py-1 text-left">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: pointColor(i) }} />
                    <span className="text-gray-200">{i + 1}</span>
                  </span>
                </td>
                <td className="py-1 text-right text-gray-200">{fmt(pt.T_C, 1)}</td>
                <td className="py-1 text-right text-gray-200">{fmt(pt.P_kPa, 1)}</td>
                <td className="py-1 text-right text-gray-200">{fmt(pt.h_kJkg, 1)}</td>
                <td className="py-1 text-right text-gray-200">{fmt(pt.s_kJkgK, 3)}</td>
                <td className="py-1 text-left pl-2 text-gray-400">{PHASE_LABEL[pt.phase]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
