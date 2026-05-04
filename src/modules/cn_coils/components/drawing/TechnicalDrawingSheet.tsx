/**
 * TechnicalDrawingSheet
 * ---------------------
 * Prancha técnica estilo CN COLD com 5 vistas SVG:
 *   1. Vista isométrica 3D (perspectiva axonométrica)
 *   2. Vista frontal com cotas (face do ar)
 *   3. Vista lateral com cotas (profundidade)
 *   4. Vista de circuitos (esquema 2D)
 *   5. Vista do distribuidor/coletor
 * Inclui grade de referência A-D / 1-6, bloco de título e callouts.
 */

import { useMemo } from "react";
import type { CycleResult } from "../../engines/cycle/cycleTypes";

interface CoilGeometry {
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
  componentType?: "evaporator_dx" | "condenser" | "heater" | "cooler";
  projectName?: string;
  drawingNumber?: string;
  scale?: string;
}

interface Props {
  geometry: CoilGeometry;
  cycleResult?: CycleResult | null;
  className?: string;
}

// ── Constantes de layout da prancha ────────────────────────────────────────
const SHEET_W = 1122; // A3 landscape em px (297mm × 3.78)
const SHEET_H = 794;  // A3 landscape em px (210mm × 3.78)
const BORDER = 12;
const TITLE_H = 80;   // altura do bloco de título
const GRID_COLS = 6;
const GRID_ROWS = 4;

// Cores CN COLD
const CN_BLUE = "#1E3A8A";
const CN_BLUE_LIGHT = "#1E6FD9";
const CN_COPPER = "#B87333";
const CN_FIN = "#4A90D9";
const CN_DIM = "#1E6FD9";
const CN_GRAY = "#64748B";
const CN_BORDER = "#1E3A8A";

// ── Helpers de cota ─────────────────────────────────────────────────────────
function HorizDim({
  x1, y1, x2, label, offsetY = 20,
}: { x1: number; y1: number; x2: number; label: string; offsetY?: number }) {
  const y = y1 + offsetY;
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x1} y2={y} stroke={CN_DIM} strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={x2} y1={y1} x2={x2} y2={y} stroke={CN_DIM} strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={x1 + 4} y1={y} x2={x2 - 4} y2={y} stroke={CN_DIM} strokeWidth={0.8} />
      <polygon points={`${x1},${y} ${x1 + 6},${y - 2.5} ${x1 + 6},${y + 2.5}`} fill={CN_DIM} />
      <polygon points={`${x2},${y} ${x2 - 6},${y - 2.5} ${x2 - 6},${y + 2.5}`} fill={CN_DIM} />
      <text x={mid} y={y - 3} textAnchor="middle" fontSize={6.5} fill={CN_DIM} fontFamily="Arial, sans-serif" fontWeight="bold">{label}</text>
    </g>
  );
}

function VertDim({
  x1, y1, y2, label, offsetX = -20,
}: { x1: number; y1: number; y2: number; label: string; offsetX?: number }) {
  const x = x1 + offsetX;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x} y2={y1} stroke={CN_DIM} strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={x1} y1={y2} x2={x} y2={y2} stroke={CN_DIM} strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={x} y1={y1 + 4} x2={x} y2={y2 - 4} stroke={CN_DIM} strokeWidth={0.8} />
      <polygon points={`${x},${y1} ${x - 2.5},${y1 + 6} ${x + 2.5},${y1 + 6}`} fill={CN_DIM} />
      <polygon points={`${x},${y2} ${x - 2.5},${y2 - 6} ${x + 2.5},${y2 - 6}`} fill={CN_DIM} />
      <text
        x={x - 4} y={mid} textAnchor="middle" fontSize={6.5} fill={CN_DIM}
        fontFamily="Arial, sans-serif" fontWeight="bold"
        transform={`rotate(-90, ${x - 4}, ${mid})`}
      >{label}</text>
    </g>
  );
}

function Callout({
  x, y, tx, ty, text,
}: { x: number; y: number; tx: number; ty: number; text: string }) {
  return (
    <g>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke={CN_GRAY} strokeWidth={0.6} />
      <circle cx={x} cy={y} r={2} fill={CN_GRAY} />
      <text x={tx} y={ty - 2} fontSize={6} fill="#1E293B" fontFamily="Arial, sans-serif">{text}</text>
    </g>
  );
}

