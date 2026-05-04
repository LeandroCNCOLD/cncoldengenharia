/**
 * CycleCircuitDiagram
 * -------------------
 * Diagrama de circuito do ciclo de refrigeração estilo VapCyc.
 * Exibe os 4 componentes principais conectados por linhas de fluxo:
 *   Evaporador → Compressor → Condensador → Válvula de Expansão → Evaporador
 *
 * Cada componente mostra:
 *   - Ícone representativo
 *   - Valores calculados (T, P, h, Q, W)
 *   - Estado do fluido (cor por fase: líquido/vapor/bifásico)
 *   - Pontos de estado (1, 2, 3, 4) com temperatura e pressão
 */

import type { CycleResult } from "../../engines/cycle/cycleTypes";

interface Props {
  cycleResult?: CycleResult | null;
  refrigerantId?: string;
  className?: string;
}

// Cores por fase do refrigerante
const PHASE_COLORS: Record<string, string> = {
  liquid: "#1E6FD9",
  subcooled: "#1E6FD9",
  two_phase: "#8B5CF6",
  vapor: "#EF4444",
  superheated: "#F97316",
};

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    liquid: "Líquido",
    subcooled: "Subresfriado",
    two_phase: "Bifásico",
    vapor: "Vapor",
    superheated: "Superaquecido",
  };
  return map[phase] ?? phase;
}

function fmt(v: number | undefined, dec = 1): string {
  if (v === undefined || v === null || isNaN(v)) return "—";
  return v.toFixed(dec);
}

// Componente visual de um nó do ciclo
function CycleNode({
  x, y, w, h, label, sublabel, color, icon, values,
}: {
  x: number; y: number; w: number; h: number;
  label: string; sublabel?: string; color: string; icon: string;
  values: { key: string; val: string }[];
}) {
  return (
    <g>
      {/* Sombra */}
      <rect x={x + 2} y={y + 2} width={w} height={h} rx={6} fill="rgba(0,0,0,0.08)" />
      {/* Fundo */}
      <rect x={x} y={y} width={w} height={h} rx={6} fill="white" stroke={color} strokeWidth={1.5} />
      {/* Header colorido */}
      <rect x={x} y={y} width={w} height={22} rx={6} fill={color} />
      <rect x={x} y={y + 16} width={w} height={6} fill={color} />
      {/* Ícone */}
      <text x={x + 8} y={y + 14} fontSize={12} fill="white">{icon}</text>
      {/* Label */}
      <text x={x + 24} y={y + 14} fontSize={8} fill="white" fontFamily="monospace" fontWeight="bold">{label}</text>
      {sublabel && (
        <text x={x + w / 2} y={y + 14} fontSize={6} fill="rgba(255,255,255,0.8)" fontFamily="monospace" textAnchor="middle">{sublabel}</text>
      )}
      {/* Valores */}
      {values.map(({ key, val }, i) => (
        <g key={key}>
          <text x={x + 6} y={y + 28 + i * 11} fontSize={6.5} fill="#64748B" fontFamily="monospace">{key}</text>
          <text x={x + w - 6} y={y + 28 + i * 11} fontSize={7} fill="#0F172A" fontFamily="monospace" fontWeight="bold" textAnchor="end">{val}</text>
        </g>
      ))}
    </g>
  );
}

// Ponto de estado do ciclo
function StatePoint({
  x, y, number, T, P, h, phase,
}: {
  x: number; y: number; number: number;
  T: string; P: string; h: string; phase: string;
}) {
  const color = PHASE_COLORS[phase] ?? "#64748B";
  return (
    <g>
      {/* Círculo do ponto */}
      <circle cx={x} cy={y} r={10} fill={color} opacity={0.15} />
      <circle cx={x} cy={y} r={10} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fill={color} fontFamily="monospace" fontWeight="bold">{number}</text>
      {/* Balão com dados */}
      <rect x={x + 12} y={y - 22} width={72} height={44} rx={4} fill="white" stroke={color} strokeWidth={0.8} />
      <text x={x + 16} y={y - 12} fontSize={6} fill="#64748B" fontFamily="monospace">T: {T} °C</text>
      <text x={x + 16} y={y - 3} fontSize={6} fill="#64748B" fontFamily="monospace">P: {P} kPa</text>
      <text x={x + 16} y={y + 6} fontSize={6} fill="#64748B" fontFamily="monospace">h: {h} kJ/kg</text>
      <text x={x + 16} y={y + 15} fontSize={5.5} fill={color} fontFamily="monospace">{phaseLabel(phase)}</text>
    </g>
  );
}

