import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info, Target } from "lucide-react";
import { useEffect, useState } from "react";
import type { CnCoilsSimulationResult } from "../types/cncoils.types";
import type { StructuredWarning } from "../types/warnings";
import { ptBR } from "../i18n/messages.ptBR";
import { convertPower, type PowerUnit } from "@/utils/unitConversions";
import { fmtBR } from "../utils/unitConversions";
import { getSuggestionForWarning } from "../config/warningSuggestions";
import {
  loadCnCoilsCoefficients,
  buildFanAudit,
  type FanAuditSummary,
} from "../services/cncoilsCoefficientsService";

interface ResultPanelProps {
  result: CnCoilsSimulationResult | undefined;
  warnings: StructuredWarning[];
  onGoalSeek?: (targetKw: number) => void;
}

function fmt(n: number | undefined, digits = 2): string {
  return fmtBR(n, digits);
}

export function ResultPanel({ result, warnings, onGoalSeek }: ResultPanelProps) {
  const r = ptBR.workspace.result;
  const fanAudit = useFanAudit();
  const [targetKw, setTargetKw] = useState<string>("");
  const [powerUnit, setPowerUnit] = useState<PowerUnit>("kW");

  if (!result) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {r.empty}
        </div>
        {warnings.length > 0 && <WarningsList warnings={warnings} />}
      </div>
    );
  }

  const powerDigits = powerUnit === "kW" || powerUnit === "TR" ? 2 : 0;
  const formatPower = (kw: number) =>
    `${fmt(convertPower(kw * 1000, powerUnit), powerDigits)} ${powerUnit}`;

  const items: Array<{ label: string; value: string }> = [
    { label: r.sensibleCapacity, value: formatPower(result.sensibleCapacityKw) },
    { label: r.latentCapacity, value: formatPower(result.latentCapacityKw) },
    { label: r.shf, value: fmt(result.shf, 3) },
    { label: r.regime, value: result.regime },
    { label: r.airOutletTemp, value: `${fmt(result.airOutletTempC)} °C` },
    { label: r.airOutletRh, value: `${fmt(result.airOutletRhPercent, 1)} %` },
    { label: r.faceVelocity, value: `${fmt(result.faceVelocityMs)} m/s` },
    { label: r.airPressureDrop, value: `${fmt(result.airPressureDropPa, 0)} Pa` },
    { label: r.fluidPressureDrop, value: `${fmt(result.fluidPressureDropKpa)} kPa` },
    { label: r.correctionFactor, value: fmt(result.correctionFactor, 4) },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {/* Capacidade Total — bidirecional (Goal Seek) */}
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">
              {r.totalCapacity}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={powerUnit}
                onChange={(e) => setPowerUnit(e.target.value as PowerUnit)}
                className="rounded border border-emerald-300 bg-white px-1 py-0.5 text-[10px] text-emerald-900"
              >
                {(["W", "kW", "kcal/h", "BTU/h", "TR"] as PowerUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <span className="text-sm font-bold text-emerald-900">
                {formatPower(result.totalCapacityKw)}
              </span>
            </div>
          </div>
          {onGoalSeek && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                value={targetKw}
                onChange={(e) => setTargetKw(e.target.value)}
                placeholder="Capacidade desejada (kW)"
                className="min-w-0 flex-1 rounded border border-emerald-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={() => {
                  const v = Number(targetKw);
                  if (Number.isFinite(v) && v > 0) onGoalSeek(v);
                }}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
              >
                <Target className="h-3 w-3" />
                Atingir Meta
              </button>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((it) => (
            <div
              key={it.label}
              className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <dt className="text-xs text-slate-600">{it.label}</dt>
              <dd className="text-sm font-semibold text-slate-900">{it.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          {ptBR.module.disclaimer}
        </p>
      </div>
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
      {fanAudit && <FanLibraryStatus audit={fanAudit} />}
    </div>
  );
}

function useFanAudit(): FanAuditSummary | null {
  const [audit, setAudit] = useState<FanAuditSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCnCoilsCoefficients()
      .then((b) => {
        if (!cancelled) setAudit(buildFanAudit(b));
      })
      .catch(() => {
        if (!cancelled) setAudit(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return audit;
}

function FanLibraryStatus({ audit }: { audit: FanAuditSummary }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
      <div className="mb-1 font-semibold text-slate-700">
        Biblioteca de ventiladores CN Coils
      </div>
      <ul className="space-y-0.5">
        <li>
          Axiais: {audit.axial.total} no total — {audit.axial.withCurveUsable}{" "}
          com curva utilizável, {audit.axial.withPolynomialUsable} com polinômio
          utilizável (
          {audit.axial.unusablePolynomial} polinômios zerados ignorados).
        </li>
        <li>
          Centrífugos: {audit.centrifugal.withValidRange} /{" "}
          {audit.centrifugal.total} com range operacional válido.
        </li>
      </ul>
    </div>
  );
}

// ── WarningsList: deduplicação + paginação (main) + sugestões contextuais expansíveis (Cursor) ──

function WarningsList({ warnings }: { warnings: StructuredWarning[] }) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const styles = {
    error: {
      box: "border-red-300 bg-red-50",
      title: "text-red-800",
      item: "text-red-700",
      Icon: AlertCircle,
    },
    warning: {
      box: "border-amber-300 bg-amber-50",
      title: "text-amber-800",
      item: "text-amber-800",
      Icon: AlertTriangle,
    },
    info: {
      box: "border-blue-300 bg-blue-50",
      title: "text-blue-800",
      item: "text-blue-700",
      Icon: Info,
    },
  } as const;

  // Deduplicar por code (ou pelo message quando code é genérico)
  const seen = new Map<string, { warning: StructuredWarning; count: number }>();
  for (const w of warnings) {
    const key = w.code && w.code !== "GENERAL_WARNING" ? w.code : (w.message ?? "");
    const entry = seen.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      seen.set(key, { warning: w, count: 1 });
    }
  }
  const unique = Array.from(seen.values());
  const MAX_DEFAULT = 5;
  const visible = showAll ? unique : unique.slice(0, MAX_DEFAULT);
  const hiddenCount = unique.length - visible.length;

  const top = warnings.some((w) => w.severity === "error")
    ? styles.error
    : warnings.some((w) => w.severity === "warning")
      ? styles.warning
      : styles.info;
  const TopIcon = top.Icon;

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`rounded-lg border p-3 ${top.box}`}>
      <div className={`mb-1 flex items-center gap-2 text-xs font-semibold ${top.title}`}>
        <TopIcon className="h-3.5 w-3.5" />
        Avisos ({unique.length} {unique.length === 1 ? "tipo" : "tipos"} ·{" "}
        {warnings.length} no total)
      </div>
      <ul className="space-y-1.5 text-xs">
        {visible.map((entry, i) => {
          const w = entry.warning;
          const s = styles[(w.severity as keyof typeof styles) ?? "warning"] ?? styles.warning;
          const Icon = s.Icon;
          const msgText = w.message ?? w.code;
          const suggestion = getSuggestionForWarning(msgText);
          const key = `${w.code ?? ""}:${i}`;
          const isExpanded = expanded[key] ?? false;

          return (
            <li key={i} className="rounded border border-current/10 bg-white/60 p-2">
              <div className={`flex items-start justify-between gap-1.5 ${s.item}`}>
                <div className="flex items-start gap-1.5 min-w-0">
                  <Icon className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span className="font-medium">
                    {msgText}
                    {entry.count > 1 && (
                      <span className="ml-1 rounded bg-black/10 px-1 py-0.5 text-[10px] font-mono">
                        ×{entry.count}
                      </span>
                    )}
                  </span>
                </div>
                {suggestion && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(key)}
                    className="ml-1 flex-shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    title={isExpanded ? "Ocultar sugestões" : "Ver campos e sugestões"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>

              {suggestion && isExpanded && (
                <div className="mt-2 space-y-2 border-t border-current/10 pt-2">
                  {suggestion.fields.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Campos a revisar
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.fields.map((field) => (
                          <span
                            key={field}
                            className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestion.actions.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        O que fazer
                      </p>
                      <ul className="space-y-1">
                        {suggestion.actions.map((action, ai) => (
                          <li key={ai} className="flex items-start gap-1.5 text-slate-700">
                            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`mt-2 text-[11px] font-medium underline ${top.title}`}
        >
          Ver todos os {unique.length} avisos
        </button>
      )}
      {showAll && unique.length > MAX_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={`mt-2 text-[11px] font-medium underline ${top.title}`}
        >
          Ocultar
        </button>
      )}
    </div>
  );
}
