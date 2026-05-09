/**
 * SystemValidationPanel.tsx
 *
 * Painel de validação do sistema completo.
 * Exibe COP, alertas, status e resumo de ventiladores.
 */
import { CheckCircle, AlertTriangle, XCircle, Wind } from "lucide-react";
import { useApplicationEngineering } from "../hooks/useApplicationEngineering";
import type { AlertSeverity } from "../types/application-engineering.types";

export function SystemValidationPanel() {
  const { validationResult, evapFanResult, condFanResult } =
    useApplicationEngineering();

  if (!validationResult) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">
          Validação do Sistema
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Execute o cálculo para ver a validação do sistema.
        </p>
      </div>
    );
  }

  const statusColor = {
    ok: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    critical: "text-red-600 dark:text-red-400",
  }[validationResult.status];

  const StatusIcon =
    validationResult.status === "ok"
      ? CheckCircle
      : validationResult.status === "warning"
        ? AlertTriangle
        : XCircle;

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusColor}`} />
          <h2 className="text-sm font-semibold text-foreground">
            Validação do Sistema
          </h2>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              validationResult.status === "ok"
                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                : validationResult.status === "warning"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {validationResult.status === "ok"
              ? "OK"
              : validationResult.status === "warning"
                ? "Atenção"
                : "Crítico"}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KPI
            label="COP do Sistema"
            value={validationResult.cop_system.toFixed(2)}
            highlight
          />
          <KPI
            label="COP Compressor"
            value={validationResult.cop_compressor.toFixed(2)}
          />
          <KPI
            label="Cobertura"
            value={`${(validationResult.coverage_ratio * 100).toFixed(1)}%`}
            highlight={validationResult.coverage_ratio >= 0.97}
            warn={validationResult.coverage_ratio < 0.97}
          />
          <KPI
            label="Cap. Efetiva"
            value={`${(validationResult.effective_capacity_w / 1000).toFixed(2)} kW`}
          />
          <KPI
            label="Calor Rejeitado"
            value={`${(validationResult.total_heat_rejection_w / 1000).toFixed(2)} kW`}
          />
        </div>

        {/* Alertas */}
        {validationResult.alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Alertas</p>
            {validationResult.alerts.map((alert, i) => (
              <AlertCard key={i} severity={alert.severity} message={alert.message} recommendation={alert.recommendation} />
            ))}
          </div>
        )}

        {/* Ventiladores */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Ventiladores Recomendados</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FanCard
              label="Evaporador"
              fan={evapFanResult?.recommended ?? null}
              warnings={evapFanResult?.warnings ?? []}
            />
            <FanCard
              label="Condensador"
              fan={condFanResult?.recommended ?? null}
              warnings={condFanResult?.warnings ?? []}
            />
          </div>
        </div>

        {/* Warnings gerais */}
        {validationResult.warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Avisos técnicos</p>
            {validationResult.warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-bold ${
          warn
            ? "text-amber-600 dark:text-amber-400"
            : highlight
              ? "text-blue-600 dark:text-blue-400"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AlertCard({
  severity,
  message,
  recommendation,
}: {
  severity: AlertSeverity;
  message: string;
  recommendation?: string;
}) {
  const colors = {
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    critical:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  }[severity];

  const Icon =
    severity === "critical"
      ? XCircle
      : severity === "warning"
        ? AlertTriangle
        : CheckCircle;

  return (
    <div className={`rounded-md border p-2.5 ${colors}`}>
      <div className="flex items-start gap-1.5">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <p className="text-xs font-medium">{message}</p>
          {recommendation && (
            <p className="mt-0.5 text-[10px] opacity-80">{recommendation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FanCard({
  label,
  fan,
  warnings,
}: {
  label: string;
  fan: ReturnType<typeof useApplicationEngineering>["evapFanResult"] extends { recommended: infer R } | null ? R : null;
  warnings: string[];
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Wind className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">{label}</p>
      </div>
      {fan ? (
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-foreground">{fan.model}</p>
          <p className="text-[10px] text-muted-foreground">{fan.manufacturer}</p>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <p className="text-[10px] text-muted-foreground">
              Ø {fan.diameter_mm} mm
            </p>
            <p className="text-[10px] text-muted-foreground">
              {fan.airflow_m3h} m³/h
            </p>
            <p className="text-[10px] text-muted-foreground">
              {fan.power_w} W
            </p>
            <p className="text-[10px] text-muted-foreground">
              η {fan.efficiency_pct}%
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          {warnings[0] ?? "Nenhum ventilador encontrado."}
        </p>
      )}
    </div>
  );
}
