import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/uploads")({
  component: UploadsPage,
});

function UploadsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["uploads-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_files")
        .select("id, file_name, file_kind, processing_status, uploaded_at, component_id, components(name)")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Uploads"
        description="Fila global de arquivos enviados ao sistema."
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum upload registrado. Os uploads serão habilitados nesta iteração de
              fundação.
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.file_name}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{f.file_kind}</TableCell>
                    <TableCell>
                      <Link
                        to="/components/$id"
                        params={{ id: f.component_id }}
                        className="text-primary hover:underline"
                      >
                        {(f.components as { name: string } | null)?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.processing_status}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(f.uploaded_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
