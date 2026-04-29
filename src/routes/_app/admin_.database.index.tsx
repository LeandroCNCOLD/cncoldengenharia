import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Database } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { UNILAB_DB_TABLES } from "@/components/app-sidebar";

export const Route = createFileRoute("/_app/admin_/database/")({
  component: DatabaseIndexPage,
});

function DatabaseIndexPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="p-8">
      <PageHeader
        title="Banco de Dados"
        description="Tabelas Unilab importadas em coil_geometry_factors. Selecione uma tabela para visualizar e editar."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {UNILAB_DB_TABLES.map((t) => (
          <Link key={t.mode} to="/admin/database/$mode" params={{ mode: t.mode }}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3 p-4">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">mode = {t.mode}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
