import { useCallback, useState } from "react";
import { generateOperatingMap } from "../engines/operatingMap/operatingMapEngine";
import type {
  OperatingMapConfig,
  OperatingMapResult,
} from "../engines/operatingMap/operatingMapTypes";
import type { CoilCycleInputs } from "../engines/coil/coilCycleAdapter";

export function useOperatingMap(baseInputs: CoilCycleInputs) {
  const [result, setResult] = useState<OperatingMapResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (config: OperatingMapConfig) => {
      setIsLoading(true);
      setError(null);
      try {
        const map = await generateOperatingMap(baseInputs, config);
        setResult(map);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [baseInputs],
  );

  return { result, isLoading, error, generate };
}
