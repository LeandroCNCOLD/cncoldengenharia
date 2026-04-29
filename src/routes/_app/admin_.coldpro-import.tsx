import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, FileArchive, FileSpreadsheet, FileText, ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin_/coldpro-import")({
  component: ColdproImportPage,
});

interface UploadedRef {
  kind: "zip" | "index" | "polynomials";
  fileName: string;
  storagePath: string;
  sizeBytes: number;
}

function ColdproImportPage() {
  const { isAdmin, loading, user } = useAuth();

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [indexFile, setIndexFile] = useState<File | null>(null);
  const [polyFile, setPolyFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedRef[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  async function uploadOne(file: File, kind: UploadedRef["kind"]): Promise<UploadedRef> {
    const ts = Date.now();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user?.id ?? "anon"}/${ts}_${kind}_${safeName}`;
    const { error } = await supabase.storage
      .from("coldpro-imports")
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (error) throw new Error(`Upload ${kind} falhou: ${error.message}`);
    return { kind, fileName: file.name, storagePath: path, sizeBytes: file.size };
  }

  async function handleUpload() {
    if (!zipFile && !indexFile && !polyFile) {
      toast.error("Selecione ao menos um arquivo.");
      return;
    }
    setBusy(true);
    try {
      const refs: UploadedRef[] = [];
      if (zipFile) refs.push(await uploadOne(zipFile, "zip"));
      if (indexFile) refs.push(await uploadOne(indexFile, "index"));
      if (polyFile) refs.push(await uploadOne(polyFile, "polynomials"));

      const sourceFile =
        refs.find((r) => r.kind === "zip")?.fileName ??
        refs.find((r) => r.kind === "index")?.fileName ??
        refs[0]?.fileName ??
        "coldpro-import";

      const insertRow = {
        source_file: sourceFile,
        source_version: version || null,
        status: "uploaded",
        notes: notes || null,
        created_by: user?.id ?? null,
        summary_json: { uploads: refs } as unknown as Record<string, unknown>,
      };
      const { data: batch, error: batchErr } = await supabase
        .from("unilab_import_batches_v2")
        .insert(insertRow)
        .select("id")
        .single();
      if (batchErr) throw new Error(batchErr.message);

      setUploaded(refs);
      setBatchId(batch.id);
      toast.success("Arquivos enviados", {
        description: `Batch ${batch.id.slice(0, 8)} criado com ${refs.length} arquivo(s).`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Falha no upload", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Admin
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Importação banco técnico ColdPro"
        description="Etapa 8a — upload dos arquivos de origem (ZIP Unilab, índice mestre, polinômios). O parsing/import será feito na Etapa 8b."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivos de origem</CardTitle>
          <CardDescription>
            Os 3 arquivos são opcionais individualmente, mas você pode enviar todos juntos para registrar
            um lote completo. Eles ficam armazenados em <code>coldpro-imports</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilePicker
            icon={<FileArchive className="h-4 w-4" />}
            label="UNILAB_COILS6_COMPLETO.zip"
            accept=".zip"
            file={zipFile}
            onPick={setZipFile}
          />
          <FilePicker
            icon={<FileText className="h-4 w-4" />}
            label="00_INDICE_MESTRE.csv"
            accept=".csv"
            file={indexFile}
            onPick={setIndexFile}
          />
          <FilePicker
            icon={<FileSpreadsheet className="h-4 w-4" />}
            label="EQUACOES_POLINOMIAIS_COMPLETO.xlsx"
            accept=".xlsx,.xls"
            file={polyFile}
            onPick={setPolyFile}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Versão / tag (opcional)</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="ex.: 2026-04"
              />
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                placeholder="Observações sobre este lote"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={handleUpload} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              Enviar arquivos e criar lote
            </Button>
          </div>
        </CardContent>
      </Card>

      {batchId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lote criado</CardTitle>
            <CardDescription className="font-mono text-xs">{batchId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploaded.map((u) => (
              <div
                key={u.storagePath}
                className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{u.kind}</Badge>
                  <span className="font-medium">{u.fileName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(u.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Próxima etapa (8b): leitura do índice, descompactação do ZIP, parsing do XLSX e mapeamento
              para as tabelas técnicas (geometrias, fatores, refrigerantes, polinômios, compressores,
              ventiladores, correlações).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilePicker({
  icon,
  label,
  accept,
  file,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <Input
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {file && (
        <p className="mt-1 text-xs text-muted-foreground">
          {file.name} — {(file.size / 1024).toFixed(1)} KB
        </p>
      )}
    </div>
  );
}
