import { AlertCircle, AlertTriangle, Info, Target } from "lucide-react";
import { useEffect, useState } from "react";
import type { CnCoilsSimulationResult } from "../types/cncoils.types";
import type { StructuredWarning } from "../types/warnings";
import { ptBR } from "../i18n/messages.ptBR";
import { convertPower, type PowerUnit } from "@/utils/unitConversions";
import { fmtBR } from "../utils/unitConversions";
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

function WarningsList({ warnings }: { warnings: StructuredWarning[] }) {
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

  const top = warnings.some((w) => w.severity === "error")
    ? styles.error
    : warnings.some((w) => w.severity === "warning")
      ? styles.warning
      : styles.info;
  const TopIcon = top.Icon;

  return (
    <div className={`rounded-lg border p-3 ${top.box}`}>
      <div className={`mb-1 flex items-center gap-2 text-xs font-semibold ${top.title}`}>
        <TopIcon className="h-3.5 w-3.5" />
        Avisos
      </div>
      <ul className="space-y-1 text-xs">
        {warnings.map((w, i) => {
          const s = styles[(w.severity as keyof typeof styles) ?? "warning"] ?? styles.warning;
          const Icon = s.Icon;
          return (
            <li key={i} className={`flex items-start gap-1.5 ${s.item}`}>
              <Icon className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{w.message ?? w.code}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
