/**
 * CyclePHDiagram — Diagrama Pressão-Entalpia (P-h) melhorado
 * ─────────────────────────────────────────────────────────────
 * Melhorias v2:
 *  - Cúpula de saturação desenhada a partir do saturation_tables.json
 *  - Zonas coloridas: líquido sub-resfriado, bifásico, vapor superaquecido
 *  - Linhas do ciclo com gradiente e setas de direção
 *  - Callouts nos pontos com valores T, P, h, s, x
 *  - Linhas de pressão constante (Te e Tc) com rótulos
 *  - Legenda integrada com COP, EER, Q_evap, W_comp
 *  - Crosshair interativo com leitura de h e P
 *  - Tabela de estados expandida com qualidade x
 */

import { useMemo, useState, useRef, useEffect } from "react";
import type { CycleResult, CycleStatePoint } from "../engines/cycle/cycleTypes";

interface SatPoint {
  T_C: number;
  P_kPa: number;
  h_f_kJkg: number;
  h_g_kJkg: number;
}

interface Props {
  result: CycleResult;
  refrigerantId: string;
  width?: number;
  height?: number;
}

const MARGIN = { top: 40, right: 40, bottom: 56, left: 68 };

function fmt(n: number | undefined | null, digits = 1, fallback = "—"): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const POINT_META: Record<number, { name: string; desc: string; color: string }> = {
  0: { name: "1 — Saída Evaporador", desc: "Vapor superaquecido", color: "#3b82f6" },
  1: { name: "2 — Saída Compressor", desc: "Vapor descarga (alta P)", color: "#ef4444" },
  2: { name: "3 — Saída Condensador", desc: "Líquido sub-resfriado", color: "#f97316" },
  3: { name: "4 — Saída Válvula", desc: "Mistura líquido-vapor", color: "#8b5cf6" },
};

const PHASE_LABEL: Record<CycleStatePoint["phase"], string> = {
  liquid: "Líquido",
  vapor: "Vapor",
  two_phase: "Bifásico",
  superheated: "Superaquecido",
  subcooled: "Sub-resfriado",
};

// Mapeamento de IDs internos para chaves do JSON
const REFRIG_KEY_MAP: Record<string, string> = {
  REF_R404A: "R404A",
  REF_R410A: "R410A",
  REF_R22: "R22",
  REF_R134A: "R134a",
  REF_R407C: "R407C",
  REF_R507A: "R507A",
  REF_R448A: "R448A",
  REF_R449A: "R449A",
  REF_R717: "R717",
  REF_R744: "R744",
  REF_R290: "R290",
};

function resolveRefrigKey(id: string): string {
  return REFRIG_KEY_MAP[id] ?? id;
}

// Hook para carregar a tabela de saturação do JSON
function useSaturationCurve(refrigerantId: string): SatPoint[] {
  const [points, setPoints] = useState<SatPoint[]>([]);
  useEffect(() => {
    const key = resolveRefrigKey(refrigerantId);
    fetch("/data/refrigerants/saturation_tables.json")
      .then((r) => r.json())
      .then((data) => {
        const rows: SatPoint[] = (data[key] ?? []).map((p: Record<string, number>) => ({
          T_C: p.T_C,
          P_kPa: p.P_kPa,
          h_f_kJkg: p.h_f_kJkg,
          h_g_kJkg: p.h_g_kJkg,
        }));
        setPoints(rows);
      })
      .catch(() => setPoints([]));
  }, [refrigerantId]);
  return points;
}

