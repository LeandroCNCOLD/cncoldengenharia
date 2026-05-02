import { useState, useCallback } from "react";
import { runOperatingMap, type EngineCallResult } from "../services/coldproEngineService";
import { useSessionStore } from "../stores/useSessionStore";
import type { OperatingMapInput, OperatingMapResult } from "@/modules/coldpro_v2";

export function useOperatingMap() {
  const [result, setResult] = useState<EngineCallResult<OperatingMapResult> | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);

  const calculate = useCallback(
    (input: OperatingMapInput) => {
      setIsCalculating(true);
      try {
        const r = runOperatingMap(input);
        setResult(r);
        if (r.success && activeSessionId) {
          updateSession(activeSessionId, { lastMapResult: r.data });
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
