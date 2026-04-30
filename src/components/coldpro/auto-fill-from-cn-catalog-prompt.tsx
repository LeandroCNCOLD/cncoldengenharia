/**
 * AutoFillFromCnCatalogPrompt
 *
 * Roda automaticamente ao abrir a ficha do equipamento. Se houver match com
 * o catálogo CN, mostra um diálogo listando o que será preenchido (evap, cond,
 * compressor, ventiladores). Se houver conflitos com componentes/links já
 * existentes, exibe e pergunta se deve sobrescrever.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  previewAutoFillFromCnCatalog,
  commitAutoFillFromCnCatalog,
  type AutoFillItemPreview,
} from "@/server/equipmentAutoFill.functions";

const STORAGE_KEY = "cn-autofill-dismissed:";

export function AutoFillFromCnCatalogPrompt({
  equipmentProjectId,
}: {
  equipmentProjectId: string;
}) {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewAutoFillFromCnCatalog);
  const commitFn = useServerFn(commitAutoFillFromCnCatalog);

  const dismissedKey = `${STORAGE_KEY}${equipmentProjectId}`;
  const [open, setOpen] = useState(false);

  const previewQuery = useQuery({
    queryKey: ["cn-autofill-preview", equipmentProjectId],
    queryFn: () => previewFn({ data: { equipmentProjectId } }),
    staleTime: 60_000,
  });

  // Abre automaticamente quando: tem match + tem itens disponíveis +
  // o usuário ainda não dispensou nesta sessão.
  useEffect(() => {
    if (!previewQuery.data) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(dismissedKey)) return;
    if (!previewQuery.data.matched) return;
    const hasNew = previewQuery.data.items.some((i) => i.available && !i.conflict);
    const hasConflict = previewQuery.data.items.some((i) => i.conflict);
    if (hasNew || hasConflict) setOpen(true);
  }, [previewQuery.data, dismissedKey]);

  const commitMut = useMutation({
    mutationFn: (overwrite: boolean) =>
      commitFn({ data: { equipmentProjectId, overwrite } }),
    onSuccess: (res) => {
      const r = res as { created: { role: string }[]; skipped: { role: string; reason: string }[] };
      toast.success(`Catálogo CN aplicado: ${r.created.length} item(ns).`);
      r.skipped.forEach((s) => toast.warning(`${s.role}: ${s.reason}`));
      qc.invalidateQueries({ queryKey: ["components", equipmentProjectId] });
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
      qc.invalidateQueries({ queryKey: ["cn-autofill-preview", equipmentProjectId] });
      sessionStorage.setItem(dismissedKey, "1");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = () => {
    sessionStorage.setItem(dismissedKey, "1");
    setOpen(false);
  };

  if (!previewQuery.data?.matched) return null;
  const data = previewQuery.data;
  const hasConflict = data.items.some((i) => i.conflict);

  return (
    <>
      {/* Botão sempre visível para reabrir manualmente */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1"
      >
        <Sparkles className="h-4 w-4" />
        Pré-preencher do catálogo CN
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Pré-preencher com dados do Catálogo CN
            </DialogTitle>
            <DialogDescription>
              Encontramos o modelo{" "}
              <span className="font-mono">{data.catalogModel}</span>
              {data.refrigerante ? ` (${data.refrigerante})` : ""} no catálogo.
              Os campos abaixo serão preenchidos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <ul className="divide-y rounded border">
            {data.items.map((item) => (
              <ItemRow key={item.role} item={item} />
            ))}
          </ul>

          {data.warnings.length > 0 && (
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              {data.warnings.slice(0, 4).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          {hasConflict && (
            <div className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Já existem componentes/vínculos para este equipamento. Sobrescrever
                vai apagá-los e recriá-los a partir do catálogo CN.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={dismiss} disabled={commitMut.isPending}>
              Agora não
            </Button>
            {hasConflict ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => commitMut.mutate(false)}
                  disabled={commitMut.isPending}
                >
                  {commitMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Preencher só os vazios
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => commitMut.mutate(true)}
                  disabled={commitMut.isPending}
                >
                  {commitMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sobrescrever
                </Button>
              </>
            ) : (
              <Button onClick={() => commitMut.mutate(false)} disabled={commitMut.isPending}>
                {commitMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Pré-preencher
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ItemRow({ item }: { item: AutoFillItemPreview }) {
  return (
    <li className="flex items-start justify-between gap-3 p-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.label}</span>
          {item.conflict && (
            <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-300">
              Conflito
            </Badge>
          )}
          {!item.available && (
            <Badge variant="secondary">Indisponível</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.available ? item.description : item.unavailableReason ?? item.description}
        </p>
        {item.conflict && item.existing && (
          <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">
            Já existe: {item.existing.label}
          </p>
        )}
      </div>
    </li>
  );
}
