import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/systems/$id")({
  component: SystemDetailPage,
});

function SystemDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: system } = useQuery({
    queryKey: ["system", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("systems")
        .select(
          "id, name, description, created_at, compressor:compressor_id(id,name,manufacturer), evaporator:evaporator_id(id,name,manufacturer), condenser:condenser_id(id,name,manufacturer)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select("id, t_evap_target, t_air_evap, t_air_cond, t_cond_eq, cop, created_at")
        .eq("system_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleDelete() {
    if (!confirm("Excluir este sistema? Todas as simulações serão removidas.")) return;
    const { error } = await supabase.from("systems").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sistema excluído.");
    navigate({ to: "/systems" });
  }

  if (!system) {
    return (
      <div>
        <PageHeader title="Sistema" description="Carregando…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={system.name}
        description={system.description ?? "Sistema frigorífico"}
        actions={
          <div className="flex gap-2">
            <Link to="/systems">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
            <Link to="/systems/$id/simulate" params={{ id }}>
              <Button size="sm">
                <FlaskConical className="mr-2 h-4 w-4" /> Nova simulação
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <ComponentCard label="Compressor" comp={system.compressor as any} />
        <ComponentCard label="Evaporador" comp={system.evaporator as any} />
        <ComponentCard label="Condensador" comp={system.condenser as any} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Simulações ({simulations?.length ?? 0})
      </h2>

      {(simulations?.length ?? 0) === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma simulação ainda. Use “Nova simulação” acima.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {simulations!.map((s) => (
            <Card key={s.id}>
              <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-5">
                <Field label="T_evap" value={`${num(s.t_evap_target)} °C`} />
                <Field label="T_ar evap" value={`${num(s.t_air_evap)} °C`} />
                <Field label="T_ar cond" value={`${num(s.t_air_cond)} °C`} />
                <Field label="T_cond eq" value={s.t_cond_eq != null ? `${num(s.t_cond_eq)} °C` : "—"} />
                <Field label="COP" value={s.cop != null ? num(s.cop, 2) : "—"} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentCard({
  label,
  comp,
}: {
  label: string;
  comp: { id: string; name: string; manufacturer: string | null } | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="font-medium">{comp?.name ?? "—"}</p>
        {comp?.manufacturer && (
          <p className="text-xs text-muted-foreground">{comp.manufacturer}</p>
        )}
        {comp?.id && (
          <Link to="/components/$id" params={{ id: comp.id }} className="text-xs text-primary hover:underline">
            Ver detalhes
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function num(v: unknown, digits = 1): string {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}
