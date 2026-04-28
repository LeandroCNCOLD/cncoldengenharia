import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ACCEPTED_EXTENSIONS,
  BATCH_STATUS_LABELS,
  EQUIPMENT_KINDS,
  type EquipmentKind,
  type UploadBatchStatus,
  approveBatch,
  buildPreCatalog,
  createEquipment,
  getSignedUrl,
  listBatches,
  listEquipments,
  listFilesByBatch,
  processBatch,
  rejectBatch,
  uploadEquipmentBatch,
} from "@/lib/equipment-uploads";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, RefreshCw, Upload, FileText, Folder } from "lucide-react";

export const Route = createFileRoute("/_app/uploads")({
  component: UploadsPage,
});

function statusVariant(s: UploadBatchStatus) {
  switch (s) {
    case "approved":
      return "default" as const;
    case "rejected":
      return "destructive" as const;
    case "needs_review":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function UploadsPage() {
  const [equipments, setEquipments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [filesByBatch, setFilesByBatch] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(
    null,
  );

  const [preCatalog, setPreCatalog] = useState<any | null>(null);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function refreshEquipments() {
    setLoading(true);
    try {
      const list = await listEquipments();
      setEquipments(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshBatches(equipmentId: string) {
    const list = await listBatches(equipmentId);
    setBatches(list);
    const filesMap: Record<string, any[]> = {};
    for (const b of list) {
      filesMap[b.id] = await listFilesByBatch(b.id);
    }
    setFilesByBatch(filesMap);
  }

  useEffect(() => {
    refreshEquipments();
  }, []);

  useEffect(() => {
    if (selectedId) {
      refreshBatches(selectedId);
      buildPreCatalog(selectedId).then(setPreCatalog).catch(() => setPreCatalog(null));
    }
  }, [selectedId]);

  const selectedEquipment = useMemo(
    () => equipments.find((e) => e.id === selectedId) ?? null,
    [equipments, selectedId],
  );

  async function handleUpload() {
    if (!selectedId || !userId) return;
    if (!files.length) {
      toast.error("Selecione pelo menos um arquivo.");
      return;
    }
    setUploading(true);
    setProgress({ done: 0, total: files.length, name: "" });
    try {
      const r = await uploadEquipmentBatch({
        equipmentId: selectedId,
        files,
        notes,
        userId,
        onProgress: (done, total, name) => setProgress({ done, total, name }),
      });
      toast.success(`Lote ${r.batch.batch_label} criado (${r.files.length} arquivo(s)).`);
      setFiles([]);
      setNotes("");
      await refreshBatches(selectedId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function handleProcess(batchId: string) {
    if (!userId) return;
    setProcessingBatchId(batchId);
    try {
      const res = await processBatch(batchId, userId);
      toast.success(`Pasta processada: ${res.status}`);
      if (selectedId) {
        await refreshBatches(selectedId);
        setPreCatalog(await buildPreCatalog(selectedId));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessingBatchId(null);
    }
  }

  async function handleApprove(batchId: string) {
    if (!userId) return;
    try {
      await approveBatch(batchId, userId);
      toast.success("Lote aprovado para o catálogo.");
      if (selectedId) await refreshBatches(selectedId);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleReject(batchId: string) {
    try {
      await rejectBatch(batchId);
      toast.success("Lote rejeitado.");
      if (selectedId) await refreshBatches(selectedId);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function openFile(path: string) {
    try {
      const url = await getSignedUrl(path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Upload Técnico</h1>
          <p className="text-muted-foreground">
            Pastas técnicas por equipamento. Cada upload múltiplo gera um lote/versão.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshEquipments} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <NewEquipmentDialog
            userId={userId}
            onCreated={async (id) => {
              await refreshEquipments();
              setSelectedId(id);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Lista de pastas */}
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Folder className="h-4 w-4" /> Pastas de Equipamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-auto">
            {equipments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma pasta criada ainda.</p>
            )}
            {equipments.map((eq) => (
              <button
                key={eq.id}
                onClick={() => setSelectedId(eq.id)}
                className={`w-full text-left p-2 rounded-md hover:bg-muted transition ${
                  selectedId === eq.id ? "bg-muted" : ""
                }`}
              >
                <div className="font-medium text-sm">{eq.name}</div>
                <div className="text-xs text-muted-foreground">
                  {eq.internal_code ?? eq.slug} · {eq.equipment_kind}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Detalhes da pasta */}
        <div className="col-span-12 md:col-span-8 space-y-6">
          {selectedEquipment ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedEquipment.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedEquipment.slug} · {selectedEquipment.equipment_kind}
                    {selectedEquipment.default_refrigerant
                      ? ` · ${selectedEquipment.default_refrigerant}`
                      : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Adicionar arquivos (PDF/XLS/CSV/DOCX/TXT/PNG/JPG)</Label>
                    <Input
                      type="file"
                      multiple
                      accept={ACCEPTED_EXTENSIONS.map((e) => "." + e).join(",")}
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                    {files.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {files.length} arquivo(s) selecionado(s)
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Observação do lote</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex.: ficha + curva do compressor revisão maio/2026"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleUpload} disabled={uploading || !files.length}>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Enviar lote
                    </Button>
                    {progress && (
                      <div className="text-xs text-muted-foreground">
                        {progress.done}/{progress.total} – {progress.name}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Lotes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lotes técnicos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {batches.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum lote enviado ainda.
                    </p>
                  )}
                  {batches.map((b) => {
                    const bf = filesByBatch[b.id] ?? [];
                    return (
                      <div key={b.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {b.batch_label}{" "}
                              <Badge variant={statusVariant(b.status)} className="ml-2">
                                {BATCH_STATUS_LABELS[b.status as UploadBatchStatus]}
                              </Badge>
                            </div>
                            {b.notes && (
                              <div className="text-xs text-muted-foreground">{b.notes}</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcess(b.id)}
                              disabled={processingBatchId === b.id}
                            >
                              {processingBatchId === b.id ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : null}
                              Processar pasta técnica
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(b.id)}>
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(b.id)}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {bf.map((f: any) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted"
                            >
                              <button
                                className="flex items-center gap-2 truncate"
                                onClick={() => openFile(f.storage_path)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span className="truncate">{f.original_filename}</span>
                              </button>
                              <div className="flex gap-2 items-center">
                                {f.detected_technical_type && (
                                  <Badge variant="outline">{f.detected_technical_type}</Badge>
                                )}
                                <Badge variant="secondary">{f.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Pré-catálogo */}
              {preCatalog && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pré-catálogo do equipamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-3 gap-4">
                      <PreSection title="Evaporador" data={preCatalog.evaporatorData} />
                      <PreSection title="Condensador" data={preCatalog.condenserData} />
                      <PreSection title="Compressor" data={preCatalog.compressorData} />
                    </div>
                    <div>
                      <div className="font-medium">
                        Confiança: {(preCatalog.confidenceScore * 100).toFixed(0)}%
                      </div>
                      {preCatalog.missingFields.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Faltando: {preCatalog.missingFields.join(", ")}
                        </div>
                      )}
                    </div>
                    {preCatalog.conflicts.length > 0 && (
                      <div className="border border-destructive/40 rounded p-2 space-y-1">
                        <div className="text-destructive font-medium">
                          Conflitos detectados ({preCatalog.conflicts.length})
                        </div>
                        {preCatalog.conflicts.map((c: any, i: number) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium">{c.field}:</span>{" "}
                            {c.sources
                              .map((s: any) => `${s.filename}=${JSON.stringify(s.value)}`)
                              .join(" ↔ ")}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Selecione ou crie uma pasta de equipamento à esquerda.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PreSection({ title, data }: { title: string; data: Record<string, any> }) {
  const entries = Object.entries(data);
  return (
    <div className="border rounded p-2">
      <div className="font-medium mb-1">{title}</div>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground">— sem dados —</div>
      ) : (
        <ul className="text-xs space-y-0.5">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewEquipmentDialog({
  userId,
  onCreated,
}: {
  userId: string | null;
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [family, setFamily] = useState("");
  const [kind, setKind] = useState<EquipmentKind>("unidade_condensadora");
  const [refrigerant, setRefrigerant] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!userId) {
      toast.error("Faça login.");
      return;
    }
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const created = await createEquipment({
        name: name.trim(),
        internalCode: internalCode.trim() || undefined,
        family: family.trim() || undefined,
        equipmentKind: kind,
        defaultRefrigerant: refrigerant.trim() || undefined,
        description: description.trim() || undefined,
        userId,
      });
      toast.success("Pasta criada.");
      setOpen(false);
      setName("");
      setInternalCode("");
      setFamily("");
      setRefrigerant("");
      setDescription("");
      onCreated(created.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> Nova pasta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta de equipamento</DialogTitle>
          <DialogDescription>
            Cada pasta agrupa todos os arquivos técnicos de um equipamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome do equipamento *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CN2000LT" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código interno</Label>
              <Input
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                placeholder="cn-2000-lt"
              />
            </div>
            <div className="space-y-1">
              <Label>Família</Label>
              <Input
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="Linha LT"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as EquipmentKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fluido refrigerante padrão</Label>
              <Input
                value={refrigerant}
                onChange={(e) => setRefrigerant(e.target.value)}
                placeholder="R-404A"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
