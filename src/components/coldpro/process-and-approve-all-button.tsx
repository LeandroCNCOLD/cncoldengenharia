import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  startPipelineInBackground,
  subscribePipeline,
  type PipelineState,
} from "@/lib/coldpro/background-pipeline";

interface Props {
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
  onDone?: () => void;
}

/**
 * Botão "Processar e aprovar tudo" — dispara o pipeline em background
 * (continua rodando se o usuário trocar de aba/rota). O progresso é lido
 * de um singleton compartilhado.
 */
export function ProcessAndApproveAllButton({ variant = "default", size = "sm", onDone }: Props) {
  const qc = useQueryClient();
  const [state, setState] = useState<PipelineState | null>(null);

  useEffect(() => {
    const unsub = subscribePipeline((s) => {
      setState(s);
      if (s.phase === "done" || s.phase === "error" || s.phase === "archiving") {
        // invalida contadores em transições importantes
        void qc.invalidateQueries({ queryKey: ["tech-raw-count"] });
        void qc.invalidateQueries({ queryKey: ["tech-unmapped-count"] });
        void qc.invalidateQueries({ queryKey: ["tech-archived-count"] });
        void qc.invalidateQueries({ queryKey: ["tech-mapped-counts"] });
        void qc.invalidateQueries({ queryKey: ["technical_components"] });
      }
    });
    return unsub;
  }, [qc]);

  const running = state?.phase && state.phase !== "idle" && state.phase !== "done" && state.phase !== "error";

  // toast quando finaliza
  useEffect(() => {
    if (!state) return;
    if (state.phase === "done") {
      toast.success(
        `Pipeline concluído — ${state.totals.mapped} mapeado(s), ${state.totals.created} novo(s), ${state.totals.updated} atualizado(s), ${state.totals.archived} arquivado(s).`,
      );
      onDone?.();
    }
    if (state.phase === "error") {
      toast.error(`Falha no pipeline: ${state.error ?? "erro desconhecido"}`);
    }
  }, [state?.phase]);

  const handle = () => {
    void startPipelineInBackground();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={size} variant={variant} disabled={!!running}>
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {running && state?.message ? `Rodando · ${state.message}` : "Processar e aprovar tudo"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Processar e aprovar todos os RAW?</AlertDialogTitle>
          <AlertDialogDescription>
            O sistema vai mapear todos os pendentes, instalar os reconhecidos
            como componentes aprovados (sobrescrevendo duplicatas) e{" "}
            <strong>arquivar</strong> os que nenhum mapper reconheceu. A operação roda em
            <strong> segundo plano</strong> — você pode trocar de tela à vontade que ela continua.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handle}>Confirmar e rodar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
