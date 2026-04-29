import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, ShieldOff, Database } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

interface ProfileWithRoles {
  id: string;
  full_name: string | null;
  email: string | null;
  roles: AppRole[];
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();

  const { data, refetch } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async (): Promise<ProfileWithRoles[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        rolesByUser.set(r.user_id, list);
      });
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) toast.error("Erro ao remover papel", { description: error.message });
      else toast.success("Papel admin removido");
    } else {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "admin",
      });
      if (error) toast.error("Erro ao atribuir papel", { description: error.message });
      else toast.success("Usuário promovido a admin");
    }
    void refetch();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Administração Técnica"
        description="Gestão de usuários e papéis do sistema."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/unilab-import">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Importar tabelas Unilab
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => {
                  const isAdminUser = u.roles.includes("admin");
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isAdminUser ? "outline" : "default"}
                          onClick={() => toggleAdmin(u.id, isAdminUser)}
                        >
                          {isAdminUser ? (
                            <>
                              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                              Remover admin
                            </>
                          ) : (
                            <>
                              <Shield className="mr-1.5 h-3.5 w-3.5" />
                              Tornar admin
                            </>
                          )}
                        </Button>
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
