/**
 * OptimizationPanel — Interface de otimização multi-objetivo.
 */
import { useCallback, useState } from "react";
import { runOptimization } from "../engines/optimization/optimizationEngine";
import type {
  OptimizationCandidate,
  OptimizationConfig,
  OptimizationResult,
} from "../engines/optimization/optimizationTypes";
import type { CoilCycleInputs } from "../engines/coil/coilCycleAdapter";

interface OptimizationPanelProps {
  baseInputs: CoilCycleInputs;
  currentCapacityW: number;
  onApplyGeometry: (rows: number, circuits: number, finPitchMm: number) => void;
}

function fmtBR(value: number, decimals = 1): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function OptimizationPanel({
  baseInputs,
  currentCapacityW,
  onApplyGeometry,
}: OptimizationPanelProps) {
  const [objective, setObjective] = useState<OptimizationConfig["objective"]>("minimize_weight");
  const [minCapacityW, setMinCapacityW] = useState(currentCapacityW * 0.95);
  const [maxDpPa, setMaxDpPa] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [bestSoFar, setBestSoFar] = useState<OptimizationCandidate | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    setResult(null);
    setBestSoFar(null);

    try {
      const next = await runOptimization(baseInputs, {
        objective,
        constraints: {
          minCapacityW,
          maxAirPressureDropPa: maxDpPa,
        },
        searchSpace: {
          rowsOptions: [2, 3, 4, 5, 6],
          finPitchOptions: [4, 5, 6, 7, 8],
          maxEvaluations: 500,
        },
        onProgress: (p, best) => {
          setProgress(p);
          if (best) setBestSoFar(best);
        },
      });
      setResult(next);
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  }, [baseInputs, objective, minCapacityW, maxDpPa]);

  return (
    <div className="space-y-4 text-sm">
      <h4 className="font-semibold">Otimização de Geometria</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Objetivo</label>
          <select
            className="w-full rounded border px-2 py-1 text-sm"
            value={objective}
            onChange={(event) => setObjective(event.target.value as OptimizationConfig["objective"])}
          >
            <option value="minimize_weight">Minimizar peso</option>
            <option value="minimize_cost">Minimizar custo de material</option>
            <option value="minimize_dp_air">Minimizar ΔP do ar</option>
            <option value="maximize_capacity">Maximizar capacidade</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Capacidade mínima (kW)</label>
          <input
            type="number"
            className="w-full rounded border px-2 py-1 text-sm"
            value={(minCapacityW / 1000).toFixed(1)}
            onChange={(event) => setMinCapacityW(parseFloat(event.target.value) * 1000)}
            step="0.5"
            min="0.5"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">ΔP ar máximo (Pa)</label>
          <input
            type="number"
            className="w-full rounded border px-2 py-1 text-sm"
            value={maxDpPa}
            onChange={(event) => setMaxDpPa(parseInt(event.target.value, 10))}
            step="10"
            min="50"
          />
        </div>
      </div>

      <button
        className="w-full rounded bg-blue-600 py-2 font-medium text-white disabled:opacity-50"
        onClick={handleRun}
        disabled={isRunning}
      >
        {isRunning ? `Otimizando... ${progress}%` : "Executar Otimização"}
      </button>

      {isRunning && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {bestSoFar && (
            <p className="text-xs text-gray-500">
              Melhor até agora: {fmtBR(bestSoFar.totalCapacityW / 1000, 1)} kW |{" "}
              {bestSoFar.rows} fil. | {bestSoFar.circuits} circ. |{" "}
              {fmtBR(bestSoFar.finPitchMm, 0)} mm
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            {result.evaluationsCount} combinações avaliadas · {result.feasibleCount} factíveis ·{" "}
            {result.computeTimeMs}ms
          </div>

          {result.warnings.map((warning, index) => (
            <div key={index} className="rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700">
              ⚠ {warning}
            </div>
          ))}

          {result.topCandidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Top {result.topCandidates.length} soluções</p>
              {result.topCandidates.map((candidate, index) => (
                <div
                  key={`${candidate.rows}-${candidate.circuits}-${candidate.finPitchMm}-${index}`}
                  className={`rounded border p-2 ${
                    index === 0 ? "border-blue-400 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">
                      {index === 0 ? "★ Ótimo" : `#${index + 1}`} — {candidate.rows} fil. ·{" "}
                      {candidate.circuits} circ. · {fmtBR(candidate.finPitchMm, 0)} mm passo
                    </span>
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() =>
                        onApplyGeometry(candidate.rows, candidate.circuits, candidate.finPitchMm)
                      }
                    >
                      Aplicar
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs text-gray-600">
                    <span>Q: {fmtBR(candidate.totalCapacityW / 1000, 1)} kW</span>
                    <span>ΔP: {fmtBR(candidate.airPressureDropPa, 0)} Pa</span>
                    <span>Peso: {fmtBR(candidate.estimatedWeightKg, 1)} kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
