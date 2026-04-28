import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FileUploader } from "@/components/file-uploader";
import { FieldEditor } from "@/components/field-editor";
import { ConflictsPanel } from "@/components/conflicts-panel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { removeComponentFile, setFieldManual, resolveConflict } from "@/lib/uploads";
import {
  COMPONENT_FIELDS,
  COMPONENT_TYPE_LABELS,
  EXPECTED_FILE_KINDS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ComponentStatus,
  type ComponentType,
} from "@/lib/component-schema";
import { computeReadiness, type FieldConflict } from "@/lib/component-readiness";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/components/$id")({
  component: ComponentDetailPage,
});

function ComponentDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: component } = useQuery({
    queryKey: ["component", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: files } = useQuery({
    queryKey: ["component-files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_files")
        .select("*")
        .eq("component_id", id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cdata } = useQuery({
    queryKey: ["component-data", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("component_data")
        .select("*")
        .eq("component_id", id)
        .maybeSingle();
      return data;
    },
  });

  const fileNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (files ?? []).forEach((f) => { m[f.id] = f.file_name; });
    return m;
  }, [files]);

  if (!component) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const type = component.type as ComponentType;
  const fields = (cdata?.fields ?? {}) as Record<string, unknown>;
  const sources = (cdata?.field_sources ?? {}) as Record<string, string>;
  const expectedKinds = EXPECTED_FILE_KINDS[type];
  const status = component.status as ComponentStatus;
  const conflicts = (component.conflicts ?? []) as unknown as FieldConflict[];

  const fieldDefs = COMPONENT_FIELDS[type];
  const readiness = computeReadiness(type, fields, conflicts);

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["component", id] });
    qc.invalidateQueries({ queryKey: ["component-files", id] });
    qc.invalidateQueries({ queryKey: ["component-data", id] });
    qc.invalidateQueries({ queryKey: ["components-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard-files"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
    qc.invalidateQueries({ queryKey: ["simulation-list"] });
  }

  async function handleRemove(f: { id: string; storage_path: string; file_name: string }) {
    if (!user) return;
    try {
      await removeComponentFile({
        fileId: f.id,
        storagePath: f.storage_path,
        componentId: id,
        userId: user.id,
        fileName: f.file_name,
      });
      toast.success("Arquivo removido");
      refreshAll();
    } catch (e) {
      toast.error("Falha ao remover", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleEdit(key: string, value: unknown) {
    if (!user) return;
    try {
      await setFieldManual({ componentId: id, key, value, userId: user.id });
      toast.success("Campo atualizado");
      refreshAll();
    } catch (e) {
      toast.error("Falha ao atualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleResolve(key: string, chosenValue: unknown, chosenSource: string) {
    if (!user) return;
    try {
      await resolveConflict({
        componentId: id,
        key,
        chosenValue,
        chosenSource,
        userId: user.id,
      });
      toast.success("Conflito resolvido");
      refreshAll();
    } catch (e) {
      toast.error("Falha ao resolver", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div>
      <PageHeader
        title={component.name}
        description={`${COMPONENT_TYPE_LABELS[type]}${component.manufacturer ? " · " + component.manufacturer : ""}`}
        actions={
          <>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                STATUS_COLORS[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
            <Button variant="outline" asChild>
              <Link to="/components">
                <ArrowLeft className="mr-2 h-4 w-4" /> Componentes
              </Link>
            </Button>
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="files">Arquivos ({files?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="data">
            Dados {conflicts.length > 0 && (
              <span className="ml-2 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] text-warning-foreground">
                {conflicts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Tipo" value={COMPONENT_TYPE_LABELS[type]} />
                <Row label="Fabricante" value={component.manufacturer || "—"} />
                <Row label="Fluido" value={component.fluid || "—"} />
                <Row
                  label="Criado em"
                  value={new Date(component.created_at).toLocaleString("pt-BR")}
                />
                <Row
                  label="Atualizado em"
                  value={new Date(component.updated_at).toLocaleString("pt-BR")}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {readiness.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-warning" />
                  )}
                  Prontidão para simulação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase text-muted-foreground">
                    Arquivos esperados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expectedKinds.map((k) => {
                      const has = files?.some((f) => f.file_kind === k);
                      return (
                        <span
                          key={k}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs uppercase",
                            has
                              ? "border-success/40 bg-success/10 text-success"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {k} {has ? "✓" : "ausente"}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase text-muted-foreground">
                    Campos obrigatórios
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">
                      {readiness.filledRequired} / {readiness.totalRequired}
                    </span>{" "}
                    preenchidos
                  </p>
                </div>
                {readiness.blockReasons.length > 0 && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                    <p className="mb-1 font-semibold">Bloqueado para simulação:</p>
                    <ul className="ml-4 list-disc">
                      {readiness.blockReasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {readiness.ready && (
                  <p className="rounded-md border border-success/40 bg-success/10 p-2 text-xs text-success">
                    Componente pronto para simulação.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="files" className="mt-4 space-y-4">
          <FileUploader componentId={id} componentType={type} onUploaded={refreshAll} />
          <Card>
            <CardContent className="p-6">
              {!files?.length ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum arquivo enviado.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tipos esperados: {expectedKinds.map((k) => k.toUpperCase()).join(", ")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                          {f.file_kind}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{f.file_name}</p>
                          {f.error_message && (
                            <p className="truncate text-xs text-destructive">
                              {f.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(f.uploaded_at).toLocaleDateString("pt-BR")}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-2 py-0.5 text-[10px] uppercase",
                          f.processing_status === "processado" && "bg-success/10 text-success",
                          f.processing_status === "erro" && "bg-destructive/10 text-destructive",
                          f.processing_status === "pendente" && "bg-muted text-muted-foreground",
                          f.processing_status === "processando" && "bg-warning/10 text-warning-foreground",
                        )}
                      >
                        {f.processing_status}
                      </span>
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
                              Esta ação remove "{f.file_name}" e os campos extraídos
                              dele. O status será recalculado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleRemove({
                                  id: f.id,
                                  storage_path: f.storage_path,
                                  file_name: f.file_name,
                                })
                              }
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4 space-y-4">
          {conflicts.length > 0 && (
            <ConflictsPanel
              type={type}
              conflicts={conflicts}
              fileNames={fileNameMap}
              onResolve={handleResolve}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {fieldDefs.map((f) => (
              <FieldEditor
                key={f.key}
                def={f}
                value={fields[f.key]}
                source={sources[f.key]}
                onSave={(v) => handleEdit(f.key, v)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Edição manual prevalece sobre dados extraídos. Campos vazios podem ser preenchidos manualmente.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
