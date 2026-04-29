import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, ChevronLeft, RefreshCcw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  approveMapped,
  approveMappedBulk,
  getRawRecord,
  listMappedForReview,
  rejectMapped,
  rejectMappedBulk,
} from "@/lib/coldpro/technical-library";
import type {
  TechnicalMappedRecord,
  TechnicalRawRecord,
} from "@/modules/coldpro/library/types";

export const Route = createFileRoute("/_app/coldpro/admin/revisao-tecnica")({
  component: TechnicalReviewPage,
});

function TechnicalReviewPage() {
  const { isAdmin, loading, user } = useAuth();
  const [items, setItems] = useState<TechnicalMappedRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<TechnicalMappedRecord | null>(null);
  const [rawSelected, setRawSelected] = useState<TechnicalRawRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setCheckedIds(new Set());
    try {
      const list = await listMappedForReview(200);
      setItems(list);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
  }, [isAdmin]);

  useEffect(() => {
    if (!selected?.raw_record_id) {
      setRawSelected(null);
      return;
    }
    let cancel = false;
    (async () => {
      const r = await getRawRecord(selected.raw_record_id!);
      if (!cancel) setRawSelected(r);
    })();
    return () => {
      cancel = true;
    };
  }, [selected]);

  const grouped = useMemo(() => {
    const by: Record<string, TechnicalMappedRecord[]> = {};
    for (const it of items) {
      const k = it.entity_type;
      (by[k] ??= []).push(it);
    }
    return by;
  }, [items]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const handleApprove = async () => {
    if (!selected) return;
    const res = await approveMapped(selected, user?.id ?? null);
    if (!res.ok) {
      toast.error(res.error ?? "Falha ao aprovar.");
      return;
    }
    toast.success("Componente aprovado e adicionado à biblioteca técnica.");
    setSelected(null);
    refresh();
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) {
      toast.error("Informe um motivo para rejeitar.");
      return;
    }
    await rejectMapped(selected.id, user?.id ?? null, rejectReason.trim());
    toast.success("Registro rejeitado.");
    setRejectReason("");
    setSelected(null);
    refresh();
  };

  const toggleOne = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setCheckedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
  };

  const allChecked = items.length > 0 && checkedIds.size === items.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  const handleBulkApprove = async () => {
    const list = items.filter((i) => checkedIds.has(i.id));
    if (list.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await approveMappedBulk(list, user?.id ?? null);
      if (res.failed === 0) {
        toast.success(`${res.ok} registros aprovados.`);
      } else {
        toast.warning(
          `${res.ok} aprovados, ${res.failed} falharam${res.errors[0] ? `: ${res.errors[0]}` : "."}`,
        );
      }
      setCheckedIds(new Set());
      setSelected(null);
      refresh();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkReject = async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;
    if (!rejectReason.trim()) {
      toast.error("Informe um motivo para rejeitar em massa.");
      return;
    }
    setBulkBusy(true);
    try {
      await rejectMappedBulk(ids, user?.id ?? null, rejectReason.trim());
      toast.success(`${ids.length} registros rejeitados.`);
      setRejectReason("");
      setCheckedIds(new Set());
      setSelected(null);
      refresh();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Revisão Técnica"
        description="Aprove ou rejeite registros mapeados antes de entrarem na biblioteca técnica oficial usada pelo motor."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/coldpro/admin/banco-tecnico">
                <ChevronLeft className="mr-1 h-4 w-4" /> Banco Técnico
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
              <RefreshCcw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
          </div>
        }
      />

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!busy && items.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum registro mapeado aguardando revisão. Quando você importar dados
            via fluxo universal (BITZER, Danfoss, Torin, Unilab…), os candidatos
            aparecem aqui para aprovação.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(grouped).flatMap(([entity, list]) =>
                  list.map((m) => (
                    <TableRow
                      key={m.id}
                      onClick={() => setSelected(m)}
                      className={
                        selected?.id === m.id
                          ? "cursor-pointer bg-accent/50"
                          : "cursor-pointer hover:bg-accent/30"
                      }
                    >
                      <TableCell className="text-xs">{entity}</TableCell>
                      <TableCell className="text-xs">{m.manufacturer ?? "—"}</TableCell>
                      <TableCell className="text-xs">{m.model ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {(m.confidence_score * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {m.mapping_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                Selecione um registro para comparar raw vs normalized.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mapped — normalized_json
                  </p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-[11px]">
                    {JSON.stringify(selected.normalized_json, null, 2)}
                  </pre>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Raw — raw_json
                  </p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-[11px]">
                    {rawSelected
                      ? JSON.stringify(rawSelected.raw_json, null, 2)
                      : "(sem registro raw vinculado)"}
                  </pre>
                </div>

                {Array.isArray(selected.validation_errors_json) &&
                  selected.validation_errors_json.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-destructive">
                        Erros de validação
                      </p>
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-destructive/5 p-3 text-[11px] text-destructive">
                        {JSON.stringify(selected.validation_errors_json, null, 2)}
                      </pre>
                    </div>
                  )}

                <div className="space-y-2">
                  <Textarea
                    placeholder="Motivo da rejeição (opcional para aprovar)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleApprove} className="flex-1">
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      onClick={handleReject}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="mr-1 h-4 w-4" /> Rejeitar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
