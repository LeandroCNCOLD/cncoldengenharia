import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { removeComponentFile } from "@/lib/uploads";
import {
  COMPONENT_FIELDS,
  COMPONENT_TYPE_LABELS,
  EXPECTED_FILE_KINDS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ComponentStatus,
  type ComponentType,
} from "@/lib/component-schema";
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

  if (!component) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const type = component.type as ComponentType;
  const fields = (cdata?.fields ?? {}) as Record<string, unknown>;
  const sources = (cdata?.field_sources ?? {}) as Record<string, string>;
  const expectedKinds = EXPECTED_FILE_KINDS[type];
  const status = component.status as ComponentStatus;

  const fieldDefs = COMPONENT_FIELDS[type];
  const filledRequired = fieldDefs.filter(
    (f) => f.required && fields[f.key] !== undefined && fields[f.key] !== "",
  ).length;
  const totalRequired = fieldDefs.filter((f) => f.required).length;

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["component", id] });
    qc.invalidateQueries({ queryKey: ["component-files", id] });
    qc.invalidateQueries({ queryKey: ["component-data", id] });
    qc.invalidateQueries({ queryKey: ["components-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard-files"] });
  }

  async function handleRemove(f: {
    id: string;
    storage_path: string;
    file_name: string;
  }) {
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
          <TabsTrigger value="data">Dados extraídos</TabsTrigger>
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
                <CardTitle className="text-base">Checklist de prontidão</CardTitle>
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
                      {filledRequired} / {totalRequired}
                    </span>{" "}
                    preenchidos
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="files" className="mt-4 space-y-4">
          <FileUploader
            componentId={id}
            componentType={type}
            onUploaded={refreshAll}
          />

          <Card>
            <CardContent className="p-6">
              {!files?.length ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum arquivo enviado.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tipos esperados:{" "}
                    {expectedKinds.map((k) => k.toUpperCase()).join(", ")}
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
                        <span className="truncate font-medium">{f.file_name}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(f.uploaded_at).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
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
                              Esta ação remove "{f.file_name}" do armazenamento e do
                              componente. O status pode ser recalculado.
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

        <TabsContent value="data" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {fieldDefs.map((f) => {
                  const v = fields[f.key];
                  const src = sources[f.key];
                  const filled = v !== undefined && v !== null && v !== "";
                  return (
                    <div
                      key={f.key}
                      className="rounded-md border bg-card p-3 text-sm"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">
                          {f.label}{" "}
                          {f.required && <span className="text-destructive">*</span>}
                        </span>
                        {filled && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] uppercase",
                              src === "manual"
                                ? "bg-info/10 text-info"
                                : "bg-success/10 text-success",
                            )}
                          >
                            {src ?? "—"}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-sm",
                          filled ? "text-foreground" : "italic text-muted-foreground",
                        )}
                      >
                        {filled
                          ? typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v)
                          : "Ausente"}
                        {f.unit && filled ? ` ${f.unit}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                A extração automática a partir de CSV/PDF/XLS e a edição manual dos
                campos serão habilitadas no próximo módulo de normalização.
              </p>
            </CardContent>
          </Card>
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
