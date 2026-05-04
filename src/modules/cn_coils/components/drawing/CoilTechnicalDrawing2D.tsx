/**
 * CoilTechnicalDrawing2D
 * ----------------------
 * Desenho técnico 2D da serpentina em SVG puro.
 * Exibe:
 *   - Vista frontal (face do ar) com tubos em arranjo staggered/inline
 *   - Vista lateral (profundidade) com filas de tubos
 *   - Cotas dimensionais (altura, largura, profundidade, passo)
 *   - Zonas térmicas coloridas (gradiente frio→quente por fila)
 *   - Circuitagem simplificada (entrada/saída de refrigerante)
 *   - Legenda de cores e informações técnicas
 */

import { useMemo } from "react";
import type { CycleResult } from "../../engines/cycle/cycleTypes";

interface CoilDrawingInputs {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  rows: number;
  tubesPerRow: number;
  tubeOuterDiamMm: number;
  finPitchMm: number;
  circuits: number;
  refrigerantId: string;
  staggered?: boolean;
}

interface Props {
  inputs: CoilDrawingInputs;
  cycleResult?: CycleResult | null;
  showDimensions?: boolean;
  showCircuits?: boolean;
  showThermalZones?: boolean;
  className?: string;
}

// Paleta de zonas térmicas: azul frio → vermelho quente
const THERMAL_PALETTE = [
  "#1E6FD9", // fila 1 (saída do fluido — mais fria)
  "#2E8BC0",
  "#3AAFB9",
  "#4CAF50",
  "#8BC34A",
  "#CDDC39",
  "#FFC107",
  "#FF9800",
  "#FF5722",
  "#E53935", // última fila (entrada do fluido — mais quente)
];

function thermalColor(rowIndex: number, totalRows: number): string {
  if (totalRows <= 1) return THERMAL_PALETTE[0];
  const t = rowIndex / (totalRows - 1);
  const idx = Math.round(t * (THERMAL_PALETTE.length - 1));
  return THERMAL_PALETTE[Math.min(idx, THERMAL_PALETTE.length - 1)];
}

// Seta de cota
function DimensionArrow({
  x1, y1, x2, y2, label, offset = 18, horizontal = true,
}: {
  x1: number; y1: number; x2: number; y2: number;
  label: string; offset?: number; horizontal?: boolean;
}) {
  const arrowSize = 5;
  if (horizontal) {
    const y = y1 + offset;
    return (
      <g className="dimension">
        <line x1={x1} y1={y1} x2={x1} y2={y} stroke="#555" strokeWidth={0.5} strokeDasharray="2 2" />
        <line x1={x2} y1={y2} x2={x2} y2={y} stroke="#555" strokeWidth={0.5} strokeDasharray="2 2" />
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="#1E6FD9" strokeWidth={0.8} markerStart="url(#arrowStart)" markerEnd="url(#arrowEnd)" />
        <text x={(x1 + x2) / 2} y={y - 3} textAnchor="middle" fontSize={7} fill="#1E6FD9" fontFamily="monospace">{label}</text>
        <polygon points={`${x1},${y} ${x1 + arrowSize},${y - 2} ${x1 + arrowSize},${y + 2}`} fill="#1E6FD9" />
        <polygon points={`${x2},${y} ${x2 - arrowSize},${y - 2} ${x2 - arrowSize},${y + 2}`} fill="#1E6FD9" />
      </g>
    );
  }
  const x = x1 - offset;
  return (
    <g className="dimension">
      <line x1={x1} y1={y1} x2={x} y2={y1} stroke="#555" strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={x2} y1={y2} x2={x} y2={y2} stroke="#555" strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#1E6FD9" strokeWidth={0.8} />
      <text x={x - 3} y={(y1 + y2) / 2} textAnchor="middle" fontSize={7} fill="#1E6FD9" fontFamily="monospace"
        transform={`rotate(-90, ${x - 3}, ${(y1 + y2) / 2})`}>{label}</text>
      <polygon points={`${x},${y1} ${x - 2},${y1 + arrowSize} ${x + 2},${y1 + arrowSize}`} fill="#1E6FD9" />
      <polygon points={`${x},${y2} ${x - 2},${y2 - arrowSize} ${x + 2},${y2 - arrowSize}`} fill="#1E6FD9" />
    </g>
  );
}