// ── Vista isométrica 3D (axonométrica SVG) ──────────────────────────────────
function IsoView({
  x, y, w, h, geometry,
}: { x: number; y: number; w: number; h: number; geometry: CoilGeometry }) {
  const { heightMm, widthMm, depthMm, rows, tubesPerRow, finPitchMm } = geometry;
  // Escala para caber em w×h
  const maxDim = Math.max(heightMm, widthMm, depthMm);
  const scale = Math.min(w, h) * 0.55 / maxDim;
  const H = heightMm * scale;
  const W = widthMm * scale;
  const D = depthMm * scale;
  // Projeção isométrica (ângulo 30°)
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  // Ponto de origem (frente-baixo-esquerda)
  const ox = x + w / 2 - W * cos30 / 2 + D * cos30 / 2;
  const oy = y + h / 2 + H / 2 - D * sin30 / 2;
  // Vetores unitários
  const dx = [cos30, -sin30]; // direção X (largura)
  const dy = [0, -1];         // direção Y (altura)
  const dz = [-cos30, -sin30]; // direção Z (profundidade)
  function pt(lx: number, ly: number, lz: number): [number, number] {
    return [
      ox + lx * W * dx[0] + ly * H * dy[0] + lz * D * dz[0],
      oy + lx * W * dx[1] + ly * H * dy[1] + lz * D * dz[1],
    ];
  }
  // 8 vértices do paralelepípedo
  const v = [
    pt(0, 0, 0), pt(1, 0, 0), pt(1, 1, 0), pt(0, 1, 0), // face frontal
    pt(0, 0, 1), pt(1, 0, 1), pt(1, 1, 1), pt(0, 1, 1), // face traseira
  ];
  function poly(pts: [number, number][], fill: string, stroke: string, opacity = 1) {
    return <polygon points={pts.map(p => p.join(",")).join(" ")} fill={fill} stroke={stroke} strokeWidth={0.8} opacity={opacity} />;
  }
  // Aletas (linhas verticais na face frontal)
  const finCount = Math.min(Math.round(widthMm / Math.max(finPitchMm, 1)), 60);
  const finLines = Array.from({ length: finCount }, (_, i) => {
    const t = i / Math.max(finCount - 1, 1);
    const p0 = pt(t, 0, 0);
    const p1 = pt(t, 1, 0);
    return <line key={i} x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={CN_FIN} strokeWidth={0.4} opacity={0.5} />;
  });
  // Tubos na face frontal (círculos)
  const tubeR = Math.max(1.5, Math.min(4, H / (tubesPerRow * 2.5)));
  const tubeDots = [];
  for (let r = 0; r < Math.min(rows, 6); r++) {
    for (let t = 0; t < Math.min(tubesPerRow, 12); t++) {
      const lx = rows > 1 ? r / (rows - 1) : 0.5;
      const ly = tubesPerRow > 1 ? t / (tubesPerRow - 1) : 0.5;
      const stOff = (geometry.staggered && r % 2 === 1) ? (1 / (Math.max(tubesPerRow - 1, 1) * 2)) : 0;
      const [cx, cy] = pt(lx, ly + stOff, 0);
      tubeDots.push(
        <circle key={`t-${r}-${t}`} cx={cx} cy={cy} r={tubeR}
          fill={CN_COPPER} stroke="#7A4520" strokeWidth={0.5} opacity={0.9} />
      );
    }
  }
  // Coletores (cilindros nas extremidades)
  const collH = H * 0.85;
  const collR = 4;
  const [cx0, cy0] = pt(0, 0.075, 0);
  const [cx1, cy1] = pt(0, 0.925, 0);
  const [cx0b, cy0b] = pt(1, 0.075, 0);
  const [cx1b, cy1b] = pt(1, 0.925, 0);
  return (
    <g>
      {/* Sombra */}
      <ellipse cx={ox + W * cos30 / 2} cy={oy + 8} rx={W * cos30 * 0.6} ry={6} fill="#00000015" />
      {/* Face inferior */}
      {poly([v[0], v[1], v[5], v[4]], "#E2E8F0", "#94A3B8", 0.6)}
      {/* Face traseira (lateral direita) */}
      {poly([v[1], v[2], v[6], v[5]], "#CBD5E1", "#94A3B8", 0.7)}
      {/* Aletas (face frontal fundo) */}
      <polygon points={[v[0], v[1], v[2], v[3]].map(p => p.join(",")).join(" ")}
        fill="#EFF6FF" stroke="#94A3B8" strokeWidth={0.8} />
      {finLines}
      {/* Tubos */}
      {tubeDots}
      {/* Face superior */}
      {poly([v[3], v[2], v[6], v[7]], "#DBEAFE", "#94A3B8", 0.8)}
      {/* Coletor esquerdo (sucção) */}
      <line x1={cx0} y1={cy0} x2={cx1} y2={cy1} stroke={CN_COPPER} strokeWidth={collR} strokeLinecap="round" opacity={0.9} />
      {/* Coletor direito (entrada) */}
      <line x1={cx0b} y1={cy0b} x2={cx1b} y2={cy1b} stroke="#E53935" strokeWidth={collR} strokeLinecap="round" opacity={0.9} />
      {/* Borda frontal */}
      {poly([v[0], v[1], v[2], v[3]], "none", CN_BORDER)}
      {/* Label */}
      <text x={x + w / 2} y={y + h - 4} textAnchor="middle" fontSize={7} fill={CN_GRAY} fontFamily="Arial, sans-serif" fontStyle="italic">
        Vista Isométrica
      </text>
    </g>
  );
}

