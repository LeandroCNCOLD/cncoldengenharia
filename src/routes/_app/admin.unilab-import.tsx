import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import {
  importUnilabGeometryFactors,
  detectModeFromFilename,
  type UnilabCsvFile,
} from "@/modules/coldpro/unilabData/unilabGeometryFactorImporter";
import {
  createUnilabImportBatch,
  upsertUnilabGeometryFactors,
} from "@/modules/coldpro/unilabData/unilabGeometryFactorRepository";

export const Route = createFileRoute("/_app/admin/unilab-import")({
  component: UnilabImportPage,
});

interface FileSummary {
  name: string;
  mode: string | null;
  rowCount: number;
}

function UnilabImportPage() {
  const { isAdmin, loading } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [summaries, setSummaries] = useState<FileSummary[]>([]);
  const [notes, setNotes] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ batchId: string; total: number } | null>(null);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  function onFilesPicked(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    setFiles(arr);
    setSummaries(
      arr.map((f) => ({
        name: f.name,
        mode: detectModeFromFilename(f.name),
        rowCount: 0,
      })),
    );
    setResult(null);
  }

  async function handleImport() {
    if (files.length === 0) {
      toast.error("Selecione ao menos um CSV.");
      return;
    }
    setBusy(true);
    try {
      const csvFiles: UnilabCsvFile[] = await Promise.all(
        files.map(async (f) => ({ filename: f.name, text: await f.text() })),
      );
      const factors = importUnilabGeometryFactors(csvFiles);
      if (factors.length === 0) {
        toast.error(
          "Nenhuma linha reconhecida. Verifique se os nomes contêm GeometrieEspansioneDiretta, GeometrieCondensazione, GeometrieRaffreddamento ou GeometrieRiscaldamento.",
        );
        return;
      }
      const batchId = await createUnilabImportBatch(supabase, {
        sourceName: "unilab_all_tables",
        sourceVersion: version || undefined,
        notes: notes || undefined,
      });
      const total = await upsertUnilabGeometryFactors(supabase, factors, batchId);
      setResult({ batchId, total });
      // Atualiza contagens por arquivo (best-effort: rota pelo mode)
      const counts = new Map<string, number>();
      for (const f of factors) counts.set(f.sourceTable, (counts.get(f.sourceTable) ?? 0) + 1);
      setSummaries(
        files.map((f) => {
          const base = f.name.replace(/\.csv$/i, "");
          return {
            name: f.name,
            mode: detectModeFromFilename(f.name),
            rowCount: counts.get(base) ?? 0,
          };
        }),
      );
      toast.success(`Importados ${total} fatores em ${files.length} arquivo(s).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na importação.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const BUNDLED_CSVS = [
    "Tbl_GeometrieEspansioneDiretta.csv",
    "Tbl_GeometrieCondensazione.csv",
    "Tbl_GeometrieRaffreddamento.csv",
    "Tbl_GeometrieRiscaldamento.csv",
    "Tbl_GeometrieEvaporatoriaPompa.csv",
    "Tbl_GeometrieVapore.csv",
  ];

  async function handleImportFromServer() {
    setBusy(true);
    try {
      const csvFiles: UnilabCsvFile[] = [];
      for (const name of BUNDLED_CSVS) {
        const res = await fetch(`/unilab/${name}`);
        if (!res.ok) {
          toast.error(`Falha ao carregar /unilab/${name} (${res.status})`);
          continue;
        }
        csvFiles.push({ filename: name, text: await res.text() });
      }
      if (csvFiles.length === 0) {
        toast.error("Nenhum CSV carregado de /public/unilab.");
        return;
      }
      const factors = importUnilabGeometryFactors(csvFiles);
      if (factors.length === 0) {
        toast.error("Nenhuma linha reconhecida nos CSVs do servidor.");
        return;
      }
      const batchId = await createUnilabImportBatch(supabase, {
        sourceName: "unilab_all_tables",
        sourceVersion: version || "bundled",
        notes: notes || "auto-import from /public/unilab",
      });
      const total = await upsertUnilabGeometryFactors(supabase, factors, batchId);
      setResult({ batchId, total });
      const counts = new Map<string, number>();
      for (const f of factors) counts.set(f.sourceTable, (counts.get(f.sourceTable) ?? 0) + 1);
      setSummaries(
        csvFiles.map((f) => ({
          name: f.filename,
          mode: detectModeFromFilename(f.filename),
          rowCount: counts.get(f.filename.replace(/\.csv$/i, "")) ?? 0,
        })),
      );
      toast.success(`Importados ${total} fatores de ${csvFiles.length} arquivo(s) do servidor.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na importação automática.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar tabelas Unilab"
        description="Carregue os CSVs Tbl_Geometrie* exportados do Unilab para alimentar o Coil Simulator com fatores reais."
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csvs">Arquivos CSV</Label>
            <Input
              id="csvs"
              type="file"
              accept=".csv"
              multiple
              onChange={(e) => onFilesPicked(e.target.files)}
            />
            <p className="text-xs text-muted-foreground">
              Aceitos: <code>Tbl_GeometrieEspansioneDiretta.csv</code>,{" "}
              <code>Tbl_GeometrieCondensazione.csv</code>,{" "}
              <code>Tbl_GeometrieRaffreddamento.csv</code>,{" "}
              <code>Tbl_GeometrieRiscaldamento.csv</code>.
            </p>
          </div>

          {summaries.length > 0 && (
            <div className="rounded-md border divide-y">
              {summaries.map((s) => (
                <div key={s.name} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {s.mode ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="font-mono">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>modo: {s.mode ?? "—"}</span>
                    {s.rowCount > 0 && <span>{s.rowCount} linhas</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="version">Versão (opcional)</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="ex: 2024.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Origem, observações…"
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button onClick={handleImport} disabled={busy || files.length === 0}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Importar
            </Button>
          </div>

          {result && (
            <div className="rounded-md border bg-emerald-50 p-3 text-sm text-emerald-900">
              <div>Lote criado: <span className="font-mono">{result.batchId}</span></div>
              <div>Total de fatores gravados/atualizados: <strong>{result.total}</strong></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
