import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPONENT_FIELDS,
  COMPONENT_TYPE_LABELS,
  EXPECTED_FILE_KINDS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ComponentStatus,
  type ComponentType,
  type FileKind,
} from "@/lib/component-schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/components/$id")({
  component: ComponentDetailPage,
});

function ComponentDetailPage() {
  const { id } = Route.useParams();

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

        <TabsContent value="files" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {!files?.length ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum arquivo enviado.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tipos esperados:{" "}
                    {expectedKinds.map((k) => k.toUpperCase()).join(", ")}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Upload e parsing serão implementados na próxima iteração desta
                    fundação. A estrutura de dados já está pronta para receber.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs uppercase text-muted-foreground">
                          {f.file_kind}
                        </span>{" "}
                        {f.file_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {f.processing_status}
                      </span>
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
                Edição manual e extração automática serão habilitadas na próxima
                iteração — a estrutura já está pronta no banco.
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
