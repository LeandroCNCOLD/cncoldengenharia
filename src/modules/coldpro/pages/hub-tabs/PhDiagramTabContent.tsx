/**
 * PhDiagramTabContent — Diagrama Pressão-Entalpia (Mollier) Interativo
 *
 * Exibe o ciclo de refrigeração de Rankine Inverso no plano P-H:
 * - Curva de saturação (dome) do refrigerante
 * - 4 pontos do ciclo com labels interativos
 * - Isóbaras de evaporação e condensação
 * - Tabela de propriedades termodinâmicas em cada ponto
 * - Métricas: COP, EER, razão de compressão, temperatura de descarga
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Thermometer, Zap, TrendingUp, BarChart2 } from "lucide-react";
import type { PhDiagramResult, PhCyclePoint } from "../../stores/useTestHubStore";

interface Props {
  result: PhDiagramResult | null;
  loading: boolean;
  error: string | null;
}

// ── Paleta de cores por fase ──────────────────────────────────────────────────
const PHASE_COLORS: Record<string, string> = {
  superheated: "#ef4444",
  subcooled: "#3b82f6",
  two_phase: "#8b5cf6",
  liquid: "#3b82f6",
  vapor: "#ef4444",
};

const POINT_COLORS = ["#1E6FD9", "#ef4444", "#3b82f6", "#8b5cf6"];

// ── Componente SVG do diagrama P-H ────────────────────────────────────────────
function PhDiagramSVG({ result }: { result: PhDiagramResult }) {
  const { points, saturationCurve } = result;

  const W = 700;
  const H = 420;
  const PAD = { top: 30, right: 40, bottom: 50, left: 70 };

  // Calcular limites do diagrama
  const allH = [
    ...points.map((p) => p.h_kJkg),
    ...saturationCurve.map((p) => p.h_f_kJkg),
    ...saturationCurve.map((p) => p.h_g_kJkg),
  ];
  const allP = [
    ...points.map((p) => p.P_kPa),
    ...saturationCurve.map((p) => p.P_kPa),
  ];

  const hMin = Math.max(0, Math.min(...allH) - 20);
  const hMax = Math.max(...allH) + 30;
  const pMin = Math.max(10, Math.min(...allP) * 0.6);
  const pMax = Math.max(...allP) * 1.4;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Escala logarítmica para pressão (mais realista no diagrama P-H)
  const toX = (h: number) => PAD.left + ((h - hMin) / (hMax - hMin)) * plotW;
  const toY = (p: number) => {
    const logP = Math.log(p);
    const logMin = Math.log(pMin);
    const logMax = Math.log(pMax);
    return PAD.top + plotH - ((logP - logMin) / (logMax - logMin)) * plotH;
  };

  // Curva de saturação (dome)
  const satLeft = saturationCurve.map((p) => `${toX(p.h_f_kJkg)},${toY(p.P_kPa)}`);
  const satRight = [...saturationCurve].reverse().map((p) => `${toX(p.h_g_kJkg)},${toY(p.P_kPa)}`);
  const satPath = `M ${satLeft.join(" L ")} L ${satRight.join(" L ")} Z`;

  // Linhas do ciclo: 1→2→3→4→1
  const cyclePoints = [0, 1, 2, 3, 0].map((i) => {
    const p = points[i % 4]!;
    return `${toX(p.h_kJkg)},${toY(p.P_kPa)}`;
  });

  // Isóbaras
  const Pe = points[0]!.P_kPa;
  const Pc = points[1]!.P_kPa;
  const yPe = toY(Pe);
  const yPc = toY(Pc);

  // Ticks do eixo H
  const hTicks = useMemo(() => {
    const step = Math.ceil((hMax - hMin) / 8 / 10) * 10;
    const ticks: number[] = [];
    for (let h = Math.ceil(hMin / step) * step; h <= hMax; h += step) ticks.push(h);
    return ticks;
  }, [hMin, hMax]);

  // Ticks do eixo P (logarítmico)
  const pTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let exp = Math.floor(Math.log10(pMin)); exp <= Math.ceil(Math.log10(pMax)); exp++) {
      for (const mult of [1, 2, 5]) {
        const v = mult * Math.pow(10, exp);
        if (v >= pMin && v <= pMax) ticks.push(v);
      }
    }
    return ticks;
  }, [pMin, pMax]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "monospace" }}>
      {/* Fundo */}
      <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="#f8fafc" stroke="#e2e8f0" />

      {/* Grid */}
      {hTicks.map((h) => (
        <line key={`gh-${h}`} x1={toX(h)} y1={PAD.top} x2={toX(h)} y2={PAD.top + plotH}
          stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4,4" />
      ))}
      {pTicks.map((p) => (
        <line key={`gp-${p}`} x1={PAD.left} y1={toY(p)} x2={PAD.left + plotW} y2={toY(p)}
          stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4,4" />
      ))}

      {/* Isóbaras */}
      <line x1={PAD.left} y1={yPe} x2={PAD.left + plotW} y2={yPe}
        stroke="#8b5cf6" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />
      <line x1={PAD.left} y1={yPc} x2={PAD.left + plotW} y2={yPc}
        stroke="#ef4444" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />
      <text x={PAD.left + plotW - 4} y={yPe - 4} fontSize={9} fill="#8b5cf6" textAnchor="end">
        Pe = {Pe.toFixed(0)} kPa
      </text>
      <text x={PAD.left + plotW - 4} y={yPc - 4} fontSize={9} fill="#ef4444" textAnchor="end">
        Pc = {Pc.toFixed(0)} kPa
      </text>

      {/* Curva de saturação (dome) */}
      <path d={satPath} fill="#dbeafe" fillOpacity={0.4} stroke="#3b82f6" strokeWidth={1.5} />

      {/* Zona bifásica label */}
      {saturationCurve.length > 0 && (() => {
        const mid = saturationCurve[Math.floor(saturationCurve.length / 2)]!;
        const hMid = (mid.h_f_kJkg + mid.h_g_kJkg) / 2;
        return (
          <text x={toX(hMid)} y={toY(mid.P_kPa) + 4} fontSize={9} fill="#1d4ed8" textAnchor="middle">
            Bifásico
          </text>
        );
      })()}

      {/* Ciclo */}
      <polyline points={cyclePoints.join(" ")} fill="none" stroke="#1E6FD9" strokeWidth={2.5}
        strokeLinejoin="round" markerEnd="url(#arrow)" />

      {/* Setas de direção */}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#1E6FD9" />
        </marker>
      </defs>

      {/* Pontos do ciclo */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={toX(p.h_kJkg)} cy={toY(p.P_kPa)} r={7}
            fill={POINT_COLORS[i]!} stroke="white" strokeWidth={2} />
          <text x={toX(p.h_kJkg) + 10} y={toY(p.P_kPa) - 8}
            fontSize={10} fontWeight="bold" fill={POINT_COLORS[i]!}>
            {i + 1}
          </text>
          <text x={toX(p.h_kJkg) + 10} y={toY(p.P_kPa) + 4}
            fontSize={8} fill="#475569">
            {p.h_kJkg.toFixed(1)} kJ/kg
          </text>
        </g>
      ))}

      {/* Eixo H */}
      <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
        stroke="#64748b" strokeWidth={1.5} />
      {hTicks.map((h) => (
        <g key={`th-${h}`}>
          <line x1={toX(h)} y1={PAD.top + plotH} x2={toX(h)} y2={PAD.top + plotH + 5}
            stroke="#64748b" strokeWidth={1} />
          <text x={toX(h)} y={PAD.top + plotH + 16} fontSize={9} textAnchor="middle" fill="#475569">
            {h}
          </text>
        </g>
      ))}
      <text x={PAD.left + plotW / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="#334155" fontWeight="bold">
        Entalpia específica h [kJ/kg]
      </text>

      {/* Eixo P */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
        stroke="#64748b" strokeWidth={1.5} />
      {pTicks.map((p) => (
        <g key={`tp-${p}`}>
          <line x1={PAD.left - 5} y1={toY(p)} x2={PAD.left} y2={toY(p)}
            stroke="#64748b" strokeWidth={1} />
          <text x={PAD.left - 8} y={toY(p) + 4} fontSize={9} textAnchor="end" fill="#475569">
            {p >= 1000 ? `${(p / 1000).toFixed(1)}M` : p.toFixed(0)}
          </text>
        </g>
      ))}
      <text transform={`translate(14, ${PAD.top + plotH / 2}) rotate(-90)`}
        fontSize={11} textAnchor="middle" fill="#334155" fontWeight="bold">
        Pressão P [kPa] (log)
      </text>

      {/* Título */}
      <text x={PAD.left + plotW / 2} y={18} fontSize={12} textAnchor="middle" fill="#1e293b" fontWeight="bold">
        Diagrama P-H — {result.refrigerant}
      </text>
    </svg>
  );
}

