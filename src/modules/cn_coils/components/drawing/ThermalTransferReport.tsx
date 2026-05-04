/**
 * ThermalTransferReport
 * ─────────────────────
 * Relatório detalhado de transmissão térmica do aletado:
 *   - Coeficiente global U (W/m²K)
 *   - Coeficiente interno h_i (fluido)
 *   - Coeficiente externo h_o (ar)
 *   - NTU e efetividade ε
 *   - Comportamento do fluido (fase, qualidade, ΔP)
 *   - Regime (seco/úmido) e condensação
 *   - Balanço de calor (Q_total, Q_sens, Q_lat, SHF)
 *   - Solver iterativo (ṁ estimado, iterações, convergência)
 */

import type { CycleResult } from "../../engines/cycle/cycleTypes";
import type { SimulationV2Result } from "../../engine_v2/simulatorCoreV2";
import type { IterativeSolverV2Result } from "../../engine_v2/iterativeSolverV2";

interface Props {
  cycleResult?: CycleResult | null;
  v2Result?: SimulationV2Result | null;
  solverResult?: IterativeSolverV2Result | null;
  refrigerantId?: string;
  componentType?: "evaporator_dx" | "condenser" | "heater" | "cooler";
  className?: string;
}

function fmt(v: number | undefined | null, digits = 2, fallback = "—"): string {
  if (v == null || !Number.isFinite(v)) return fallback;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Row({
  label, value, unit, highlight, note, indent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: "good" | "warn" | "info" | "neutral";
  note?: string;
  indent?: boolean;
}) {
  const bgMap = {
    good: "bg-emerald-50 border-l-2 border-emerald-500",
    warn: "bg-amber-50 border-l-2 border-amber-500",
    info: "bg-blue-50 border-l-2 border-blue-500",
    neutral: "",
  };
  const textMap = {
    good: "text-emerald-700 font-semibold",
    warn: "text-amber-700 font-semibold",
    info: "text-blue-700 font-semibold",
    neutral: "text-slate-700",
  };
  return (
    <tr className={`border-b border-slate-100 ${highlight ? bgMap[highlight] : ""}`}>
      <td className={`py-1 px-3 text-xs text-slate-500 ${indent ? "pl-6" : ""}`}>{label}</td>
      <td className={`py-1 px-3 text-xs text-right font-mono ${highlight ? textMap[highlight] : "text-slate-800"}`}>
        {value}
      </td>
      <td className="py-1 px-2 text-xs text-slate-400 w-20">{unit ?? ""}</td>
      {note && <td className="py-1 px-2 text-xs text-slate-400 italic">{note}</td>}
    </tr>
  );
}

function SectionHeader({ title, color = "blue" }: { title: string; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-700 text-white",
    green: "bg-emerald-700 text-white",
    amber: "bg-amber-600 text-white",
    slate: "bg-slate-600 text-white",
    purple: "bg-purple-700 text-white",
  };
  return (
    <tr>
      <td colSpan={4} className={`py-1.5 px-3 text-xs font-bold uppercase tracking-wider ${colorMap[color] ?? colorMap.blue}`}>
        {title}
      </td>
    </tr>
  );
}

// Diagrama de fluxo do fluido (SVG inline)
function FluidFlowDiagram({
  phase, quality, Te, Tc, superheat, subcooling, massFlow, refrigerant,
}: {
  phase?: string; quality?: number; Te?: number; Tc?: number;
  superheat?: number; subcooling?: number; massFlow?: number; refrigerant?: string;
}) {
  const W = 520;
  const H = 90;
  const zones = [
    { label: "Entrada", sublabel: `Bifásico x=${fmt(quality, 2)}`, color: "#3B82F6", x: 0 },
    { label: "Zona bifásica", sublabel: `Te = ${fmt(Te, 1)} °C`, color: "#1E6FD9", x: 1 },
    { label: "Saída", sublabel: `SH = ${fmt(superheat, 1)} K`, color: "#10B981", x: 2 },
  ];
  const zoneW = W / 3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 90 }}>
      {zones.map((z, i) => (
        <g key={i}>
          <rect x={i * zoneW} y={10} width={zoneW} height={50} rx={4}
            fill={z.color} opacity={0.15} stroke={z.color} strokeWidth={0.8} />
          <text x={i * zoneW + zoneW / 2} y={30} textAnchor="middle" fontSize={8}
            fill={z.color} fontWeight="bold" fontFamily="Arial, sans-serif">{z.label}</text>
          <text x={i * zoneW + zoneW / 2} y={44} textAnchor="middle" fontSize={7}
            fill="#475569" fontFamily="Arial, sans-serif">{z.sublabel}</text>
        </g>
      ))}
      {/* Seta de fluxo */}
      <line x1={8} y1={35} x2={W - 8} y2={35} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 2" />
      <polygon points={`${W - 8},35 ${W - 16},31 ${W - 16},39`} fill="#94A3B8" />
      {/* ṁ */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={7} fill="#64748B" fontFamily="Arial, sans-serif">
        {`ṁ = ${fmt(massFlow ? massFlow * 3600 : undefined, 1)} kg/h — ${refrigerant ?? "R404A"}`}
      </text>
    </svg>
  );
}

