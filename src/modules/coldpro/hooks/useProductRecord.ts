import { useState, useCallback } from "react";
import { runBuildRecord, type EngineCallResult } from "../services/coldproEngineService";
import { useSessionStore } from "../stores/useSessionStore";
import type { ProductTechnicalRecordInput, ProductTechnicalRecord } from "@/modules/coldpro_v2";

export function useProductRecord() {
  const [result, setResult] = useState<EngineCallResult<ProductTechnicalRecord> | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);

  const calculate = useCallback(
    (input: ProductTechnicalRecordInput) => {
      setIsCalculating(true);
      try {
        const r = runBuildRecord(input);
        setResult(r);
        if (r.success && activeSessionId) {
          updateSession(activeSessionId, { lastRecord: r.data });
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
