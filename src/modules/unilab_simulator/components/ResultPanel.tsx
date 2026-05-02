import { AlertTriangle } from "lucide-react";
import type { FanEvaluationResult, UnilabSimulationResult } from "../types/unilab.types";
import { ptBR } from "../i18n/messages.ptBR";

interface ResultPanelProps {
  result: UnilabSimulationResult | undefined;
  warnings: string[];
}

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function displayWarning(warning: string): string {
  return warning.replaceAll("UNILAB", "CN COILS").replaceAll("Unilab", "CN COILS");
}

export function ResultPanel({ result, warnings }: ResultPanelProps) {
  const r = ptBR.workspace.result;
  const displayWarnings = warnings.map(formatVisibleWarning);

  if (!result) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {r.empty}
        </div>
        {displayWarnings.length > 0 && <WarningsList warnings={displayWarnings} />}
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
      <UnilabCorrectionCard result={result} warnings={displayWarnings} />
      <FanResultCard fan={result.fanEvaluation} />
      {displayWarnings.length > 0 && <WarningsList warnings={displayWarnings} />}
    </div>
  );
}

function formatVisibleWarning(warning: string): string {
  return warning.replaceAll("UNILAB", "CN COILS").replaceAll("Unilab", "CN COILS");
}

function UnilabCorrectionCard({
  result,
  warnings,
}: {
  result: UnilabSimulationResult;
  warnings: string[];
}) {
  const correction = result.unilabCorrection;
  const correctionWarnings = warnings.filter((warning) =>
    warning.toLowerCase().includes("coeficiente unilab") ||
    warning.toLowerCase().includes("coeficiente cn coils") ||
    warning.toLowerCase().includes("correção unilab") ||
    warning.toLowerCase().includes("correção cn coils") ||
    warning.toLowerCase().includes("velocidade frontal fora da faixa"),
  );

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
      <h4 className="text-sm font-semibold text-blue-950">Correção CN COILS</h4>
      {!correction || correction.idCorr === undefined ? (
        <p className="mt-2 text-sm text-blue-900">
          Correção CN COILS não encontrada. Foi usado fator 1.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CorrectionItem label="Fator aplicado" value={fmt(correction.factor, 4)} />
          <CorrectionItem label="Série" value={correction.serie ?? "—"} />
          <CorrectionItem
            label="Faixa válida de velocidade"
            value={
              correction.velocityRange_m_s
                ? `${fmt(correction.velocityRange_m_s.min)} a ${fmt(correction.velocityRange_m_s.max)} m/s`
                : "—"
            }
          />
          <CorrectionItem
            label="Velocidade usada"
            value={`${fmt(correction.clampedVelocity_m_s)} m/s`}
          />
        </dl>
      )}
      {correctionWarnings.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-semibold text-amber-900">Avisos</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
            {correctionWarnings.map((warning, index) => (
              <li key={index}>{displayWarning(warning)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CorrectionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-blue-100 bg-white/70 px-3 py-2">
      <dt className="text-xs text-blue-900">{label}</dt>
      <dd className="text-sm font-semibold text-blue-950">{value}</dd>
    </div>
  );
}

function methodLabel(method: FanEvaluationResult["method"]): string {
  const labels: Record<FanEvaluationResult["method"], string> = {
    curve: "Curva X/Y",
    polynomial: "Polinômio",
    range_only: "Somente faixa",
    unavailable: "Indisponível",
  };
  return labels[method];
}

function fanTypeLabel(type: FanEvaluationResult["type"] | undefined): string {
  if (type === "axial") return "Axial";
  if (type === "centrifugal") return "Centrífugo";
  return "—";
}

function FanResultCard({ fan }: { fan?: FanEvaluationResult }) {
  if (!fan) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">Ventilador</h4>
        <p className="mt-2 text-sm text-slate-600">
          Nenhum ventilador selecionado. Vazão informada manualmente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">Ventilador</h4>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CorrectionItem label="Modelo" value={fan.model ?? "—"} />
        <CorrectionItem label="Tipo" value={fanTypeLabel(fan.type)} />
        <CorrectionItem label="Método de avaliação" value={methodLabel(fan.method)} />
        <CorrectionItem label="Vazão usada (m³/h)" value={fmt(fan.airflow_m3h)} />
        <CorrectionItem
          label="Pressão na curva (Pa)"
          value={fan.pressure_Pa === null ? "—" : fmt(fan.pressure_Pa, 1)}
        />
        <CorrectionItem label="Potência (W)" value={fmt(fan.power_W, 1)} />
        <CorrectionItem label="Corrente (A)" value={fmt(fan.current_A, 2)} />
        <CorrectionItem label="Rotação (rpm)" value={fmt(fan.rpm, 0)} />
      </dl>
      {fan.warning && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <span className="font-semibold">Avisos:</span> {fan.warning}
        </div>
      )}
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
          <li key={i}>{displayWarning(w)}</li>
        ))}
      </ul>
    </div>
  );
}
