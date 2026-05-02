import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { UnilabSimulationResult } from "../types/unilab.types";
import { ptBR } from "../i18n/messages.ptBR";
import {
  loadUnilabCoefficients,
  buildFanAudit,
  type FanAuditSummary,
} from "../services/unilabCoefficientsService";

interface ResultPanelProps {
  result: UnilabSimulationResult | undefined;
  warnings: string[];
}

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function ResultPanel({ result, warnings }: ResultPanelProps) {
  const r = ptBR.workspace.result;
  const fanAudit = useFanAudit();

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

  const items: Array<{ label: string; value: string }> = [
    { label: r.totalCapacity, value: `${fmt(result.totalCapacityKw)} kW` },
    { label: r.sensibleCapacity, value: `${fmt(result.sensibleCapacityKw)} kW` },
    { label: r.latentCapacity, value: `${fmt(result.latentCapacityKw)} kW` },
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
    </div>
  );
}

function WarningsList({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Avisos
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