// ── Vista frontal (face do ar) ───────────────────────────────────────────────
function FrontView({
  x, y, w, h, geometry, showDims = true,
}: { x: number; y: number; w: number; h: number; geometry: CoilGeometry; showDims?: boolean }) {
  const { heightMm, widthMm, rows, tubesPerRow, finPitchMm, staggered = true } = geometry;
  const PAD = showDims ? 28 : 8;
  const fw = w - PAD * 2;
  const fh = h - PAD * 2 - 12;
  const fx = x + PAD;
  const fy = y + PAD;
  // Aletas (linhas verticais)
  const finCount = Math.min(Math.round(widthMm / Math.max(finPitchMm, 1)), 80);
  const finLines = Array.from({ length: finCount }, (_, i) => {
    const lx = i / Math.max(finCount - 1, 1);
    return (
      <line key={i} x1={fx + lx * fw} y1={fy} x2={fx + lx * fw} y2={fy + fh}
        stroke="#CBD5E1" strokeWidth={0.4} />
    );
  });
  // Tubos
  const tubeR = Math.max(2, Math.min(7, fh / (tubesPerRow * 2.5), fw / (rows * 2.5)));
  const tubes = [];
  for (let r = 0; r < rows; r++) {
    for (let t = 0; t < tubesPerRow; t++) {
      const cx = fx + (rows > 1 ? (r / (rows - 1)) * fw : fw / 2);
      const stOff = staggered && r % 2 === 1 ? fh / (Math.max(tubesPerRow - 1, 1) * 2) : 0;
      const cy = fy + (tubesPerRow > 1 ? (t / (tubesPerRow - 1)) * fh : fh / 2) + stOff;
      tubes.push(
        <g key={`${r}-${t}`}>
          <circle cx={cx} cy={cy} r={tubeR + 2} fill={CN_FIN} opacity={0.15} />
          <circle cx={cx} cy={cy} r={tubeR} fill="#E8D5C0" stroke={CN_COPPER} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={tubeR * 0.45} fill={CN_COPPER} opacity={0.7} />
        </g>
      );
    }
  }
  return (
    <g>
      {/* Fundo com aletas */}
      <rect x={fx} y={fy} width={fw} height={fh} fill="#F8FAFC" stroke={CN_BORDER} strokeWidth={1} />
      {finLines}
      {tubes}
      {/* Coletores */}
      <rect x={fx - 8} y={fy + fh * 0.05} width={7} height={fh * 0.9} rx={2}
        fill="#DBEAFE" stroke={CN_BLUE_LIGHT} strokeWidth={0.8} />
      <rect x={fx + fw + 1} y={fy + fh * 0.05} width={7} height={fh * 0.9} rx={2}
        fill="#FEE2E2" stroke="#E53935" strokeWidth={0.8} />
      {/* Cotas */}
      {showDims && (
        <>
          <HorizDim x1={fx} y1={fy} x2={fx + fw} label={`${widthMm} mm`} offsetY={fh + 16} />
          <VertDim x1={fx} y1={fy} y2={fy + fh} label={`${heightMm} mm`} offsetX={-18} />
        </>
      )}
      {/* Label */}
      <text x={fx + fw / 2} y={fy - 6} textAnchor="middle" fontSize={7} fill={CN_GRAY}
        fontFamily="Arial, sans-serif" fontWeight="bold">VISTA FRONTAL (face do ar)</text>
    </g>
  );
}

