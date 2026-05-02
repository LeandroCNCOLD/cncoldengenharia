import { useState, useCallback } from "react";
import { runPerformanceCurve, type EngineCallResult } from "../services/coldproEngineService";
import { useSessionStore } from "../stores/useSessionStore";
import type {
  ProductPerformanceCurveInput,
  ProductPerformanceCurveResult,
} from "@/modules/coldpro_v2";

export function usePerformanceCurve() {
  const [result, setResult] = useState<EngineCallResult<ProductPerformanceCurveResult> | null>(
    null,
  );
  const [isCalculating, setIsCalculating] = useState(false);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);

  const calculate = useCallback(
    (input: ProductPerformanceCurveInput) => {
      setIsCalculating(true);
      try {
        const r = runPerformanceCurve(input);
        setResult(r);
        if (r.success && activeSessionId) {
          updateSession(activeSessionId, { lastCurveResult: r.data });
        }
        return r;
      } finally {
        setIsCalculating(false);
      }
    },
    [activeSessionId, updateSession],
  );

  return { result, isCalculating, calculate };
}
