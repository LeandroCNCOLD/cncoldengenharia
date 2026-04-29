import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { processUnmappedRawRecords } from "@/server/processRawRecords.functions";

interface Props {
  /** Se informado, processa apenas esse batch. Senão, processa todos. */
  batchId?: string | null;
  /** variant do botão (default: default). */
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  /** Hook chamado quando o ciclo completo termina. */
  onDone?: () => void;
}

/**
 * Botão "Processar não mapeados" — chama processUnmappedRawRecords em loop
 * até esvaziar a fila (ou hit max iterations). Mostra progresso via toast.
 */
export function ProcessUnmappedButton({ batchId, variant = "default", size = "sm", onDone }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const handle = async () => {
    setRunning(true);
    setProgress("");
    const totals = {
      processed: 0,
      mapped: 0,
      unmapped: 0,
      iterations: 0,
    };
    try {
      // Loop até que uma rodada não processe nada
      for (let i = 0; i < 80; i++) {
        const res = await processUnmappedRawRecords({
          data: { batchId: batchId ?? null, pageSize: 150, maxPages: 3 },
        });
        totals.iterations++;
        totals.processed += res.processed;
        totals.mapped += res.mapped;
        totals.unmapped += res.unmapped;
        setProgress(`processados: ${totals.processed} · mapeados: ${totals.mapped}`);
        if (res.processed === 0) break;
      }
      toast.success(
        `Pipeline concluído — ${totals.mapped} mapeado(s), ${totals.unmapped} não reconhecido(s) de ${totals.processed} processado(s).`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tech-raw-count"] }),
        qc.invalidateQueries({ queryKey: ["tech-unmapped-count"] }),
        qc.invalidateQueries({ queryKey: ["tech-mapped-counts"] }),
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
    <Button size={size} variant={variant} onClick={handle} disabled={running}>
      {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
      {running && progress ? `Processando… ${progress}` : "Processar não mapeados"}
    </Button>
  );
}