export function CyclePHDiagram({
  result,
  refrigerantId,
  width = 700,
  height = 420,
}: Props) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; h: number; p: number } | null>(null);
  const [showDome, setShowDome] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showGuides, setShowGuides] = useState(true);

  const satPoints = useSaturationCurve(refrigerantId);

  const { point1_evapOut, point2_compOut, point3_condOut, point4_valveOut } =
    result.statePoints;
  const cyclePoints = [point1_evapOut, point2_compOut, point3_condOut, point4_valveOut];

  // Calcular limites do diagrama
  const hValues = cyclePoints.map((p) => p.h_kJkg);
  const pValues = cyclePoints.map((p) => p.P_kPa);

  // Incluir a cúpula nos limites
  const satHValues = satPoints.flatMap((p) => [p.h_f_kJkg, p.h_g_kJkg]);
  const satPValues = satPoints.map((p) => p.P_kPa);

  const allH = [...hValues, ...satHValues];
  const allP = [...pValues, ...satPValues];

  const hMin = allH.length > 0 ? Math.min(...allH) * 0.92 : Math.min(...hValues) * 0.92;
  const hMax = allH.length > 0 ? Math.max(...allH) * 1.08 : Math.max(...hValues) * 1.08;
  const pMin = Math.max(1, (allP.length > 0 ? Math.min(...allP) : Math.min(...pValues)) * 0.6);
  const pMax = (allP.length > 0 ? Math.max(...allP) : Math.max(...pValues)) * 1.4;

  const scaleH = useMemo(
    () => (h: number) => ((h - hMin) / Math.max(hMax - hMin, 1e-6)) * innerW,
    [hMin, hMax, innerW],
  );
  const scaleP = useMemo(
    () => (p: number) => {
      const logMin = Math.log10(pMin);
      const logMax = Math.log10(pMax);
      return innerH - ((Math.log10(Math.max(p, 1e-6)) - logMin) / Math.max(logMax - logMin, 1e-6)) * innerH;
    },
    [pMin, pMax, innerH],
  );

  const invertX = (x: number) => hMin + (x / Math.max(innerW, 1)) * (hMax - hMin);
  const invertY = (y: number) => {
    const logMin = Math.log10(pMin);
    const logMax = Math.log10(pMax);
    const frac = 1 - y / Math.max(innerH, 1);
    return Math.pow(10, logMin + frac * (logMax - logMin));
  };

  // Construir o path da cúpula de saturação
  const domePath = useMemo(() => {
    if (satPoints.length < 2) return null;
    // Linha de líquido saturado (bolha) — da esquerda para a direita
    const bubblePts = satPoints.map((p) => ({ x: scaleH(p.h_f_kJkg), y: scaleP(p.P_kPa) }));
    // Linha de vapor saturado (orvalho) — da direita para a esquerda
    const dewPts = [...satPoints].reverse().map((p) => ({ x: scaleH(p.h_g_kJkg), y: scaleP(p.P_kPa) }));

    const toPath = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    return {
      bubble: toPath(bubblePts),
      dew: toPath(dewPts),
      fill: toPath(bubblePts) + " " + toPath(dewPts) + " Z",
      // Ponto crítico (topo da cúpula — maior P)
      criticalX: scaleH((satPoints[satPoints.length - 1].h_f_kJkg + satPoints[satPoints.length - 1].h_g_kJkg) / 2),
      criticalY: scaleP(satPoints[satPoints.length - 1].P_kPa),
    };
  }, [satPoints, scaleH, scaleP]);

  // Grid de pressão (escala log)
  const pGridValues = useMemo(() => {
    const vals: number[] = [];
    const logMin = Math.log10(pMin);
    const logMax = Math.log10(pMax);
    const steps = Math.ceil(logMax) - Math.floor(logMin);
    for (let i = Math.floor(logMin); i <= Math.ceil(logMax); i++) {
      const base = Math.pow(10, i);
      [1, 2, 5].forEach((mult) => {
        const v = base * mult;
        if (v >= pMin && v <= pMax) vals.push(v);
      });
    }
    return [...new Set(vals)].sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pMin, pMax]);

  // Grid de entalpia
  const hGridValues = useMemo(() => {
    const ticks: number[] = [];
    const range = hMax - hMin;
    const step = range > 200 ? 50 : range > 100 ? 20 : 10;
    for (let h = Math.ceil(hMin / step) * step; h <= hMax; h += step) {
      ticks.push(h);
    }
    return ticks;
  }, [hMin, hMax]);

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursor({ x, y, h: invertX(x), p: invertY(y) });
  };

  // Renderizar callout de um ponto
  const renderCallout = (idx: number) => {
    const pt = cyclePoints[idx];
    const meta = POINT_META[idx];
    const cx = scaleH(pt.h_kJkg);
    const cy = scaleP(pt.P_kPa);
    const tipW = 172;
    const tipH = 100;
    const flipX = cx + tipW + 16 > innerW;
    const flipY = cy - tipH - 16 < 0;
    const tx = flipX ? cx - tipW - 14 : cx + 14;
    const ty = flipY ? cy + 14 : cy - tipH - 14;
    return (
      <g key={`callout-${idx}`} pointerEvents="none">
        {/* Linha conectora */}
        <line
          x1={cx}
          y1={cy}
          x2={flipX ? tx + tipW : tx}
          y2={flipY ? ty : ty + tipH}
          stroke={meta.color}
          strokeWidth={1}
          strokeDasharray="3,2"
          opacity={0.7}
        />
        {/* Box */}
        <rect x={tx} y={ty} width={tipW} height={tipH} rx={5} fill="rgba(2,6,23,0.97)" stroke={meta.color} strokeWidth={1.5} />
        {/* Título */}
        <rect x={tx} y={ty} width={tipW} height={18} rx={5} fill={meta.color} opacity={0.9} />
        <rect x={tx} y={ty + 13} width={tipW} height={5} fill={meta.color} opacity={0.9} />
        <text x={tx + 6} y={ty + 12} fontSize={9.5} fontWeight="bold" fill="white">{meta.name}</text>
        <text x={tx + 6} y={ty + 27} fontSize={8.5} fill="#94a3b8">{meta.desc} · {PHASE_LABEL[pt.phase]}</text>
        <text x={tx + 6} y={ty + 42} fontSize={10} fill="#e2e8f0">
          {idx === 1 ? "T_desc" : "T"} = <tspan fontWeight="bold" fill={idx === 1 ? "#fca5a5" : "white"}>{fmt(pt.T_C, 1)} °C</tspan>
          {idx === 1 && <tspan fontSize={8} fill="#6b7280"> (descarga)</tspan>}
        </text>
        <text x={tx + 6} y={ty + 56} fontSize={10} fill="#e2e8f0">P = <tspan fontWeight="bold" fill="white">{pt.P_kPa >= 1000 ? `${fmt(pt.P_kPa / 1000, 3)} MPa` : `${fmt(pt.P_kPa, 1)} kPa`}</tspan></text>
        <text x={tx + 6} y={ty + 70} fontSize={10} fill="#e2e8f0">h = <tspan fontWeight="bold" fill="white">{fmt(pt.h_kJkg, 2)} kJ/kg</tspan></text>
        <text x={tx + 6} y={ty + 84} fontSize={10} fill="#e2e8f0">s = <tspan fontWeight="bold" fill="white">{fmt(pt.s_kJkgK, 4)} kJ/kg·K</tspan></text>
        {pt.quality >= 0 && pt.quality <= 1 && (
          <text x={tx + 90} y={ty + 84} fontSize={10} fill="#e2e8f0">x = <tspan fontWeight="bold" fill="#fbbf24">{fmt(pt.quality, 3)}</tspan></text>
        )}
      </g>
    );
  };

  // Linhas do ciclo com setas
  const cycleSegments = [
    { from: point4_valveOut, to: point1_evapOut, color: "#3b82f6", label: "Evaporação", dashed: false, labelPos: 0.5 },
    { from: point1_evapOut, to: point2_compOut, color: "#ef4444", label: "Compressão", dashed: false, labelPos: 0.5 },
    { from: point2_compOut, to: point3_condOut, color: "#f97316", label: "Condensação", dashed: false, labelPos: 0.5 },
    { from: point3_condOut, to: point4_valveOut, color: "#8b5cf6", label: "Expansão", dashed: true, labelPos: 0.5 },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">Diagrama P-h — {resolveRefrigKey(refrigerantId)}</span>
          <span className="text-xs text-gray-400">Escala logarítmica em P</span>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: "Cúpula", state: showDome, set: setShowDome },
            { label: "Zonas", state: showZones, set: setShowZones },
            { label: "Guias", state: showGuides, set: setShowGuides },
          ].map(({ label, state, set }) => (
            <label key={label} className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={state} onChange={(e) => set(e.target.checked)} className="h-3 w-3 accent-blue-500" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Diagrama P-h — ${refrigerantId}`}
      >
        <defs>
          {/* Gradientes para zonas */}
          <linearGradient id="zoneSubcooled" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#1e40af" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#1e40af" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="zoneTwoPhase" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.10} />
          </linearGradient>
          <linearGradient id="zoneSuperheated" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.18} />
          </linearGradient>
          {/* Seta para linhas do ciclo */}
          {cycleSegments.map((seg, i) => (
            <marker key={`arrow-${i}`} id={`arrow-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={seg.color} opacity={0.9} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* ── Fundo escuro ── */}
          <rect x={0} y={0} width={innerW} height={innerH} fill="#0f172a" rx={2} />

          {/* ── Grid de pressão ── */}
          {pGridValues.map((p) => (
            <g key={`pg-${p}`}>
              <line x1={0} y1={scaleP(p)} x2={innerW} y2={scaleP(p)} stroke="#1e293b" strokeWidth={0.8} />
              <text x={-6} y={scaleP(p) + 4} textAnchor="end" fontSize={9.5} fill="#64748b">
                {p >= 1000 ? `${(p / 1000).toFixed(p >= 10000 ? 0 : 1)}M` : `${p >= 100 ? Math.round(p) : p.toFixed(0)}`}
              </text>
            </g>
          ))}

          {/* ── Grid de entalpia ── */}
          {hGridValues.map((h) => (
            <g key={`hg-${h}`}>
              <line x1={scaleH(h)} y1={0} x2={scaleH(h)} y2={innerH} stroke="#1e293b" strokeWidth={0.8} />
            </g>
          ))}

          {/* ── Zonas coloridas ── */}
          {showZones && domePath && satPoints.length >= 2 && (() => {
            const hfMin = scaleH(satPoints[0].h_f_kJkg);
            const hgMax = scaleH(satPoints[satPoints.length - 1].h_g_kJkg);
            const hfMax = scaleH(satPoints[satPoints.length - 1].h_f_kJkg);
            return (
              <>
                {/* Sub-resfriado: esquerda da linha de bolha */}
                <rect x={0} y={0} width={hfMin} height={innerH} fill="url(#zoneSubcooled)" />
                {/* Bifásico: entre bolha e orvalho */}
                <rect x={hfMax} y={0} width={Math.max(0, hgMax - hfMax)} height={innerH} fill="url(#zoneTwoPhase)" />
                {/* Superaquecido: direita da linha de orvalho */}
                <rect x={hgMax} y={0} width={Math.max(0, innerW - hgMax)} height={innerH} fill="url(#zoneSuperheated)" />
                {/* Rótulos das zonas */}
                <text x={hfMin / 2} y={innerH - 8} textAnchor="middle" fontSize={9} fill="#3b82f6" opacity={0.7} fontStyle="italic">Sub-resfriado</text>
                <text x={(hfMax + hgMax) / 2} y={innerH - 8} textAnchor="middle" fontSize={9} fill="#0ea5e9" opacity={0.7} fontStyle="italic">Bifásico</text>
                <text x={(hgMax + innerW) / 2} y={innerH - 8} textAnchor="middle" fontSize={9} fill="#ef4444" opacity={0.7} fontStyle="italic">Superaquecido</text>
              </>
            );
          })()}

          {/* ── Cúpula de saturação ── */}
          {showDome && domePath && (
            <g>
              {/* Preenchimento da cúpula */}
              <path d={domePath.fill} fill="#0ea5e9" fillOpacity={0.06} />
              {/* Linha de bolha (líquido saturado) */}
              <path d={domePath.bubble} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />
              {/* Linha de orvalho (vapor saturado) */}
              <path d={domePath.dew} fill="none" stroke="#7dd3fc" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />
              {/* Ponto crítico */}
              <circle cx={domePath.criticalX} cy={domePath.criticalY} r={3} fill="#38bdf8" opacity={0.8} />
              <text x={domePath.criticalX + 5} y={domePath.criticalY - 5} fontSize={8.5} fill="#38bdf8" opacity={0.8}>Pc</text>
            </g>
          )}

          {/* ── Linhas de pressão constante (Te e Tc) ── */}
          {showGuides && (
            <>
              <line x1={0} y1={scaleP(point1_evapOut.P_kPa)} x2={innerW} y2={scaleP(point1_evapOut.P_kPa)}
                stroke="#3b82f6" strokeWidth={1} strokeDasharray="8,4" opacity={0.4} />
              <text x={4} y={scaleP(point1_evapOut.P_kPa) - 4} fontSize={9} fill="#3b82f6" opacity={0.8}>
                Pe = {fmt(point1_evapOut.P_kPa, 0)} kPa
              </text>
              <line x1={0} y1={scaleP(point2_compOut.P_kPa)} x2={innerW} y2={scaleP(point2_compOut.P_kPa)}
                stroke="#f97316" strokeWidth={1} strokeDasharray="8,4" opacity={0.4} />
              <text x={4} y={scaleP(point2_compOut.P_kPa) - 4} fontSize={9} fill="#f97316" opacity={0.8}>
                Pc = {fmt(point2_compOut.P_kPa, 0)} kPa
              </text>
            </>
          )}

          {/* ── Linhas do ciclo ── */}
          {cycleSegments.map((seg, i) => {
            const x1 = scaleH(seg.from.h_kJkg);
            const y1 = scaleP(seg.from.P_kPa);
            const x2 = scaleH(seg.to.h_kJkg);
            const y2 = scaleP(seg.to.P_kPa);
            // Ponto médio para a seta
            const mx = x1 + (x2 - x1) * 0.5;
            const my = y1 + (y2 - y1) * 0.5;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = len > 0 ? dx / len : 0;
            const ny = len > 0 ? dy / len : 0;
            const arrowLen = 12;
            return (
              <g key={`seg-${i}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={seg.color} strokeWidth={2.5}
                  strokeDasharray={seg.dashed ? "7,3" : undefined}
                  opacity={0.9} />
                {/* Seta no meio */}
                <line
                  x1={mx - nx * arrowLen / 2}
                  y1={my - ny * arrowLen / 2}
                  x2={mx + nx * arrowLen / 2}
                  y2={my + ny * arrowLen / 2}
                  stroke={seg.color}
                  strokeWidth={2}
                  markerEnd={`url(#arrow-${i})`}
                  opacity={0.85}
                />
              </g>
            );
          })}

          {/* ── Pontos do ciclo ── */}
          {cyclePoints.map((pt, i) => {
            const cx = scaleH(pt.h_kJkg);
            const cy = scaleP(pt.P_kPa);
            const meta = POINT_META[i];
            const active = hoveredIdx === i;
            return (
              <g key={`pt-${i}`}>
                {/* Halo */}
                {active && <circle cx={cx} cy={cy} r={14} fill={meta.color} opacity={0.15} />}
                {/* Ponto */}
                <circle cx={cx} cy={cy} r={active ? 8 : 6} fill={meta.color} stroke="white" strokeWidth={active ? 2.5 : 1.5} />
                {/* Número */}
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white" pointerEvents="none">{i + 1}</text>
                {/* Temperatura */}
                <text x={cx + 12} y={cy - 8} fontSize={9} fill={meta.color} fontWeight="600">{fmt(pt.T_C, 1)}°C</text>
                {/* Hit area */}
                <circle cx={cx} cy={cy} r={16} fill="transparent" style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx((cur) => cur === i ? null : cur)}
                />
              </g>
            );
          })}

          {/* ── Callouts ── */}
          {hoveredIdx !== null && renderCallout(hoveredIdx)}

          {/* ── Eixos ── */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#475569" strokeWidth={1} />
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#475569" strokeWidth={1} />

          {/* Rótulos eixo X */}
          {hGridValues.map((h) => (
            <g key={`hx-${h}`}>
              <line x1={scaleH(h)} y1={innerH} x2={scaleH(h)} y2={innerH + 5} stroke="#475569" />
              <text x={scaleH(h)} y={innerH + 17} textAnchor="middle" fontSize={9.5} fill="#94a3b8">{fmt(h, 0)}</text>
            </g>
          ))}
          <text x={innerW / 2} y={innerH + 38} textAnchor="middle" fontSize={11} fill="#94a3b8">
            Entalpia específica h (kJ/kg)
          </text>

          {/* Rótulo eixo Y */}
          <text x={-innerH / 2} y={-52} textAnchor="middle" fontSize={11} fill="#94a3b8" transform="rotate(-90)">
            Pressão P (kPa) — log
          </text>

          {/* ── Legenda ── */}
          <g transform={`translate(${innerW - 148}, 8)`}>
            <rect x={0} y={0} width={144} height={cycleSegments.length * 18 + 8} rx={4} fill="rgba(2,6,23,0.85)" stroke="#334155" />
            {cycleSegments.map((seg, i) => (
              <g key={`lg-${i}`} transform={`translate(6, ${8 + i * 18})`}>
                <line x1={0} y1={6} x2={18} y2={6} stroke={seg.color} strokeWidth={2} strokeDasharray={seg.dashed ? "4,2" : undefined} />
                <text x={22} y={10} fontSize={9.5} fill="#d1d5db">{seg.label}</text>
              </g>
            ))}
          </g>

          {/* ── Crosshair ── */}
          {cursor && hoveredIdx === null && (
            <g pointerEvents="none">
              <line x1={cursor.x} y1={0} x2={cursor.x} y2={innerH} stroke="#475569" strokeWidth={0.8} strokeDasharray="3,3" />
              <line x1={0} y1={cursor.y} x2={innerW} y2={cursor.y} stroke="#475569" strokeWidth={0.8} strokeDasharray="3,3" />
              <rect x={cursor.x + 8} y={cursor.y - 32} width={148} height={36} rx={4} fill="rgba(2,6,23,0.95)" stroke="#334155" />
              <text x={cursor.x + 14} y={cursor.y - 17} fontSize={10} fill="#e2e8f0">
                h = <tspan fontWeight="bold" fill="white">{fmt(cursor.h, 1)} kJ/kg</tspan>
              </text>
              <text x={cursor.x + 14} y={cursor.y - 3} fontSize={10} fill="#e2e8f0">
                P = <tspan fontWeight="bold" fill="white">{cursor.p >= 1000 ? `${fmt(cursor.p / 1000, 3)} MPa` : `${fmt(cursor.p, 1)} kPa`}</tspan>
              </text>
            </g>
          )}

          {/* Tracking rect */}
          <rect x={0} y={0} width={innerW} height={innerH} fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursor(null)}
          />
        </g>
      </svg>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900">
        {[
          { label: "Te", value: `${fmt(result.Te_C, 1)} °C`, sub: `Pe = ${fmt(point1_evapOut.P_kPa, 0)} kPa`, color: "text-blue-400" },
          { label: "Tc", value: `${fmt(result.Tc_C, 1)} °C`, sub: `Pc = ${fmt(point2_compOut.P_kPa, 0)} kPa`, color: "text-orange-400" },
          { label: "COP", value: fmt(result.COP, 2), sub: `EER = ${fmt(result.EER, 2)}`, color: "text-green-400" },
          { label: "Q_evap", value: `${fmt(result.Q_evap_W / 1000, 2)} kW`, sub: `W = ${fmt(result.W_comp_W / 1000, 2)} kW`, color: "text-purple-400" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-800 px-3 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</div>
            <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
            <div className="text-[10px] text-gray-500">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabela de estados ── */}
      <div className="overflow-x-auto px-4 pb-3">
        <p className="text-[10px] text-gray-500 mb-1">
          <span className="text-gray-400 font-medium">¹</span> Ponto 2: T = temperatura de descarga do compressor (vapor superaquecido). Tc = {fmt(result.Tc_C, 1)} °C é a temperatura de condensação (saturação).
        </p>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="py-1.5 text-left font-medium text-gray-400">Ponto</th>
              <th className="py-1.5 text-right font-medium text-gray-400">T (°C) <span className="text-[9px] text-gray-600 font-normal">¹</span></th>
              <th className="py-1.5 text-right font-medium text-gray-400">P (kPa)</th>
              <th className="py-1.5 text-right font-medium text-gray-400">h (kJ/kg)</th>
              <th className="py-1.5 text-right font-medium text-gray-400">s (kJ/kg·K)</th>
              <th className="py-1.5 text-right font-medium text-gray-400">x</th>
              <th className="py-1.5 text-left font-medium text-gray-400 pl-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cyclePoints.map((pt, i) => {
              const meta = POINT_META[i];
              return (
                <tr key={i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx((cur) => cur === i ? null : cur)}
                  className={`border-b border-gray-900 transition-colors cursor-pointer ${hoveredIdx === i ? "bg-gray-900" : "hover:bg-gray-900/50"}`}
                >
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                      <span className="text-gray-200 font-medium">{i + 1}</span>
                      <span className="text-gray-500 text-[10px]">{meta.name.split("—")[1]?.trim()}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-gray-200">{fmt(pt.T_C, 1)}</td>
                  <td className="py-1.5 text-right text-gray-200">{fmt(pt.P_kPa, 1)}</td>
                  <td className="py-1.5 text-right text-gray-200 font-medium">{fmt(pt.h_kJkg, 2)}</td>
                  <td className="py-1.5 text-right text-gray-400">{fmt(pt.s_kJkgK, 4)}</td>
                  <td className="py-1.5 text-right">
                    {pt.quality >= 0 && pt.quality <= 1
                      ? <span className="text-yellow-400 font-medium">{fmt(pt.quality, 3)}</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-1.5 text-left pl-3 text-gray-400">{PHASE_LABEL[pt.phase]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
