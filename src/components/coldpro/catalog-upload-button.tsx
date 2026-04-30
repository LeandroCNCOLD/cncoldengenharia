/**
 * Botão de upload do CSV do catálogo CN COLD.
 * Faz parsing no client (sem subir o arquivo bruto) e envia em lotes
 * para a server function importCnCatalogCurves.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2 } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { parseCatalogCsv } from "@/lib/coldpro/catalog-csv-parser";
import { importCnCatalogCurves } from "@/server/cnCatalogImport.functions";

export function CatalogUploadButton({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [replaceAll, setReplaceAll] = useState(true);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  async function runImport(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCatalogCsv(text);
      if (parsed.rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada no CSV.");
        return;
      }
      toast.info(`Parsing concluído: ${parsed.rows.length} curvas. Enviando ao servidor…`);

      const CHUNK = 500;
      let total = 0;
      for (let i = 0; i < parsed.rows.length; i += CHUNK) {
        const chunk = parsed.rows.slice(i, i + CHUNK);
        const res = await importCnCatalogCurves({
          data: { rows: chunk, replaceAll: i === 0 ? replaceAll : false },
        });
        total += res.inserted;
      }
      toast.success(`Catálogo importado: ${total} curvas.`);
      onDone?.();
    } catch (err) {
      toast.error(`Falha ao importar: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      setConfirmFile(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setConfirmFile(f);
          e.target.value = "";
        }}
      />

      <Button onClick={pickFile} disabled={busy} size="sm" variant="outline">
        {busy ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-1 h-4 w-4" />
        )}
        Importar Catálogo CN COLD
      </Button>

      <AlertDialog open={!!confirmFile} onOpenChange={(o) => !o && setConfirmFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar catálogo de curvas</AlertDialogTitle>
            <AlertDialogDescription>
              Arquivo: <strong>{confirmFile?.name}</strong>
              <br />
              Cada linha do CSV vira uma curva em <code>cn_catalog_performance_curves</code>.
              Estas curvas são usadas como REFERÊNCIA DE VALIDAÇÃO — não substituem
              compressor_models, fan_models nem coils.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={replaceAll}
              onCheckedChange={(v) => setReplaceAll(v === true)}
            />
            <span className="flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              Substituir todas as curvas existentes
            </span>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirmFile) runImport(confirmFile);
              }}
            >
              {busy ? "Importando…" : "Importar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