export function CoilTechnicalDrawing2D({
  inputs,
  cycleResult,
  showDimensions = true,
  showCircuits = true,
  showThermalZones = true,
  className = "",
}: Props) {
  const {
    heightMm, widthMm, depthMm,
    rows, tubesPerRow, tubeOuterDiamMm,
    finPitchMm, circuits, refrigerantId, staggered = true,
  } = inputs;

  // ── Layout SVG ──────────────────────────────────────────────────────────────
  const SVG_W = 700;
  const SVG_H = 520;
  const MARGIN = { top: 40, left: 60, right: 40, bottom: 60 };

  // Vista frontal (face do ar): largura x altura
  const frontW = 280;
  const frontH = 200;
  const frontX = MARGIN.left;
  const frontY = MARGIN.top + 20;

  // Vista lateral (profundidade x altura)
  const sideW = 120;
  const sideH = frontH;
  const sideX = frontX + frontW + 40;
  const sideY = frontY;

  // Escala de tubos na vista frontal
  const tubePitchH = tubesPerRow > 1 ? frontH / tubesPerRow : frontH;
  const tubePitchV = rows > 1 ? frontW / rows : frontW;
  const tubeR = Math.max(2, Math.min(8, tubePitchH / 3, tubePitchV / 3));

  const frontTubes = useMemo(() => {
    const pts: { cx: number; cy: number; row: number; col: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let t = 0; t < tubesPerRow; t++) {
        const cx = frontX + (rows > 1 ? (r * frontW) / (rows - 1) : frontW / 2);
        const staggerOffset = staggered && r % 2 === 1 ? tubePitchH / 2 : 0;
        const cy = frontY + (tubesPerRow > 1 ? (t * frontH) / (tubesPerRow - 1) : frontH / 2) + staggerOffset;
        pts.push({ cx, cy, row: r, col: t });
      }
    }
    return pts;
  }, [rows, tubesPerRow, frontX, frontY, frontW, frontH, tubePitchH, staggered]);

  // Vista lateral: filas de tubos
  const sideTubes = useMemo(() => {
    const pts: { cx: number; cy: number; row: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const cx = sideX + (rows > 1 ? (r * sideW) / (rows - 1) : sideW / 2);
      for (let t = 0; t < tubesPerRow; t++) {
        const cy = sideY + (tubesPerRow > 1 ? (t * sideH) / (tubesPerRow - 1) : sideH / 2);
        pts.push({ cx, cy, row: r });
      }
    }
    return pts;
  }, [rows, tubesPerRow, sideX, sideY, sideW, sideH]);

  // Circuitagem: entrada e saída de refrigerante
  const circuitEntryX = frontX + frontW + 8;
  const circuitExitX = frontX - 8;

  // Informações do resultado
  const Te = cycleResult?.Te_C?.toFixed(1) ?? "—";
  const Tc = cycleResult?.Tc_C?.toFixed(1) ?? "—";
  const Q = cycleResult ? (cycleResult.Q_evap_W / 1000).toFixed(2) : "—";
  const U = cycleResult?.evaporatorResult?.overallU_WM2K?.toFixed(1) ?? "—";

  const legendY = frontY + frontH + 50;

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Cabeçalho */}
      <div className="bg-[#1E3A5F] px-4 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-bold tracking-wider uppercase">
          Desenho Técnico — Evaporador DX
        </span>
        <span className="text-blue-200 text-xs font-mono">
          {refrigerantId} | {heightMm}×{widthMm}×{depthMm} mm
        </span>
      </div>

      {/* SVG principal */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-auto"
        style={{ background: "#F8FAFC" }}
        role="img"
        aria-label="Desenho técnico 2D da serpentina"
      >
        <defs>
          <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#1E6FD9" />
          </marker>
          <marker id="arrowStart" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 Z" fill="#1E6FD9" />
          </marker>
          {/* Gradiente de zona térmica */}
          <linearGradient id="thermalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E6FD9" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#E53935" stopOpacity="0.15" />
          </linearGradient>
          {/* Padrão de aletas */}
          <pattern id="finPattern" x="0" y="0" width={finPitchMm > 0 ? Math.max(2, finPitchMm * 0.8) : 4} height="100%" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="9999" stroke="#CBD5E1" strokeWidth="0.4" />
          </pattern>
        </defs>

        {/* ── VISTA FRONTAL ─────────────────────────────────────────────── */}
        {/* Label */}
        <text x={frontX + frontW / 2} y={frontY - 8} textAnchor="middle" fontSize={8} fill="#64748B" fontFamily="monospace" fontWeight="bold">
          VISTA FRONTAL (face do ar)
        </text>

        {/* Fundo com padrão de aletas */}
        <rect x={frontX} y={frontY} width={frontW} height={frontH}
          fill="url(#finPattern)" stroke="#94A3B8" strokeWidth={1} rx={2} />

        {/* Zona térmica (gradiente) */}
        {showThermalZones && (
          <rect x={frontX} y={frontY} width={frontW} height={frontH}
            fill="url(#thermalGrad)" />
        )}

        {/* Tubos — vista frontal */}
        {frontTubes.map(({ cx, cy, row }) => (
          <g key={`f-${row}-${cy}`}>
            {/* Zona térmica individual por fila */}
            {showThermalZones && (
              <circle cx={cx} cy={cy} r={tubeR + 4}
                fill={thermalColor(row, rows)} opacity={0.25} />
            )}
            {/* Tubo */}
            <circle cx={cx} cy={cy} r={tubeR}
              fill="#E2E8F0" stroke={thermalColor(row, rows)} strokeWidth={1.2} />
            {/* Núcleo do tubo */}
            <circle cx={cx} cy={cy} r={tubeR * 0.45}
              fill={thermalColor(row, rows)} opacity={0.6} />
          </g>
        ))}

        {/* Circuitagem — entrada/saída de refrigerante */}
        {showCircuits && rows > 0 && tubesPerRow > 0 && (
          <>
            {/* Coletor de entrada (lado quente — última fila) */}
            <rect x={circuitEntryX} y={frontY + frontH * 0.1}
              width={12} height={frontH * 0.8} rx={3}
              fill="#FEE2E2" stroke="#E53935" strokeWidth={1} />
            <text x={circuitEntryX + 6} y={frontY + frontH / 2} textAnchor="middle" fontSize={6}
              fill="#E53935" fontFamily="monospace" transform={`rotate(-90, ${circuitEntryX + 6}, ${frontY + frontH / 2})`}>
              ENTRADA REFRIG.
            </text>
            {/* Seta de entrada */}
            <polygon points={`${circuitEntryX + 12},${frontY + frontH / 2 - 5} ${circuitEntryX + 20},${frontY + frontH / 2} ${circuitEntryX + 12},${frontY + frontH / 2 + 5}`}
              fill="#E53935" />

            {/* Coletor de saída (lado frio — primeira fila) */}
            <rect x={circuitExitX - 12} y={frontY + frontH * 0.1}
              width={12} height={frontH * 0.8} rx={3}
              fill="#DBEAFE" stroke="#1E6FD9" strokeWidth={1} />
            <text x={circuitExitX - 6} y={frontY + frontH / 2} textAnchor="middle" fontSize={6}
              fill="#1E6FD9" fontFamily="monospace" transform={`rotate(-90, ${circuitExitX - 6}, ${frontY + frontH / 2})`}>
              SAÍDA REFRIG.
            </text>
            {/* Seta de saída */}
            <polygon points={`${circuitExitX - 12},${frontY + frontH / 2 - 5} ${circuitExitX - 20},${frontY + frontH / 2} ${circuitExitX - 12},${frontY + frontH / 2 + 5}`}
              fill="#1E6FD9" />

            {/* Circuitos internos (linhas de conexão entre tubos) */}
            {circuits > 0 && Array.from({ length: Math.min(circuits, tubesPerRow) }).map((_, ci) => {
              const t = Math.round((ci * tubesPerRow) / Math.max(circuits, 1));
              const cy0 = frontY + (tubesPerRow > 1 ? (t * frontH) / (tubesPerRow - 1) : frontH / 2);
              return (
                <line key={`circ-${ci}`}
                  x1={circuitExitX} y1={cy0}
                  x2={circuitEntryX} y2={cy0}
                  stroke="#94A3B8" strokeWidth={0.6} strokeDasharray="3 2" opacity={0.5} />
              );
            })}
          </>
        )}

        {/* Cotas vista frontal */}
        {showDimensions && (
          <>
            {/* Largura (horizontal, abaixo) */}
            <DimensionArrow
              x1={frontX} y1={frontY + frontH} x2={frontX + frontW} y2={frontY + frontH}
              label={`${widthMm} mm`} offset={20} horizontal />
            {/* Altura (vertical, esquerda) */}
            <DimensionArrow
              x1={frontX} y1={frontY} x2={frontX} y2={frontY + frontH}
              label={`${heightMm} mm`} offset={20} horizontal={false} />
          </>
        )}

        {/* ── VISTA LATERAL ─────────────────────────────────────────────── */}
        <text x={sideX + sideW / 2} y={sideY - 8} textAnchor="middle" fontSize={8} fill="#64748B" fontFamily="monospace" fontWeight="bold">
          VISTA LATERAL (profundidade)
        </text>

        <rect x={sideX} y={sideY} width={sideW} height={sideH}
          fill="url(#finPattern)" stroke="#94A3B8" strokeWidth={1} rx={2} />

        {showThermalZones && (
          <rect x={sideX} y={sideY} width={sideW} height={sideH}
            fill="url(#thermalGrad)" />
        )}

        {sideTubes.map(({ cx, cy, row }) => (
          <g key={`s-${row}-${cy}`}>
            <circle cx={cx} cy={cy} r={tubeR}
              fill="#E2E8F0" stroke={thermalColor(row, rows)} strokeWidth={1.2} />
            <circle cx={cx} cy={cy} r={tubeR * 0.45}
              fill={thermalColor(row, rows)} opacity={0.6} />
          </g>
        ))}

        {/* Cota profundidade */}
        {showDimensions && (
          <DimensionArrow
            x1={sideX} y1={sideY + sideH} x2={sideX + sideW} y2={sideY + sideH}
            label={`${depthMm} mm`} offset={20} horizontal />
        )}

        {/* Seta de fluxo de ar */}
        <g>
          <defs>
            <marker id="airArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#3B82F6" />
            </marker>
          </defs>
          <line x1={sideX + sideW + 8} y1={sideY + sideH / 2}
            x2={sideX - 8} y2={sideY + sideH / 2}
            stroke="#3B82F6" strokeWidth={1.5} markerEnd="url(#airArrow)" strokeDasharray="4 2" />
          <text x={sideX + sideW + 10} y={sideY + sideH / 2 - 4} fontSize={7} fill="#3B82F6" fontFamily="monospace">
            FLUXO DE AR →
          </text>
        </g>

        {/* ── LEGENDA ZONAS TÉRMICAS ─────────────────────────────────────── */}
        {showThermalZones && (
          <g>
            <text x={frontX} y={legendY - 8} fontSize={7} fill="#64748B" fontFamily="monospace" fontWeight="bold">
              ZONAS TÉRMICAS:
            </text>
            {THERMAL_PALETTE.slice(0, 5).map((color, i) => (
              <g key={`leg-${i}`}>
                <rect x={frontX + i * 32} y={legendY} width={28} height={8} fill={color} rx={2} />
              </g>
            ))}
            <text x={frontX} y={legendY + 18} fontSize={6} fill="#64748B" fontFamily="monospace">
              ← FRIO (saída)
            </text>
            <text x={frontX + 130} y={legendY + 18} fontSize={6} fill="#64748B" fontFamily="monospace">
              QUENTE (entrada) →
            </text>
          </g>
        )}

        {/* ── TABELA DE DADOS TÉCNICOS ───────────────────────────────────── */}
        <g>
          <rect x={sideX} y={legendY - 15} width={200} height={110} rx={4}
            fill="white" stroke="#E2E8F0" strokeWidth={1} />
          <text x={sideX + 8} y={legendY} fontSize={7} fill="#1E3A5F" fontFamily="monospace" fontWeight="bold">
            DADOS TÉCNICOS
          </text>
          {[
            [`Altura:`, `${heightMm} mm`],
            [`Largura:`, `${widthMm} mm`],
            [`Profundidade:`, `${depthMm} mm`],
            [`Filas de tubos:`, `${rows}`],
            [`Tubos/fila:`, `${tubesPerRow}`],
            [`Ø tubo externo:`, `${tubeOuterDiamMm} mm`],
            [`Passo de aleta:`, `${finPitchMm} mm`],
            [`Circuitos:`, `${circuits}`],
            [`Refrigerante:`, refrigerantId],
            [`Te / Tc:`, `${Te} / ${Tc} °C`],
            [`Q evap:`, `${Q} kW`],
            [`U global:`, `${U} W/m²K`],
          ].map(([label, value], i) => (
            <g key={`td-${i}`}>
              <text x={sideX + 8} y={legendY + 12 + i * 9} fontSize={6.5} fill="#475569" fontFamily="monospace">
                {label}
              </text>
              <text x={sideX + 100} y={legendY + 12 + i * 9} fontSize={6.5} fill="#0F172A" fontFamily="monospace" fontWeight="bold">
                {value}
              </text>
            </g>
          ))}
        </g>

        {/* ── TÍTULO E CARIMBO ──────────────────────────────────────────── */}
        <g>
          <rect x={frontX} y={SVG_H - 28} width={SVG_W - MARGIN.left - MARGIN.right + 20} height={22}
            fill="#1E3A5F" rx={2} />
          <text x={frontX + 8} y={SVG_H - 13} fontSize={7} fill="white" fontFamily="monospace" fontWeight="bold">
            CN COLD ENGENHARIA — EVAPORADOR DX — DESENHO TÉCNICO CONSTRUTIVO
          </text>
          <text x={SVG_W - MARGIN.right - 8} y={SVG_H - 13} fontSize={6} fill="#93C5FD" fontFamily="monospace" textAnchor="end">
            Rev. A | {new Date().toLocaleDateString("pt-BR")}
          </text>
        </g>
      </svg>
    </div>
  );
}
