import { useState } from "react";
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
import { processUnmappedRawRecords } from "@/server/processRawRecords.functions";
import { approveAllMappedRecords } from "@/server/approveMappedRecords.functions";

interface Props {
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
  onDone?: () => void;
}

/**
 * Botão "Processar e aprovar tudo" — roda o pipeline completo:
 * 1. processUnmappedRawRecords em loop até esvaziar
 * 2. approveAllMappedRecords em loop até esvaziar
 * Sobrescreve duplicatas. Apenas mapeados com confidence > 0 viram componentes.
 */
export function ProcessAndApproveAllButton({ variant = "default", size = "sm", onDone }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const handle = async () => {
    setRunning(true);
    setProgress("iniciando…");
    const totals = {
      processed: 0,
      mapped: 0,
      created: 0,
      updated: 0,
      errors: 0,
    };
    try {
      // Fase 1: mapear tudo
      setProgress("mapeando…");
      for (let i = 0; i < 200; i++) {
        const res = await processUnmappedRawRecords({
          data: { batchId: null, pageSize: 200, maxPages: 3 },
        });
        totals.processed += res.processed;
        totals.mapped += res.mapped;
        setProgress(`mapeando · ${totals.processed} processados, ${totals.mapped} mapeados`);
        if (res.processed === 0) break;
      }

      // Fase 2: aprovar e instalar no banco
      setProgress("aprovando…");
      for (let i = 0; i < 200; i++) {
        const res = await approveAllMappedRecords({
          data: { pageSize: 200, maxPages: 3, includeNeedsReview: false },
        });
        totals.created += res.created;
        totals.updated += res.updated;
        totals.errors += res.errors;
        setProgress(
          `aprovando · ${totals.created} novos, ${totals.updated} atualizados, ${totals.errors} erros`,
        );
        if (res.processed === 0) break;
      }

      toast.success(
        `Pipeline concluído — ${totals.mapped} mapeado(s), ${totals.created} novo(s) componente(s), ${totals.updated} atualizado(s).`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tech-raw-count"] }),
        qc.invalidateQueries({ queryKey: ["tech-unmapped-count"] }),
        qc.invalidateQueries({ queryKey: ["tech-mapped-counts"] }),
        qc.invalidateQueries({ queryKey: ["technical_components"] }),
      ]);
      onDone?.();
    } catch (err) {
      toast.error(`Falha no pipeline: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={size} variant={variant} disabled={running}>
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {running && progress ? `Rodando · ${progress}` : "Processar e aprovar tudo"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Processar e aprovar todos os RAW?</AlertDialogTitle>
          <AlertDialogDescription>
            Vai mapear todos os ~13k registros pendentes e instalar como componentes técnicos
            aprovados. Apenas registros que algum mapper reconheceu (confidence &gt; 0) viram
            componentes — o resto fica como <code>unmapped</code>. Duplicatas (mesmo
            fabricante+modelo+código) serão <strong>sobrescritas</strong>. Operação pode levar
            alguns minutos.
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
