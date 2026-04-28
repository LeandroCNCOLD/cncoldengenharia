import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ALLOWED_KINDS_BY_TYPE,
  acceptAttrFor,
  removeComponentFile,
  uploadComponentFile,
  UploadValidationError,
} from "@/lib/uploads";
import {
  COMPONENT_TYPE_LABELS,
  type ComponentType,
} from "@/lib/component-schema";

export const Route = createFileRoute("/_app/uploads")({
  component: UploadsPage,
});

function UploadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedComponent, setSelectedComponent] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: components } = useQuery({
    queryKey: ["components-for-upload"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["uploads-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_files")
        .select(
          "id, file_name, file_kind, processing_status, uploaded_at, component_id, storage_path, components(name, type)",
        )
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selected = components?.find((c) => c.id === selectedComponent);
  const selectedType = selected?.type as ComponentType | undefined;

  async function handleUpload() {
    if (!file || !selected || !user) return;
    setBusy(true);
    try {
      await uploadComponentFile({
        componentId: selected.id,
        componentType: selected.type as ComponentType,
        file,
        userId: user.id,
      });
      toast.success(`Arquivo enviado: ${file.name}`);
      setFile(null);
      void refetch();
      qc.invalidateQueries({ queryKey: ["dashboard-files"] });
      qc.invalidateQueries({ queryKey: ["components-list"] });
    } catch (e) {
      const msg =
        e instanceof UploadValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Erro inesperado.";
      toast.error("Falha no envio", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(f: {
    id: string;
    storage_path: string;
    component_id: string;
    file_name: string;
  }) {
    if (!user) return;
    try {
      await removeComponentFile({
        fileId: f.id,
        storagePath: f.storage_path,
        componentId: f.component_id,
        userId: user.id,
        fileName: f.file_name,
      });
      toast.success("Arquivo removido");
      void refetch();
      qc.invalidateQueries({ queryKey: ["dashboard-files"] });
      qc.invalidateQueries({ queryKey: ["components-list"] });
    } catch (e) {
      toast.error("Falha ao remover", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Uploads"
        description="Envio e fila global de arquivos técnicos."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Enviar novo arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Componente</Label>
              <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um componente" />
                </SelectTrigger>
                <SelectContent>
                  {components?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {COMPONENT_TYPE_LABELS[c.type as ComponentType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  Aceito para {COMPONENT_TYPE_LABELS[selectedType]}:{" "}
                  {ALLOWED_KINDS_BY_TYPE[selectedType]
                    .map((k) => k.toUpperCase())
                    .join(", ")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept={selectedType ? acceptAttrFor(selectedType) : undefined}
                disabled={!selectedType || busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <Button onClick={handleUpload} disabled={!file || !selected || busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Enviar arquivo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum arquivo enviado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Componente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((f) => {
                  const comp = f.components as { name: string; type: string } | null;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.file_name}</TableCell>
                      <TableCell className="font-mono text-xs uppercase">
                        {f.file_kind}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/components/$id"
                          params={{ id: f.component_id }}
                          className="text-primary hover:underline"
                        >
                          {comp?.name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.processing_status}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(f.uploaded_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover arquivo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove o arquivo "{f.file_name}" do
                                armazenamento e do componente. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRemove({
                                    id: f.id,
                                    storage_path: f.storage_path,
                                    component_id: f.component_id,
                                    file_name: f.file_name,
                                  })
                                }
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
