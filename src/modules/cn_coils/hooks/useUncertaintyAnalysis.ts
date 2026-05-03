/**
 * Hook para análise de incerteza com debounce.
 * Roda em background após o resultado nominal estar disponível.
 */
import { useEffect, useRef, useState } from "react";
import { runUncertaintyAnalysis } from "../engines/uncertainty/uncertaintyEngine";
import type {
  UncertaintyConfig,
  UncertaintyResult,
} from "../engines/uncertainty/uncertaintyTypes";
import type {
  CoilCycleInputs,
  CoilCycleResult,
} from "../engines/coil/coilCycleAdapter";

interface UseUncertaintyAnalysisOptions {
  inputs: CoilCycleInputs | null;
  nominalResult: CoilCycleResult | null;
  config?: Partial<UncertaintyConfig>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseUncertaintyAnalysisReturn {
  result: UncertaintyResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useUncertaintyAnalysis({
  inputs,
  nominalResult,
  config = {},
  debounceMs = 1500,
  enabled = true,
}: UseUncertaintyAnalysisOptions): UseUncertaintyAnalysisReturn {
  const [result, setResult] = useState<UncertaintyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!enabled || !inputs || !nominalResult?.success) {
      setResult(null);
      setIsLoading(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current = true;

    setIsLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      abortRef.current = false;
      try {
        const analysis = await runUncertaintyAnalysis(inputs, nominalResult, config);
        if (!abortRef.current) {
          setResult(analysis);
          setIsLoading(false);
        }
      } catch (err) {
        if (!abortRef.current) {
          setError(err instanceof Error ? err.message : "Erro na análise de incerteza");
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current = true;
    };
  }, [inputs, nominalResult, enabled, debounceMs, config]);

  return { result, isLoading, error };
}
