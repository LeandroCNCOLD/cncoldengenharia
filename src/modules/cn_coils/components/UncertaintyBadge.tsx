import type { UncertaintyBand, UncertaintyResult } from "../engines/uncertainty/uncertaintyTypes";

interface UncertaintyBadgeProps {
  band: UncertaintyBand;
  format: (value: number) => string;
  unit?: string;
  display?: "inline" | "tooltip";
}

export function UncertaintyBadge({
  band,
  format,
  unit = "",
  display = "inline",
}: UncertaintyBadgeProps) {
  const nominalStr = format(band.nominal);
  const lowerStr = format(band.lower);
  const upperStr = format(band.upper);
  const ciPct = Math.round(band.confidenceLevel * 100);
  const spreadPct = band.nominal
    ? (((band.upper - band.lower) / (2 * band.nominal)) * 100).toFixed(0)
    : "0";

  if (display === "tooltip") {
    return (
      <span
        className="cursor-help border-b border-dashed border-gray-400"
        title={`Intervalo ${ciPct}% CI: [${lowerStr} – ${upperStr} ${unit}]\nDesvio padrão: ${format(band.stdDev)} ${unit}\nVariação: ±${spreadPct}%`}
      >
        {nominalStr} {unit}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <span className="font-semibold">
        {nominalStr} {unit}
      </span>
      <span className="text-xs font-normal text-gray-500">
        [{lowerStr} – {upperStr}]
      </span>
      <span className="text-xs font-normal text-gray-400">({ciPct}% CI)</span>
    </span>
  );
}

interface UncertaintyPanelProps {
  result: UncertaintyResult;
  isLoading?: boolean;
}

function fmtBR(value: number, decimals = 1): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const DEFAULT_SAMPLES = 500;

export function UncertaintyPanel({ result, isLoading = false }: UncertaintyPanelProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse text-xs text-gray-400">
        Calculando intervalos de confiança... ({DEFAULT_SAMPLES} amostras)
      </div>
    );
  }

  const ciPct = Math.round(result.totalCapacityW.confidenceLevel * 100);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Análise de Incerteza</h4>
        <span className="text-xs text-gray-500">
          {result.samplesUsed} amostras · {result.computeTimeMs}ms · {ciPct}% CI
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded bg-blue-50 p-2">
          <p className="mb-0.5 text-xs text-gray-500">Capacidade total</p>
          <UncertaintyBadge
            band={result.totalCapacityW}
            format={(v) => fmtBR(v / 1000, 2)}
            unit="kW"
          />
        </div>
        <div className="rounded bg-gray-50 p-2">
          <p className="mb-0.5 text-xs text-gray-500">Capacidade sensível</p>
          <UncertaintyBadge
            band={result.sensibleCapacityW}
            format={(v) => fmtBR(v / 1000, 2)}
            unit="kW"
          />
        </div>
        <div className="rounded bg-gray-50 p-2">
          <p className="mb-0.5 text-xs text-gray-500">Queda de pressão do ar</p>
          <UncertaintyBadge
            band={result.airPressureDropPa}
            format={(v) => fmtBR(v, 0)}
            unit="Pa"
          />
        </div>
        <div className="rounded bg-gray-50 p-2">
          <p className="mb-0.5 text-xs text-gray-500">Coeficiente global U</p>
          <UncertaintyBadge
            band={result.overallU_WM2K}
            format={(v) => fmtBR(v, 1)}
            unit="W/m²·K"
          />
        </div>
        {result.COP && (
          <div className="rounded bg-green-50 p-2">
            <p className="mb-0.5 text-xs text-gray-500">COP do sistema</p>
            <UncertaintyBadge band={result.COP} format={(v) => fmtBR(v, 2)} />
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-gray-400">
        Intervalos calculados por Monte Carlo ({result.samplesUsed} amostras) com
        perturbação gaussiana dos parâmetros geométricos. Refletem as incertezas das
        correlações Wang-Chi-Chang (±15%), Gnielinski (±10%) e resistência de contato
        (±30%).
      </p>

      {result.warnings.map((warning, index) => (
        <div key={index} className="rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700">
          ⚠ {warning}
        </div>
      ))}
    </div>
  );
}
