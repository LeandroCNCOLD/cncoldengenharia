import type { CycleResult } from "../engines/cycle/cycleTypes";

interface Props {
  result: CycleResult;
}

function Row({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded px-3 py-1.5 ${
        highlight ? "bg-blue-50" : ""
      }`}
    >
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className={`text-sm font-mono font-semibold ${
          highlight ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-xs text-slate-500">{unit}</span>}
      </span>
    </div>
  );
}

export function CycleResultPanel({ result }: Props) {
  const fmtW = (w: number) =>
    w >= 1000
      ? `${(w / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : w.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const unitW = (w: number) => (w >= 1000 ? "kW" : "W");

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          result.converged
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-yellow-50 text-yellow-900 border border-yellow-200"
        }`}
      >
        <span>{result.converged ? "✓" : "⚠"}</span>
        <span>
          {result.converged
            ? `Convergido em ${result.iterations} iterações`
            : `Estimativa — resíduo ${(result.residual * 100).toFixed(1)}%`}
        </span>
      </div>

      <div>
        <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Desempenho do Sistema</h3>
        <div className="space-y-0.5">
          <Row label="Capacidade de refrigeração" value={fmtW(result.Q_evap_W)} unit={unitW(result.Q_evap_W)} highlight />
          <Row label="Potência do compressor" value={fmtW(result.W_comp_W)} unit={unitW(result.W_comp_W)} />
          <Row label="Calor rejeitado (condensador)" value={fmtW(result.Q_cond_W)} unit={unitW(result.Q_cond_W)} />
          <Row label="COP" value={result.COP.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} highlight />
          <Row label="EER" value={result.EER.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          <Row label="Vazão mássica refrigerante" value={(result.m_dot_kgS * 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} unit="kg/h" />
        </div>
      </div>

      <div>
        <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Temperaturas de Equilíbrio</h3>
        <div className="space-y-0.5">
          <Row label="Temperatura de evaporação (Te)" value={result.Te_C.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="°C" highlight />
          <Row label="Temperatura de condensação (Tc)" value={result.Tc_C.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="°C" highlight />
          <Row label="Razão de compressão" value={result.compressorResult.compressionRatio.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Evaporador</h3>
        <div className="space-y-0.5">
          <Row label="Capacidade total" value={fmtW(result.evaporatorResult.totalCapacityW)} unit={unitW(result.evaporatorResult.totalCapacityW)} />
          <Row label="Capacidade sensível" value={fmtW(result.evaporatorResult.sensibleCapacityW)} unit={unitW(result.evaporatorResult.sensibleCapacityW)} />
          <Row label="Capacidade latente" value={fmtW(result.evaporatorResult.latentCapacityW)} unit={unitW(result.evaporatorResult.latentCapacityW)} />
          <Row label="Temperatura de saída do ar" value={result.evaporatorResult.airOutletTempC.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="°C" />
          <Row label="ΔP ar" value={result.evaporatorResult.airPressureDropPa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} unit="Pa" />
          <Row label="Fator de segurança" value={result.evaporatorResult.safetyFactor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Condensador</h3>
        <div className="space-y-0.5">
          <Row label="Calor rejeitado" value={fmtW(result.condenserResult.totalCapacityW)} unit={unitW(result.condenserResult.totalCapacityW)} />
          <Row label="Temperatura de saída do ar" value={result.condenserResult.airOutletTempC.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="°C" />
          <Row label="ΔP ar" value={result.condenserResult.airPressureDropPa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} unit="Pa" />
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div>
          <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-yellow-800">Avisos</h3>
          <div className="space-y-1">
            {result.warnings.map((warning, index) => (
              <div key={index} className="rounded bg-yellow-50 border border-yellow-200 px-3 py-1.5 text-xs text-yellow-900">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
