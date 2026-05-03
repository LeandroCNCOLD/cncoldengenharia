import { AlertCircle, AlertTriangle, CheckCircle2, Info, Target, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StructuredWarning, UnilabSimulationResult } from "../types/unilab.types";
import { ptBR } from "../i18n/messages.ptBR";
import {
  loadUnilabCoefficients,
  buildFanAudit,
  type FanAuditSummary,
} from "../services/unilabCoefficientsService";

interface ResultPanelProps {
  result: UnilabSimulationResult | undefined;
  warnings: Array<string | StructuredWarning>;
  onGoalSeek?: (targetKw: number) => void;
}

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function isStructured(w: string | StructuredWarning): w is StructuredWarning {
  return typeof w === "object" && w !== null && "severity" in w;
}

interface BannerWarning {
  key: string;
  message: string;
  severity: "warning" | "error";
}

function toBannerWarnings(
  warnings: Array<string | StructuredWarning>,
): BannerWarning[] {
  return warnings
    .map((w, i): BannerWarning | null => {
      if (isStructured(w)) {
        return {
          key: `${w.code}-${i}`,
          message: w.message ?? w.code,
          severity: w.severity,
        };
      }
      return null;
    })
    .filter((w): w is BannerWarning => w !== null);
}

function WarningsBanner({
  warnings,
}: {
  warnings: Array<string | StructuredWarning>;
}) {
  const initial = useMemo(() => toBannerWarnings(warnings), [warnings]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = initial.filter((w) => !dismissed.has(w.key));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((w) => {
        const isError = w.severity === "error";
        return (
          <div
            key={w.key}
            className={`flex items-start gap-2 rounded-md border-l-4 p-3 text-xs ${
              isError
                ? "border-l-red-500 border border-red-200 bg-red-50 text-red-900"
                : "border-l-amber-400 border border-amber-200 bg-amber-50 text-slate-800"
            }`}
          >
            <AlertTriangle
              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                isError ? "text-red-600" : "text-amber-600"
              }`}
            />
            <span className="flex-1">{w.message}</span>
            <button
              type="button"
              onClick={() =>
                setDismissed((d) => {
                  const next = new Set(d);
                  next.add(w.key);
                  return next;
                })
              }
              className="ml-1 rounded p-0.5 text-slate-500 hover:bg-black/5 hover:text-slate-900"
              aria-label="Dispensar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceBadge({
  warnings,
}: {
  warnings: Array<string | StructuredWarning>;
}) {
  const structured = warnings.filter(isStructured);
  const hasError = structured.some((w) => w.severity === "error");
  const hasWarning = structured.some((w) => w.severity === "warning");
  if (hasError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
        <XCircle className="h-3 w-3" /> Dados insuficientes
      </span>
    );
  }
  if (hasWarning) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        <AlertTriangle className="h-3 w-3" /> Estimativa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Alta confiança
    </span>
  );
}

function PressureDropBadge({ pa }: { pa: number }) {
  if (!Number.isFinite(pa)) return null;
  if (pa > 150) {
    return (
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
        Alto
      </span>
    );
  }
  if (pa >= 80) {
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
        Moderado
      </span>
    );
  }
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
      Normal
    </span>
  );
}

export function ResultPanel({ result, warnings, onGoalSeek }: ResultPanelProps) {
  const r = ptBR.workspace.result;
  const fanAudit = useFanAudit();
  const [targetKw, setTargetKw] = useState<string>("");

  if (!result) {
    return (
      <div className="space-y-3">
        <WarningsBanner warnings={warnings} />
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {r.empty}
        </div>
        {warnings.length > 0 && <WarningsList warnings={warnings} />}
      </div>
    );
  }

  const items: Array<{ label: string; value: string }> = [
    { label: r.sensibleCapacity, value: `${fmt(result.sensibleCapacityKw)} kW` },
    { label: r.latentCapacity, value: `${fmt(result.latentCapacityKw)} kW` },
    { label: r.shf, value: fmt(result.shf, 3) },
    { label: r.regime, value: result.regime },
    { label: r.airOutletTemp, value: `${fmt(result.airOutletTempC)} °C` },
    { label: r.airOutletRh, value: `${fmt(result.airOutletRhPercent, 1)} %` },
    { label: r.faceVelocity, value: `${fmt(result.faceVelocityMs)} m/s` },
    { label: r.correctionFactor, value: fmt(result.correctionFactor, 4) },
  ];

  const hasGeometry =
    result.A_total_m2 !== undefined ||
    result.A_fin_m2 !== undefined ||
    result.A_tube_bare_m2 !== undefined ||
    result.eta_fin !== undefined ||
    result.surface_ratio !== undefined ||
    result.correlation_used !== undefined;

  return (
    <div className="space-y-3">
      <WarningsBanner warnings={warnings} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Resultado da Simulação
          </h3>
          <ConfidenceBadge warnings={warnings} />
        </div>

        {/* Capacidade Total — bidirecional (Goal Seek) */}
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">
              {r.totalCapacity}
            </span>
            <span className="text-sm font-bold text-emerald-900">
              {fmt(result.totalCapacityKw)} kW
            </span>
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

        {/* Seção: Perdas de Carga */}
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Perdas de Carga
          </h4>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-600">ΔP Ar</dt>
              <dd className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>{fmt(result.airPressureDropPa, 1)} Pa</span>
                <PressureDropBadge pa={result.airPressureDropPa} />
              </dd>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-600">ΔP Fluido</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {fmt(result.fluidPressureDropKpa, 2)} kPa
              </dd>
            </div>
          </dl>
        </div>

        {/* Seção: Geometria da Serpentina */}
        {hasGeometry && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Geometria da Serpentina
            </h4>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <GeoCell
                label="Área Total Externa"
                value={
                  result.A_total_m2 !== undefined
                    ? `${result.A_total_m2.toFixed(3)} m²`
                    : "—"
                }
              />
              <GeoCell
                label="Área de Aletas"
                value={
                  result.A_fin_m2 !== undefined
                    ? `${result.A_fin_m2.toFixed(3)} m²`
                    : "—"
                }
              />
              <GeoCell
                label="Área de Tubo"
                value={
                  result.A_tube_bare_m2 !== undefined
                    ? `${result.A_tube_bare_m2.toFixed(3)} m²`
                    : "—"
                }
              />
              <GeoCell
                label="Eficiência da Aleta"
                value={
                  result.eta_fin !== undefined
                    ? `${(result.eta_fin * 100).toFixed(1)} %`
                    : "—"
                }
              />
              <GeoCell
                label="Razão de Superfície"
                value={
                  result.surface_ratio !== undefined
                    ? `${result.surface_ratio.toFixed(1)} ×`
                    : "—"
                }
              />
              {result.correlation_used && (
                <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-600">Correlação</dt>
                  <dd>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                      {result.correlation_used}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          {ptBR.module.disclaimer}
        </p>
      </div>
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
      {fanAudit && <FanLibraryStatus audit={fanAudit} />}
    </div>
  );
}

function GeoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function useFanAudit(): FanAuditSummary | null {
  const [audit, setAudit] = useState<FanAuditSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadUnilabCoefficients()
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
        Biblioteca de ventiladores UNILAB
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

interface LeveledWarning {
  text: string;
  level?: "1" | "2" | "3" | string | null;
}

function normalize(w: string | StructuredWarning): LeveledWarning {
  if (typeof w === "string") return { text: w, level: "2" };
  return {
    text: w.message ?? w.code,
    level: w.severity === "error" ? "3" : "2",
  };
}

function WarningsList({
  warnings,
}: {
  warnings: Array<string | StructuredWarning>;
}) {
  const items = warnings.map(normalize);
  const hasError = items.some((w) => w.level === "3");
  return (
    <div
      className={`rounded-lg border p-3 ${
        hasError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div
        className={`mb-1 flex items-center gap-2 text-xs font-semibold ${
          hasError ? "text-red-800" : "text-amber-800"
        }`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Avisos
      </div>
      <ul className="space-y-1 text-xs">
        {items.map((w, i) => {
          const lvl = w.level ?? "2";
          const Icon = lvl === "3" ? AlertCircle : lvl === "1" ? Info : AlertTriangle;
          const cls =
            lvl === "3"
              ? "text-red-700"
              : lvl === "1"
                ? "text-slate-600"
                : "text-amber-800";
          return (
            <li key={i} className={`flex items-start gap-1.5 ${cls}`}>
              <Icon className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{w.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