// ── Tabela de pontos do ciclo ─────────────────────────────────────────────────
function CyclePointsTable({ points }: { points: PhCyclePoint[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Ponto</th>
            <th className="px-3 py-2 text-right">h [kJ/kg]</th>
            <th className="px-3 py-2 text-right">P [kPa]</th>
            <th className="px-3 py-2 text-right">T [°C]</th>
            <th className="px-3 py-2 text-left">Fase</th>
            <th className="px-3 py-2 text-right">Título x</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: POINT_COLORS[i] }}>
                    {i + 1}
                  </span>
                  <span className="text-slate-700">{p.label}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-800">{p.h_kJkg.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-800">{p.P_kPa.toFixed(1)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-800">{p.T_C.toFixed(1)}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[10px]"
                  style={{ borderColor: PHASE_COLORS[p.phase], color: PHASE_COLORS[p.phase] }}>
                  {p.phase === "superheated" ? "Superaquecido" :
                   p.phase === "subcooled" ? "Sub-resfriado" :
                   p.phase === "two_phase" ? "Bifásico" : p.phase}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-600">
                {p.quality !== undefined ? p.quality.toFixed(3) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function PhDiagramTabContent({ result, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-[#1E6FD9]" />
        <span className="text-sm">Calculando diagrama P-H...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-sm text-red-700">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Configure e selecione uma máquina para visualizar o diagrama P-H.
      </div>
    );
  }

  const { COP, EER, compressionRatio, dischargeTemp_C, qEvap_kJkg, wComp_kJkg, qCond_kJkg } = result;

  return (
    <div className="space-y-5">
      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "COP", value: COP.toFixed(2), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "EER [BTU/W]", value: EER.toFixed(2), icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Razão Compressão", value: compressionRatio.toFixed(2), icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "T Descarga", value: `${dischargeTemp_C.toFixed(1)}°C`, icon: Thermometer, color: dischargeTemp_C > 120 ? "text-red-600" : "text-slate-600", bg: dischargeTemp_C > 120 ? "bg-red-50" : "bg-slate-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className={`border-0 ${bg}`}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
              <div>
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diagrama SVG */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Diagrama Pressão-Entalpia (Mollier)</CardTitle>
          <CardDescription className="text-xs">
            Ciclo de Rankine Inverso — {result.refrigerant} | Te = {result.Te_C.toFixed(1)}°C | Tc = {result.Tc_C.toFixed(1)}°C | SH = {result.superheatK}K | SC = {result.subcoolingK}K
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhDiagramSVG result={result} />
        </CardContent>
      </Card>

      {/* Balanço de energia */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Efeito Frigorífico", value: qEvap_kJkg, unit: "kJ/kg", color: "bg-blue-50 border-blue-200", text: "text-blue-700", desc: "h₁ − h₄ (entalpia absorvida no evaporador)" },
          { label: "Trabalho de Compressão", value: wComp_kJkg, unit: "kJ/kg", color: "bg-amber-50 border-amber-200", text: "text-amber-700", desc: "h₂ − h₁ (trabalho fornecido ao compressor)" },
          { label: "Calor Rejeitado", value: qCond_kJkg, unit: "kJ/kg", color: "bg-red-50 border-red-200", text: "text-red-700", desc: "h₂ − h₃ (entalpia rejeitada no condensador)" },
        ].map(({ label, value, unit, color, text, desc }) => (
          <Card key={label} className={`border ${color}`}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-600">{label}</p>
              <p className={`text-2xl font-bold ${text}`}>{value.toFixed(2)} <span className="text-sm font-normal">{unit}</span></p>
              <p className="mt-1 text-[10px] text-slate-500">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de pontos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Propriedades Termodinâmicas nos Pontos do Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <CyclePointsTable points={result.points} />
        </CardContent>
      </Card>

      {/* Avisos */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w, i) => (
            <Alert key={i} className="border-amber-200 bg-amber-50 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <AlertDescription className="text-xs text-amber-700">{w}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