// Linha de fluxo com seta e label
function FlowLine({
  x1, y1, x2, y2, label, color = "#94A3B8", dashed = false,
}: {
  x1: number; y1: number; x2: number; y2: number;
  label?: string; color?: string; dashed?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <defs>
        <marker id={`flow-${x1}-${y1}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={2}
        strokeDasharray={dashed ? "5 3" : undefined}
        markerEnd={`url(#flow-${x1}-${y1})`} />
      {label && (
        <text x={mx} y={my - 4} textAnchor="middle" fontSize={6.5} fill={color} fontFamily="monospace">{label}</text>
      )}
    </g>
  );
}

export function CycleCircuitDiagram({ cycleResult, refrigerantId = "R404A", className = "" }: Props) {
  const sp = cycleResult?.statePoints;
  const r = cycleResult;

  const SVG_W = 680;
  const SVG_H = 480;

  // Posições dos 4 componentes (layout em losango/quadrado)
  const EVAP = { x: 60, y: 180, w: 140, h: 90 };
  const COMP = { x: 270, y: 60, w: 140, h: 90 };
  const COND = { x: 480, y: 180, w: 140, h: 90 };
  const VALVE = { x: 270, y: 320, w: 140, h: 70 };

  // Pontos de estado
  const P1 = { x: 220, y: 200 }; // saída evaporador / entrada compressor
  const P2 = { x: 460, y: 145 }; // saída compressor / entrada condensador
  const P3 = { x: 460, y: 310 }; // saída condensador / entrada válvula
  const P4 = { x: 220, y: 345 }; // saída válvula / entrada evaporador

  const converged = r?.converged ?? false;
  const statusColor = converged ? "#22C55E" : "#EF4444";

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Cabeçalho */}
      <div className="bg-[#1E3A5F] px-4 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-bold tracking-wider uppercase">
          Diagrama de Circuito — Ciclo de Refrigeração
        </span>
        <div className="flex items-center gap-2">
          <span className="text-blue-200 text-xs font-mono">{refrigerantId}</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${converged ? "bg-green-700 text-green-100" : "bg-red-700 text-red-100"}`}>
            {converged ? "✓ Convergido" : "✗ Não convergido"}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ background: "#F8FAFC" }}>
        {/* ── LINHAS DE FLUXO ──────────────────────────────────────────── */}
        {/* 1→Comp (vapor superaquecido — vermelho) */}
        <FlowLine x1={P1.x} y1={P1.y} x2={COMP.x + 10} y2={COMP.y + COMP.h / 2}
          label="Vapor SH" color="#F97316" />
        {/* Comp→2 */}
        <FlowLine x1={COMP.x + COMP.w - 10} y1={COMP.y + COMP.h / 2} x2={P2.x} y2={P2.y}
          label="Alta pressão" color="#EF4444" />
        {/* 2→Cond */}
        <FlowLine x1={P2.x} y1={P2.y} x2={COND.x + 10} y2={COND.y + COND.h / 2}
          color="#EF4444" />
        {/* Cond→3 */}
        <FlowLine x1={COND.x + 10} y1={COND.y + COND.h / 2} x2={P3.x} y2={P3.y}
          label="Líquido SC" color="#1E6FD9" />
        {/* 3→Valve */}
        <FlowLine x1={P3.x} y1={P3.y} x2={VALVE.x + VALVE.w - 10} y2={VALVE.y + VALVE.h / 2}
          color="#1E6FD9" />
        {/* Valve→4 */}
        <FlowLine x1={VALVE.x + 10} y1={VALVE.y + VALVE.h / 2} x2={P4.x} y2={P4.y}
          label="Bifásico" color="#8B5CF6" />
        {/* 4→Evap */}
        <FlowLine x1={P4.x} y1={P4.y} x2={EVAP.x + EVAP.w - 10} y2={EVAP.y + EVAP.h / 2}
          color="#8B5CF6" />
        {/* Evap→1 */}
        <FlowLine x1={EVAP.x + 10} y1={EVAP.y + EVAP.h / 2} x2={P1.x} y2={P1.y}
          color="#F97316" />

        {/* ── COMPONENTES ──────────────────────────────────────────────── */}
        <CycleNode {...EVAP} label="EVAPORADOR" icon="❄️" color="#1E6FD9"
          values={[
            { key: "Q evap:", val: `${fmt(r?.Q_evap_W ? r.Q_evap_W / 1000 : undefined, 2)} kW` },
            { key: "Te:", val: `${fmt(r?.Te_C)} °C` },
            { key: "ΔP ar:", val: `${fmt(r?.evaporatorResult?.airPressureDropPa, 0)} Pa` },
            { key: "U global:", val: `${fmt(r?.evaporatorResult?.overallU_WM2K, 1)} W/m²K` },
            { key: "T saída ar:", val: `${fmt(r?.evaporatorResult?.airOutletTempC)} °C` },
            { key: "UR saída:", val: `${fmt(r?.evaporatorResult?.airOutletRH, 0)} %` },
          ]}
        />

        <CycleNode {...COMP} label="COMPRESSOR" icon="⚙️" color="#F97316"
          values={[
            { key: "W comp:", val: `${fmt(r?.W_comp_W ? r.W_comp_W / 1000 : undefined, 2)} kW` },
            { key: "COP:", val: `${fmt(r?.COP, 2)}` },
            { key: "EER:", val: `${fmt(r?.EER, 2)}` },
            { key: "Razão comp:", val: `${fmt(r?.compressorResult?.compressionRatio, 2)}` },
          ]}
        />

        <CycleNode {...COND} label="CONDENSADOR" icon="🔥" color="#EF4444"
          values={[
            { key: "Q cond:", val: `${fmt(r?.Q_cond_W ? r.Q_cond_W / 1000 : undefined, 2)} kW` },
            { key: "Tc:", val: `${fmt(r?.Tc_C)} °C` },
            { key: "ΔP ar:", val: `${fmt(r?.condenserResult?.airPressureDropPa, 0)} Pa` },
            { key: "T saída ar:", val: `${fmt(r?.condenserResult?.airOutletTempC)} °C` },
          ]}
        />

        <CycleNode {...VALVE} label="VÁL. EXPANSÃO" icon="🔧" color="#8B5CF6"
          values={[
            { key: "Tipo:", val: r ? "TXV" : "—" },
            { key: "Qual. entrada:", val: `${fmt(r?.inletQuality, 3)}` },
          ]}
        />

        {/* ── PONTOS DE ESTADO ─────────────────────────────────────────── */}
        {sp && (
          <>
            <StatePoint {...P1} number={1}
              T={fmt(sp.point1_evapOut.T_C)} P={fmt(sp.point1_evapOut.P_kPa, 0)}
              h={fmt(sp.point1_evapOut.h_kJkg, 1)} phase={sp.point1_evapOut.phase} />
            <StatePoint {...P2} number={2}
              T={fmt(sp.point2_compOut.T_C)} P={fmt(sp.point2_compOut.P_kPa, 0)}
              h={fmt(sp.point2_compOut.h_kJkg, 1)} phase={sp.point2_compOut.phase} />
            <StatePoint {...P3} number={3}
              T={fmt(sp.point3_condOut.T_C)} P={fmt(sp.point3_condOut.P_kPa, 0)}
              h={fmt(sp.point3_condOut.h_kJkg, 1)} phase={sp.point3_condOut.phase} />
            <StatePoint {...P4} number={4}
              T={fmt(sp.point4_valveOut.T_C)} P={fmt(sp.point4_valveOut.P_kPa, 0)}
              h={fmt(sp.point4_valveOut.h_kJkg, 1)} phase={sp.point4_valveOut.phase} />
          </>
        )}

        {/* ── BALANÇO DE ENERGIA ───────────────────────────────────────── */}
        <g>
          <rect x={10} y={SVG_H - 55} width={200} height={48} rx={4} fill="white" stroke="#E2E8F0" strokeWidth={1} />
          <text x={18} y={SVG_H - 42} fontSize={7} fill="#1E3A5F" fontFamily="monospace" fontWeight="bold">BALANÇO DE ENERGIA</text>
          <text x={18} y={SVG_H - 31} fontSize={6.5} fill="#64748B" fontFamily="monospace">
            Q_evap + W_comp = Q_cond
          </text>
          <text x={18} y={SVG_H - 20} fontSize={6.5} fill="#0F172A" fontFamily="monospace">
            {fmt(r?.Q_evap_W ? r.Q_evap_W / 1000 : undefined, 2)} + {fmt(r?.W_comp_W ? r.W_comp_W / 1000 : undefined, 2)} = {fmt(r?.Q_cond_W ? r.Q_cond_W / 1000 : undefined, 2)} kW
          </text>
          <text x={18} y={SVG_H - 9} fontSize={6} fill={statusColor} fontFamily="monospace">
            {converged ? `✓ Convergido em ${r?.iterations ?? 0} iterações` : "✗ Não convergido"}
          </text>
        </g>

        {/* ── LEGENDA FASES ─────────────────────────────────────────────── */}
        <g>
          {[
            { color: "#F97316", label: "Vapor SH" },
            { color: "#EF4444", label: "Alta P" },
            { color: "#1E6FD9", label: "Líquido SC" },
            { color: "#8B5CF6", label: "Bifásico" },
          ].map(({ color, label }, i) => (
            <g key={label}>
              <rect x={220 + i * 110} y={SVG_H - 20} width={30} height={6} rx={2} fill={color} />
              <text x={255 + i * 110} y={SVG_H - 13} fontSize={6.5} fill="#64748B" fontFamily="monospace">{label}</text>
            </g>
          ))}
        </g>

        {/* Rodapé */}
        <rect x={0} y={SVG_H - 8} width={SVG_W} height={8} fill="#1E3A5F" />
        <text x={SVG_W / 2} y={SVG_H - 1} textAnchor="middle" fontSize={5.5} fill="#93C5FD" fontFamily="monospace">
          CN COLD ENGENHARIA — DIAGRAMA DE CICLO DE REFRIGERAÇÃO
        </text>
      </svg>
    </div>
  );
}