// Gráfico de barras de resistências térmicas
function ThermalResistanceChart({
  h_i, h_o, U,
}: { h_i?: number; h_o?: number; U?: number }) {
  if (!h_i || !h_o || !U) return null;
  const R_i = h_i > 0 ? 1 / h_i : 0;
  const R_o = h_o > 0 ? 1 / h_o : 0;
  const R_total = U > 0 ? 1 / U : 0;
  const R_wall = Math.max(0, R_total - R_i - R_o);
  const total = R_i + R_o + R_wall;
  if (total <= 0) return null;
  const W = 400;
  const H = 32;
  const bars = [
    { label: "R_i (fluido)", value: R_i, color: "#3B82F6" },
    { label: "R_parede", value: R_wall, color: "#94A3B8" },
    { label: "R_o (ar)", value: R_o, color: "#F59E0B" },
  ];
  let cx = 0;
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-500 mb-1 font-medium">Distribuição das resistências térmicas (1/U = 1/h_i + R_parede + 1/h_o)</p>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ maxHeight: 60 }}>
        {bars.map((b, i) => {
          const bw = (b.value / total) * W;
          const bx = cx;
          cx += bw;
          return (
            <g key={i}>
              <rect x={bx} y={0} width={bw} height={H} fill={b.color} opacity={0.8} />
              {bw > 30 && (
                <text x={bx + bw / 2} y={H / 2 + 4} textAnchor="middle" fontSize={7}
                  fill="white" fontWeight="bold" fontFamily="Arial, sans-serif">
                  {`${(b.value / total * 100).toFixed(0)}%`}
                </text>
              )}
              <text x={bx + bw / 2} y={H + 12} textAnchor="middle" fontSize={6.5}
                fill="#475569" fontFamily="Arial, sans-serif">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ThermalTransferReport({
  cycleResult, v2Result, solverResult, refrigerantId = "R404A", componentType = "evaporator_dx", className = "",
}: Props) {
  const isEvap = componentType === "evaporator_dx";
  const evapRes = cycleResult?.evaporatorResult;
  const condRes = cycleResult?.condenserResult;
  const coilRes = isEvap ? evapRes : condRes;

  // Campos do motor V2 (mais detalhados)
  const U = v2Result?.U_Wm2K ?? coilRes?.overallU_WM2K;
  const h_i = v2Result?.hFluid_Wm2K;
  const h_o = v2Result?.hAir_Wm2K;
  const ntu = v2Result?.ntu;
  const effectiveness = v2Result?.effectiveness;
  const regime = v2Result?.regime ?? (v2Result?.hasCondensation ? "WET" : "DRY");
  const hasCondensation = v2Result?.hasCondensation;
  const Q_total = v2Result?.totalCapacityKw ?? (isEvap ? (evapRes?.totalCapacityW ?? 0) / 1000 : (condRes?.totalCapacityW ?? 0) / 1000);
  const Q_sens = v2Result?.sensibleCapacityKw ?? (isEvap ? (evapRes?.sensibleCapacityW ?? 0) / 1000 : Q_total);
  const Q_lat = v2Result?.latentCapacityKw ?? (isEvap ? (evapRes?.latentCapacityW ?? 0) / 1000 : 0);
  const shf = v2Result?.shf ?? (Q_total > 0 ? Q_sens / Q_total : 1);
  const massFlow = solverResult?.estimatedMassFlowKgS ?? cycleResult?.m_dot_kgS;
  const Te = cycleResult?.Te_C;
  const Tc = cycleResult?.Tc_C;
  const superheat = cycleResult?.statePoints?.point1_evapOut?.T_C != null && Te != null
    ? cycleResult.statePoints.point1_evapOut.T_C - Te : undefined;
  const subcooling = cycleResult?.statePoints?.point3_condOut?.T_C != null && Tc != null
    ? Tc - cycleResult.statePoints.point3_condOut.T_C : undefined;
  const quality = cycleResult?.statePoints?.point4_valveOut?.quality;
  const fluidPhase = v2Result?.fluidPhase ?? "bifasico";
  const airDp = v2Result?.airPressureDropPa ?? coilRes?.airPressureDropPa;
  const fluidDp = v2Result?.fluidPressureDropKpa ?? coilRes?.fluidPressureDropKPa;
  const faceVel = v2Result?.faceVelocityMs;
  const airMassFlow = v2Result?.airMassFlowKgS;
  const faceArea = v2Result?.faceAreaM2;

  // Qualidade do coeficiente U
  const uQuality = U == null ? "neutral"
    : U < 20 ? "warn"
    : U < 50 ? "info"
    : "good";

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Cabeçalho */}
      <div className="bg-[#1E3A8A] px-4 py-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-white text-sm font-bold tracking-wide">Relatório de Transmissão Térmica</h3>
          <p className="text-blue-200 text-xs mt-0.5">
            {isEvap ? "Evaporador DX" : "Condensador"} — {refrigerantId}
            {regime && <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold ${regime === "WET" ? "bg-blue-500" : "bg-slate-500"}`}>{regime === "WET" ? "ÚMIDO" : "SECO"}</span>}
          </p>
        </div>
        {U != null && (
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-white">{fmt(U, 1)}</div>
            <div className="text-blue-200 text-xs">W/m²K — U global</div>
          </div>
        )}
      </div>

      {/* Diagrama de fluxo do fluido */}
      {isEvap && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Comportamento do fluido no aletado</p>
          <FluidFlowDiagram
            phase={fluidPhase} quality={quality} Te={Te} Tc={Tc}
            superheat={superheat} subcooling={subcooling}
            massFlow={massFlow} refrigerant={refrigerantId}
          />
        </div>
      )}

      {/* Tabela de dados */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="py-1.5 px-3 text-left text-xs font-semibold text-slate-600 w-48">Parâmetro</th>
              <th className="py-1.5 px-3 text-right text-xs font-semibold text-slate-600 w-28">Valor</th>
              <th className="py-1.5 px-3 text-left text-xs font-semibold text-slate-600 w-20">Unidade</th>
              <th className="py-1.5 px-3 text-left text-xs font-semibold text-slate-600">Observação</th>
            </tr>
          </thead>
          <tbody>
            {/* Coeficientes de transferência */}
            <SectionHeader title="Coeficientes de Transferência de Calor" color="blue" />
            <Row label="U — Coef. global" value={fmt(U, 1)} unit="W/m²K"
              highlight={uQuality}
              note={U != null ? (U < 20 ? "Baixo — verificar geometria" : U < 50 ? "Típico para evap. seco" : "Bom — regime úmido ou alta velocidade") : undefined} />
            <Row label="h_i — Coef. interno (fluido)" value={fmt(h_i, 1)} unit="W/m²K" indent
              highlight={h_i != null ? (h_i < 100 ? "warn" : h_i < 1000 ? "info" : "good") : "neutral"}
              note={h_i != null ? (h_i < 100 ? "Muito baixo — verificar vazão" : h_i < 500 ? "Baixo (vapor superaquecido)" : "Bifásico — Dittus-Boelter") : undefined} />
            <Row label="h_o — Coef. externo (ar)" value={fmt(h_o, 1)} unit="W/m²K" indent
              highlight={h_o != null ? (h_o < 20 ? "warn" : "info") : "neutral"}
              note="Correlação Wang (aleta plana)" />
            <Row label="Eficiência da aleta η_fin" value={v2Result?.eta_fin != null ? fmt(v2Result.eta_fin * 100, 1) : "—"} unit="%" indent />
            <Row label="Área total de troca A_total" value={v2Result?.A_total_m2 != null ? fmt(v2Result.A_total_m2, 3) : "—"} unit="m²" indent />

            {/* NTU-ε */}
            <SectionHeader title="Método NTU-ε (Número de Unidades de Transferência)" color="purple" />
            <Row label="NTU" value={fmt(ntu, 3)} unit="—"
              highlight={ntu != null ? (ntu < 0.5 ? "warn" : ntu < 2 ? "info" : "good") : "neutral"}
              note={ntu != null ? `NTU = U·A / C_min` : undefined} />
            <Row label="Efetividade ε" value={effectiveness != null ? fmt(effectiveness * 100, 1) : "—"} unit="%"
              highlight={effectiveness != null ? (effectiveness < 0.3 ? "warn" : effectiveness < 0.7 ? "info" : "good") : "neutral"} />
            <Row label="Regime" value={regime === "WET" ? "ÚMIDO (wet-coil)" : "SECO (dry-coil)"} unit=""
              highlight={regime === "WET" ? "info" : "neutral"}
              note={regime === "WET" ? "Modelo ASHRAE — diferença de entalpia" : "Modelo clássico — diferença de temperatura"} />
            {hasCondensation != null && (
              <Row label="Condensação de umidade" value={hasCondensation ? "Sim" : "Não"} unit=""
                highlight={hasCondensation ? "info" : "neutral"} indent />
            )}

            {/* Balanço de calor */}
            <SectionHeader title="Balanço de Calor" color="green" />
            <Row label="Q_total" value={fmt(Q_total, 2)} unit="kW"
              highlight={Q_total > 0 ? "good" : "warn"} />
            <Row label="Q_sensível" value={fmt(Q_sens, 2)} unit="kW" indent />
            <Row label="Q_latente" value={fmt(Q_lat, 2)} unit="kW" indent
              highlight={Q_lat > 0 ? "info" : "neutral"} />
            <Row label="SHF (Sensible Heat Factor)" value={fmt(shf, 3)} unit="—"
              note={shf < 0.7 ? "Alta carga latente" : shf > 0.95 ? "Carga predominantemente sensível" : "Típico"} />
            {cycleResult && (
              <>
                <Row label="Q_evap (ciclo)" value={fmt(cycleResult.Q_evap_W / 1000, 2)} unit="kW" />
                <Row label="W_comp" value={fmt(cycleResult.W_comp_W / 1000, 2)} unit="kW" indent />
                <Row label="COP" value={fmt(cycleResult.COP, 3)} unit="—"
                  highlight={cycleResult.COP > 3 ? "good" : cycleResult.COP > 2 ? "info" : "warn"} />
              </>
            )}

            {/* Fluido refrigerante */}
            <SectionHeader title="Fluido Refrigerante" color="amber" />
            <Row label="Refrigerante" value={refrigerantId} unit="" />
            <Row label="Fase dominante" value={
              fluidPhase === "bifasico" ? "Bifásico (evaporação)" :
              fluidPhase === "superaquecido" ? "Superaquecido" :
              fluidPhase === "liquido" ? "Líquido" : fluidPhase
            } unit=""
              highlight={fluidPhase === "bifasico" ? "good" : "info"} />
            {quality != null && (
              <Row label="Qualidade de entrada x" value={fmt(quality, 3)} unit="—"
                note={`${(quality * 100).toFixed(0)}% vapor`} indent />
            )}
            <Row label="ṁ refrigerante" value={fmt(massFlow ? massFlow * 3600 : undefined, 2)} unit="kg/h"
              note={solverResult?.converged === false ? "Solver não convergiu" : solverResult?.iterations != null ? `${solverResult.iterations} iterações` : undefined} />
            {Te != null && <Row label="Te (equilíbrio)" value={fmt(Te, 1)} unit="°C" />}
            {Tc != null && <Row label="Tc (equilíbrio)" value={fmt(Tc, 1)} unit="°C" />}
            {superheat != null && <Row label="Superaquecimento" value={fmt(superheat, 1)} unit="K" indent />}
            {subcooling != null && <Row label="Sub-resfriamento" value={fmt(subcooling, 1)} unit="K" indent />}
            {fluidDp != null && (
              <Row label="ΔP fluido" value={fmt(fluidDp, 2)} unit="kPa"
                highlight={fluidDp > 50 ? "warn" : "neutral"} />
            )}

            {/* Lado ar */}
            <SectionHeader title="Lado Ar" color="slate" />
            {faceVel != null && (
              <Row label="Velocidade frontal" value={fmt(faceVel, 2)} unit="m/s"
                highlight={faceVel > 3.5 ? "warn" : faceVel < 1 ? "warn" : "good"}
                note={faceVel > 3.5 ? "Acima do recomendado (max 3.5 m/s)" : ""} />
            )}
            {airMassFlow != null && (
              <Row label="Vazão mássica ar" value={fmt(airMassFlow * 3600, 1)} unit="kg/h" />
            )}
            {faceArea != null && (
              <Row label="Área frontal" value={fmt(faceArea, 4)} unit="m²" />
            )}
            {airDp != null && (
              <Row label="ΔP ar" value={fmt(airDp, 1)} unit="Pa"
                highlight={airDp > 80 ? "warn" : "neutral"} />
            )}

            {/* Solver iterativo */}
            {solverResult != null && (
              <>
                <SectionHeader title="Solver Iterativo ṁ ↔ Q" color="slate" />
                <Row label="Convergiu" value={solverResult.converged ? "Sim" : "Não"} unit=""
                  highlight={solverResult.converged ? "good" : "warn"} />
                <Row label="Iterações" value={String(solverResult.iterations)} unit="" />
                <Row label="ṁ estimado" value={fmt(solverResult.estimatedMassFlowKgS * 3600, 2)} unit="kg/h" />
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Gráfico de resistências */}
      {h_i != null && h_o != null && U != null && (
        <div className="px-4 py-3 border-t border-slate-100">
          <ThermalResistanceChart h_i={h_i} h_o={h_o} U={U} />
        </div>
      )}

      {/* Rodapé */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400 italic">
          Cálculo via método NTU-ε (ASHRAE HoF 2021) — Motor V2 CN COLD.
          {regime === "WET" ? " Regime úmido: Q = ε·ṁ_ar·Δh_max (diferença de entalpia)." : " Regime seco: Q = ε·C_min·ΔT_max."}
        </p>
      </div>
    </div>
  );
}