// ── Vista lateral (profundidade) ─────────────────────────────────────────────
function SideView({
  x, y, w, h, geometry, showDims = true,
}: { x: number; y: number; w: number; h: number; geometry: CoilGeometry; showDims?: boolean }) {
  const { heightMm, depthMm, rows, tubesPerRow, staggered = true } = geometry;
  const PAD = showDims ? 28 : 8;
  const sw = w - PAD * 2;
  const sh = h - PAD * 2 - 12;
  const sx = x + PAD;
  const sy = y + PAD;
  // Tubos na vista lateral
  const tubeR = Math.max(2, Math.min(7, sh / (tubesPerRow * 2.5), sw / (rows * 2.5)));
  const tubes = [];
  for (let r = 0; r < rows; r++) {
    for (let t = 0; t < tubesPerRow; t++) {
      const cx = sx + (rows > 1 ? (r / (rows - 1)) * sw : sw / 2);
      const stOff = staggered && r % 2 === 1 ? sh / (Math.max(tubesPerRow - 1, 1) * 2) : 0;
      const cy = sy + (tubesPerRow > 1 ? (t / (tubesPerRow - 1)) * sh : sh / 2) + stOff;
      tubes.push(
        <g key={`s-${r}-${t}`}>
          <circle cx={cx} cy={cy} r={tubeR} fill="#E8D5C0" stroke={CN_COPPER} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={tubeR * 0.45} fill={CN_COPPER} opacity={0.7} />
        </g>
      );
    }
  }
  // Cota de profundidade (cabeçote)
  const headH = 18;
  return (
    <g>
      {/* Corpo aletado */}
      <rect x={sx} y={sy} width={sw} height={sh} fill="#F8FAFC" stroke={CN_BORDER} strokeWidth={1} />
      {tubes}
      {/* Cabeçote */}
      <rect x={sx - headH} y={sy + sh * 0.1} width={headH} height={sh * 0.8} rx={2}
        fill="#E2E8F0" stroke={CN_BORDER} strokeWidth={0.8} />
      {/* Cotas */}
      {showDims && (
        <>
          <HorizDim x1={sx} y1={sy} x2={sx + sw} label={`${depthMm} mm`} offsetY={sh + 16} />
          <VertDim x1={sx} y1={sy} y2={sy + sh} label={`${heightMm} mm`} offsetX={-headH - 10} />
          {/* Cota do cabeçote */}
          <HorizDim x1={sx - headH} y1={sy + sh * 0.1} x2={sx} label={`${Math.round(depthMm * 0.08)} mm`} offsetY={-10} />
        </>
      )}
      <text x={sx + sw / 2} y={sy - 6} textAnchor="middle" fontSize={7} fill={CN_GRAY}
        fontFamily="Arial, sans-serif" fontWeight="bold">VISTA LATERAL</text>
    </g>
  );
}

