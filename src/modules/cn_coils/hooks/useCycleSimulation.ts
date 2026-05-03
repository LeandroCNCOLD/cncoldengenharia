/**
 * Hook que gerencia o estado e execução do CycleEngine.
 * Debounce de 800ms para evitar chamadas excessivas durante digitação.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { runCycleSimulation } from "../engines/cycle/cycleEngine";
import type { CycleResult, CycleSystemConfig } from "../engines/cycle/cycleTypes";

export type CycleSimulationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: CycleResult }
  | { status: "error"; message: string };

export function useCycleSimulation(config: CycleSystemConfig | null) {
  const [state, setState] = useState<CycleSimulationState>({ status: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (cfg: CycleSystemConfig) => {
    setState({ status: "running" });
    try {
      const result = await runCycleSimulation(cfg);
      setState({ status: "success", result });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Erro desconhecido no CycleEngine",
      });
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(config), 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config, run]);

  return state;
}
