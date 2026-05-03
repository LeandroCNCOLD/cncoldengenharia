/**
 * Hook que gerencia o estado e execução do CycleEngine.
 * Modo `auto`: debounce 800ms (legado).
 * Modo `manual`: só roda ao chamar trigger().
 * Timeout de segurança: 30s.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { runCycleSimulation } from "../engines/cycle/cycleEngine";
import type { CycleResult, CycleSystemConfig } from "../engines/cycle/cycleTypes";

export type CycleSimulationStatus =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: CycleResult }
  | { status: "error"; message: string };

export type CycleSimulationState = CycleSimulationStatus & {
  trigger: () => void;
};

const SOLVER_TIMEOUT_MS = 30_000;

export function useCycleSimulation(
  config: CycleSystemConfig | null,
  options: { mode?: "auto" | "manual" } = {},
): CycleSimulationState {
  const mode = options.mode ?? "auto";
  const [state, setState] = useState<CycleSimulationStatus>({ status: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  const run = useCallback(async (cfg: CycleSystemConfig) => {
    const myId = ++runIdRef.current;
    setState({ status: "running" });
    try {
      const result = await Promise.race<CycleResult>([
        runCycleSimulation(cfg),
        new Promise<CycleResult>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Tempo limite excedido (30s). Verifique os parâmetros e tente novamente.",
                ),
              ),
            SOLVER_TIMEOUT_MS,
          ),
        ),
      ]);
      if (myId !== runIdRef.current) return;
      setState({ status: "success", result });
    } catch (err) {
      if (myId !== runIdRef.current) return;
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Erro desconhecido no CycleEngine",
      });
    }
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    if (!config) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(config), 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config, run, mode]);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const trigger = useCallback(() => {
    const cfg = configRef.current;
    if (cfg) void run(cfg);
  }, [run]);

  return { ...state, trigger } as CycleSimulationState;
}