// ── Vista de circuitos ───────────────────────────────────────────────────────
function CircuitView({
  x, y, w, h, geometry,
}: { x: number; y: number; w: number; h: number; geometry: CoilGeometry }) {
  const { circuits, tubesPerRow, rows } = geometry;
  const PAD = 12;
  const fw = w - PAD * 2;
  const fh = h - PAD * 2 - 12;
  const fx = x + PAD;
  const fy = y + PAD;
  const tubesPerCircuit = Math.max(1, Math.round((tubesPerRow * rows) / Math.max(circuits, 1)));
  // Desenha os circuitos como serpentinas
  const circuitPaths = Array.from({ length: Math.min(circuits, 16) }, (_, ci) => {
    const rowH = fh / Math.max(Math.min(circuits, 16), 1);
    const cy0 = fy + ci * rowH + rowH * 0.2;
    const cy1 = fy + ci * rowH + rowH * 0.8;
    const segs = Math.min(tubesPerCircuit, 8);
    const segW = fw / Math.max(segs, 1);
    const pts: string[] = [];
    for (let s = 0; s < segs; s++) {
      const x0 = fx + s * segW;
      const x1 = fx + (s + 1) * segW;
      if (s === 0) pts.push(`M ${x0} ${(cy0 + cy1) / 2}`);
      if (s % 2 === 0) {
        pts.push(`L ${x1} ${cy0}`);
        if (s + 1 < segs) pts.push(`Q ${x1 + segW * 0.1} ${(cy0 + cy1) / 2} ${x1} ${cy1}`);
      } else {
        pts.push(`L ${x1} ${cy1}`);
        if (s + 1 < segs) pts.push(`Q ${x1 + segW * 0.1} ${(cy0 + cy1) / 2} ${x1} ${cy0}`);
      }
    }
    const hue = (ci * 360 / Math.max(circuits, 1));
    const color = `hsl(${hue}, 65%, 45%)`;
    return <path key={ci} d={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />;
  });
  return (
    <g>
      <rect x={fx} y={fy} width={fw} height={fh} fill="#F8FAFC" stroke={CN_BORDER} strokeWidth={0.8} rx={2} />
      {circuitPaths}
      <text x={fx + fw / 2} y={fy - 5} textAnchor="middle" fontSize={7} fill={CN_GRAY}
        fontFamily="Arial, sans-serif" fontWeight="bold">CIRCUITOS ({circuits})</text>
    </g>
  );
}

// ── Vista do distribuidor ────────────────────────────────────────────────────
function DistributorView({
  x, y, w, h, geometry,
}: { x: number; y: number; w: number; h: number; geometry: CoilGeometry }) {
  const { circuits, widthMm } = geometry;
  const PAD = 10;
  const fw = w - PAD * 2;
  const fh = h - PAD * 2 - 12;
  const fx = x + PAD;
  const fy = y + PAD;
  // Corpo do distribuidor
  const distY = fy + fh * 0.35;
  const distH = fh * 0.2;
  const capLen = fh * 0.35;
  // Capilares
  const capCount = Math.min(circuits, 16);
  const capSpacing = fw / Math.max(capCount + 1, 2);
  const capLines = Array.from({ length: capCount }, (_, i) => {
    const cx = fx + (i + 1) * capSpacing;
    return (
      <g key={i}>
        <line x1={cx} y1={distY + distH} x2={cx} y2={distY + distH + capLen}
          stroke="#94A3B8" strokeWidth={1} strokeDasharray="2 1" />
        <circle cx={cx} cy={distY + distH + capLen} r={2} fill={CN_COPPER} />
      </g>
    );
  });
  return (
    <g>
      <rect x={fx} y={fy} width={fw} height={fh} fill="#F8FAFC" stroke={CN_BORDER} strokeWidth={0.8} rx={2} />
      {/* Tubo de entrada */}
      <line x1={fx + fw * 0.1} y1={fy + fh * 0.1} x2={fx + fw * 0.1} y2={distY}
        stroke={CN_COPPER} strokeWidth={4} strokeLinecap="round" />
      {/* Corpo do distribuidor */}
      <rect x={fx + 4} y={distY} width={fw - 8} height={distH} rx={distH / 2}
        fill="#E2E8F0" stroke={CN_BORDER} strokeWidth={0.8} />
      {/* Capilares */}
      {capLines}
      {/* Cota do comprimento */}
      <HorizDim x1={fx + 4} y1={distY} x2={fx + fw - 4} label={`${widthMm} mm`} offsetY={-12} />
      <text x={fx + fw / 2} y={fy - 5} textAnchor="middle" fontSize={7} fill={CN_GRAY}
        fontFamily="Arial, sans-serif" fontWeight="bold">DISTRIBUIDOR ({circuits} capilares)</text>
    </g>
  );
}

// ── Bloco de título ──────────────────────────────────────────────────────────
function TitleBlock({
  x, y, w, h, geometry, cycleResult,
}: { x: number; y: number; w: number; h: number; geometry: CoilGeometry; cycleResult?: CycleResult | null }) {
  const { heightMm, widthMm, depthMm, rows, tubesPerRow, circuits, finPitchMm, tubeOuterDiamMm, refrigerantId, projectName, drawingNumber, scale } = geometry;
  const Q = cycleResult ? (cycleResult.Q_evap_W / 1000).toFixed(2) : "—";
  const U = cycleResult?.evaporatorResult?.overallU_WM2K?.toFixed(1) ?? "—";
  const Te = cycleResult?.Te_C?.toFixed(1) ?? "—";
  const tubeDiam = tubeOuterDiamMm >= 12.7 ? '1/2"' : tubeOuterDiamMm >= 9.52 ? '3/8"' : tubeOuterDiamMm >= 7.94 ? '5/16"' : `${tubeOuterDiamMm}mm`;
  const title = projectName ?? `${rows}×${tubesPerRow} TUBOS ${tubeDiam} — ${circuits} CIRCUITOS`;
  const colW = w / 4;
  return (
    <g>
      {/* Borda do bloco */}
      <rect x={x} y={y} width={w} height={h} fill="white" stroke={CN_BORDER} strokeWidth={1} />
      {/* Logo CN COLD */}
      <rect x={x} y={y} width={colW * 0.8} height={h} fill={CN_BLUE} />
      <text x={x + colW * 0.4} y={y + h * 0.38} textAnchor="middle" fontSize={11} fill="white"
        fontFamily="Arial, sans-serif" fontWeight="bold">CN</text>
      <text x={x + colW * 0.4} y={y + h * 0.72} textAnchor="middle" fontSize={9} fill="#93C5FD"
        fontFamily="Arial, sans-serif" fontWeight="bold">COLD</text>
      {/* Título */}
      <line x1={x + colW * 0.8} y1={y} x2={x + colW * 0.8} y2={y + h} stroke={CN_BORDER} strokeWidth={0.5} />
      <text x={x + colW * 0.8 + 6} y={y + h * 0.35} fontSize={8} fill={CN_BLUE}
        fontFamily="Arial, sans-serif" fontWeight="bold">TÍTULO:</text>
      <text x={x + colW * 0.8 + 6} y={y + h * 0.65} fontSize={9} fill="#1E293B"
        fontFamily="Arial, sans-serif" fontWeight="bold">{title}</text>
      {/* Divisor vertical */}
      <line x1={x + colW * 2.5} y1={y} x2={x + colW * 2.5} y2={y + h} stroke={CN_BORDER} strokeWidth={0.5} />
      {/* Dados técnicos */}
      {[
        [`${heightMm}×${widthMm}×${depthMm} mm`, "Dimensões (A×L×P)"],
        [`${rows}×${tubesPerRow} / ${circuits}C`, "Filas×Tubos / Circuitos"],
        [`Passo aleta: ${finPitchMm} mm`, "Espaçamento"],
      ].map(([val, lbl], i) => (
        <g key={i}>
          <text x={x + colW * 2.5 + 6} y={y + h * (0.28 + i * 0.28)} fontSize={7} fill={CN_GRAY}
            fontFamily="Arial, sans-serif">{lbl}</text>
          <text x={x + colW * 2.5 + 6} y={y + h * (0.28 + i * 0.28) + 9} fontSize={8} fill="#1E293B"
            fontFamily="Arial, sans-serif" fontWeight="bold">{val}</text>
        </g>
      ))}
      {/* Resultados */}
      <line x1={x + colW * 3.4} y1={y} x2={x + colW * 3.4} y2={y + h} stroke={CN_BORDER} strokeWidth={0.5} />
      {[
        [`Q = ${Q} kW`, "Capacidade"],
        [`U = ${U} W/m²K`, "Coef. Global"],
        [`Te = ${Te} °C / ${refrigerantId}`, "Evaporação"],
      ].map(([val, lbl], i) => (
        <g key={i}>
          <text x={x + colW * 3.4 + 6} y={y + h * (0.28 + i * 0.28)} fontSize={7} fill={CN_GRAY}
            fontFamily="Arial, sans-serif">{lbl}</text>
          <text x={x + colW * 3.4 + 6} y={y + h * (0.28 + i * 0.28) + 9} fontSize={8} fill="#1E293B"
            fontFamily="Arial, sans-serif" fontWeight="bold">{val}</text>
        </g>
      ))}
      {/* DES. Nº / Escala / Folha */}
      <line x1={x} y1={y + h * 0.55} x2={x + colW * 2.5} y2={y + h * 0.55} stroke={CN_BORDER} strokeWidth={0.3} />
      <text x={x + colW * 0.8 + 6} y={y + h * 0.75} fontSize={6.5} fill={CN_GRAY} fontFamily="Arial, sans-serif">
        DES. Nº: {drawingNumber ?? "—"} | ESCALA: {scale ?? "1:16"} | FOLHA 1 DE 1 | A3
      </text>
    </g>
  );
}

// ── Grade de referência (bordas A-D / 1-6) ──────────────────────────────────
function ReferenceGrid({ w, h }: { w: number; h: number }) {
  const inner_w = w - BORDER * 2;
  const inner_h = h - BORDER * 2 - TITLE_H;
  const colW = inner_w / GRID_COLS;
  const rowH = inner_h / GRID_ROWS;
  const cols = Array.from({ length: GRID_COLS }, (_, i) => i + 1);
  const rows_labels = ["D", "C", "B", "A"];
  return (
    <g>
      {/* Borda externa */}
      <rect x={BORDER} y={BORDER} width={inner_w} height={inner_h + TITLE_H}
        fill="none" stroke={CN_BORDER} strokeWidth={1.5} />
      {/* Linhas de grade (leves) */}
      {cols.map(i => (
        <line key={`c${i}`} x1={BORDER + i * colW} y1={BORDER} x2={BORDER + i * colW} y2={BORDER + inner_h}
          stroke={CN_BORDER} strokeWidth={0.3} opacity={0.4} />
      ))}
      {Array.from({ length: GRID_ROWS }, (_, i) => (
        <line key={`r${i}`} x1={BORDER} y1={BORDER + (i + 1) * rowH} x2={BORDER + inner_w} y2={BORDER + (i + 1) * rowH}
          stroke={CN_BORDER} strokeWidth={0.3} opacity={0.4} />
      ))}
      {/* Labels de coluna (1-6) */}
      {cols.map(i => (
        <g key={`cl${i}`}>
          <text x={BORDER + (i - 0.5) * colW} y={BORDER - 3} textAnchor="middle" fontSize={7}
            fill={CN_GRAY} fontFamily="Arial, sans-serif">{i}</text>
          <text x={BORDER + (i - 0.5) * colW} y={BORDER + inner_h + 10} textAnchor="middle" fontSize={7}
            fill={CN_GRAY} fontFamily="Arial, sans-serif">{i}</text>
        </g>
      ))}
      {/* Labels de linha (A-D) */}
      {rows_labels.map((lbl, i) => (
        <g key={`rl${i}`}>
          <text x={BORDER - 4} y={BORDER + (i + 0.5) * rowH} textAnchor="middle" fontSize={7}
            fill={CN_GRAY} fontFamily="Arial, sans-serif">{lbl}</text>
          <text x={BORDER + inner_w + 6} y={BORDER + (i + 0.5) * rowH} textAnchor="middle" fontSize={7}
            fill={CN_GRAY} fontFamily="Arial, sans-serif">{lbl}</text>
        </g>
      ))}
    </g>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function TechnicalDrawingSheet({ geometry, cycleResult, className = "" }: Props) {
  const inner_w = SHEET_W - BORDER * 2;
  const inner_h = SHEET_H - BORDER * 2 - TITLE_H;
  const colW = inner_w / GRID_COLS;
  const rowH = inner_h / GRID_ROWS;

  // Layout das 5 vistas (posições em unidades de grade)
  // Grade: 6 colunas × 4 linhas
  // Vista isométrica: colunas 1-2, linhas 3-4 (canto inferior esquerdo)
  // Vista frontal: colunas 3-5, linhas 2-4 (centro-direita)
  // Vista lateral: colunas 1-2, linhas 1-2 (canto superior esquerdo)
  // Vista circuitos: colunas 1-2, linhas 3-4 → compartilha com iso, usa sub-área
  // Vista distribuidor: colunas 5-6, linhas 1-2 (canto superior direito)

  const isoX = BORDER;
  const isoY = BORDER + rowH * 2;
  const isoW = colW * 2;
  const isoH = rowH * 2;

  const frontX = BORDER + colW * 2;
  const frontY = BORDER + rowH * 0.5;
  const frontW = colW * 3;
  const frontH = rowH * 3;

  const sideX = BORDER;
  const sideY = BORDER;
  const sideW = colW * 2;
  const sideH = rowH * 2;

  const circX = BORDER + colW * 0.1;
  const circY = BORDER + rowH * 2.1;
  const circW = colW * 0.9;
  const circH = rowH * 0.8;

  const distX = BORDER + colW * 5;
  const distY = BORDER;
  const distW = colW;
  const distH = rowH * 1.8;

  // Callouts da vista frontal
  const callouts = useMemo(() => {
    const { heightMm, widthMm, circuits, tubeOuterDiamMm, finPitchMm } = geometry;
    const tubeDiam = tubeOuterDiamMm >= 12.7 ? '1/2"' : tubeOuterDiamMm >= 9.52 ? '3/8"' : '5/16"';
    const collX = frontX + frontW + 8;
    const collY = frontY + frontH * 0.15;
    return [
      { x: frontX - 8, y: frontY + frontH * 0.3, tx: frontX - 55, ty: frontY + frontH * 0.2, text: `Coletor de sucção` },
      { x: frontX + frontW + 8, y: frontY + frontH * 0.3, tx: collX + 5, ty: collY, text: `Entrada ${tubeDiam}` },
      { x: frontX + frontW / 2, y: frontY + frontH * 0.5, tx: frontX + frontW + 30, ty: frontY + frontH * 0.55, text: `Aletas ${finPitchMm}mm` },
      { x: frontX + frontW * 0.5, y: frontY + frontH * 0.8, tx: frontX + frontW + 30, ty: frontY + frontH * 0.8, text: `${circuits} circuitos` },
    ];
  }, [geometry, frontX, frontY, frontW, frontH]);

  return (
    <div className={`bg-white rounded-lg border border-slate-300 shadow-md overflow-hidden ${className}`}>
      {/* Cabeçalho da aba */}
      <div className="bg-[#1E3A8A] px-4 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-bold tracking-wider uppercase">
          Prancha Técnica — {geometry.projectName ?? "Evaporador DX"}
        </span>
        <span className="text-blue-200 text-xs font-mono">
          {geometry.heightMm}×{geometry.widthMm}×{geometry.depthMm} mm | {geometry.rows}×{geometry.tubesPerRow} | {geometry.circuits}C
        </span>
      </div>

      {/* SVG da prancha */}
      <svg
        viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
        className="w-full h-auto"
        style={{ background: "#F0F4F8", fontFamily: "Arial, sans-serif" }}
        role="img"
        aria-label="Prancha técnica da serpentina"
      >
        {/* Fundo da prancha */}
        <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="#F0F4F8" />
        <rect x={BORDER / 2} y={BORDER / 2} width={SHEET_W - BORDER} height={SHEET_H - BORDER}
          fill="white" stroke={CN_BORDER} strokeWidth={2} />

        {/* Grade de referência */}
        <ReferenceGrid w={SHEET_W} h={SHEET_H} />

        {/* Vista isométrica 3D */}
        <IsoView x={isoX} y={isoY} w={isoW} h={isoH} geometry={geometry} />

        {/* Vista frontal com cotas */}
        <FrontView x={frontX} y={frontY} w={frontW} h={frontH} geometry={geometry} />

        {/* Vista lateral com cotas */}
        <SideView x={sideX} y={sideY} w={sideW} h={sideH} geometry={geometry} />

        {/* Vista de circuitos */}
        <CircuitView x={circX} y={circY} w={circW * 2} h={circH} geometry={geometry} />

        {/* Vista do distribuidor */}
        <DistributorView x={distX} y={distY} w={distW} h={distH} geometry={geometry} />

        {/* Callouts */}
        {callouts.map((c, i) => (
          <Callout key={i} {...c} />
        ))}

        {/* Nota técnica */}
        <text x={BORDER + colW * 2 + 4} y={BORDER + inner_h - 6} fontSize={7} fill={CN_GRAY}
          fontFamily="Arial, sans-serif" fontStyle="italic">
          {`Tubo com parede de ${(geometry.tubeOuterDiamMm * 0.04).toFixed(2)} mm de espessura — Aletas espaçadas em ${geometry.finPitchMm} mm`}
        </text>

        {/* Bloco de título */}
        <TitleBlock
          x={BORDER}
          y={SHEET_H - TITLE_H - BORDER / 2}
          w={inner_w}
          h={TITLE_H}
          geometry={geometry}
          cycleResult={cycleResult}
        />
      </svg>
    </div>
  );
}
