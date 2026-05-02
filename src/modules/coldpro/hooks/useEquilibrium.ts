import { useState, useCallback } from "react";
import { runEquilibrium, type EngineCallResult } from "../services/coldproEngineService";
import { useSessionStore } from "../stores/useSessionStore";
import type { SystemComponentsInput, SystemEquilibriumResult } from "@/modules/coldpro_v2";

export function useEquilibrium() {
  const [result, setResult] = useState<EngineCallResult<SystemEquilibriumResult> | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);

  const calculate = useCallback(
    (input: SystemComponentsInput) => {
      setIsCalculating(true);
      try {
        const r = runEquilibrium(input);
        setResult(r);
        if (r.success && activeSessionId) {
          updateSession(activeSessionId, {
            lastEquilibriumResult: r.data,
            systemInput: input,
          });
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
