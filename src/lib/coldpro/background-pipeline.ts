/**
 * Background pipeline runner — singleton fora do React.
 *
 * Mantém o "Processar e aprovar tudo" rodando mesmo se o usuário trocar
 * de aba/rota. Não persiste entre reloads (cada aba tem o seu).
 *
 * Estado é exposto via subscribe() para componentes ouvirem progresso.
 */
import { processUnmappedRawRecords } from "@/server/processRawRecords.functions";
import { approveAllMappedRecords } from "@/server/approveMappedRecords.functions";
import { archiveUnmappableRawRecords } from "@/server/archiveUnmappableRecords.functions";

export type PipelinePhase = "idle" | "mapping" | "approving" | "archiving" | "done" | "error";

export interface PipelineState {
  phase: PipelinePhase;
  message: string;
  totals: {
    processed: number;
    mapped: number;
    created: number;
    updated: number;
    archived: number;
    errors: number;
  };
  error?: string;
  startedAt: number | null;
  finishedAt: number | null;
}

const initial: PipelineState = {
  phase: "idle",
  message: "",
  totals: { processed: 0, mapped: 0, created: 0, updated: 0, archived: 0, errors: 0 },
  startedAt: null,
  finishedAt: null,
};

let state: PipelineState = { ...initial };
let runPromise: Promise<void> | null = null;
const listeners = new Set<(s: PipelineState) => void>();

function emit() {
  for (const l of listeners) l({ ...state, totals: { ...state.totals } });
}

function update(patch: Partial<PipelineState>) {
  state = { ...state, ...patch, totals: { ...state.totals, ...(patch.totals ?? {}) } };
  emit();
}

export function subscribePipeline(listener: (s: PipelineState) => void): () => void {
  listeners.add(listener);
  // emit current state immediately
  listener({ ...state, totals: { ...state.totals } });
  return () => listeners.delete(listener);
}

export function getPipelineState(): PipelineState {
  return { ...state, totals: { ...state.totals } };
}

export function isPipelineRunning(): boolean {
  return runPromise !== null;
}

/**
 * Inicia o pipeline em background. Se já estiver rodando, retorna a Promise
 * existente (idempotente).
 */
export function startPipelineInBackground(): Promise<void> {
  if (runPromise) return runPromise;

  state = {
    ...initial,
    phase: "mapping",
    message: "iniciando…",
    startedAt: Date.now(),
  };
  emit();

  runPromise = (async () => {
    try {
      // Fase 1: mapear
      update({ phase: "mapping", message: "mapeando registros…" });
      for (let i = 0; i < 500; i++) {
        const res = await processUnmappedRawRecords({
          data: { batchId: null, pageSize: 200, maxPages: 3 },
        });
        state.totals.processed += res.processed;
        state.totals.mapped += res.mapped;
        update({
          message: `mapeando · ${state.totals.processed} processados, ${state.totals.mapped} reconhecidos`,
        });
        if (res.processed === 0) break;
      }

      // Fase 2: aprovar
      update({ phase: "approving", message: "aprovando e instalando…" });
      for (let i = 0; i < 500; i++) {
        const res = await approveAllMappedRecords({
          data: { pageSize: 200, maxPages: 3, includeNeedsReview: false },
        });
        state.totals.created += res.created;
        state.totals.updated += res.updated;
        state.totals.errors += res.errors;
        update({
          message: `aprovando · ${state.totals.created} novos, ${state.totals.updated} atualizados`,
        });
        if (res.processed === 0) break;
      }

      // Fase 3: arquivar não mapeáveis
      update({ phase: "archiving", message: "arquivando não reconhecidos…" });
      for (let i = 0; i < 50; i++) {
        const res = await archiveUnmappableRawRecords({
          data: { pageSize: 500, maxPages: 5 },
        });
        state.totals.archived += res.archived;
        update({ message: `arquivando · ${state.totals.archived} arquivados` });
        if (res.archived === 0) break;
      }

      update({
        phase: "done",
        message: "concluído",
        finishedAt: Date.now(),
      });
    } catch (err) {
      update({
        phase: "error",
        message: "falha",
        error: err instanceof Error ? err.message : String(err),
        finishedAt: Date.now(),
      });
    } finally {
      runPromise = null;
    }
  })();

  return runPromise;
}

export function resetPipelineState() {
  if (runPromise) return; // não pode resetar enquanto roda
  state = { ...initial };
  emit();
}
