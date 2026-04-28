import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMPONENT_TYPE_LABELS, type ComponentType } from "@/lib/component-schema";

export const Route = createFileRoute("/_app/components/new")({
  component: NewComponentPage,
});

function NewComponentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<ComponentType>("compressor");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabase
      .from("components")
      .insert({
        name: String(fd.get("name") ?? ""),
        type,
        manufacturer: String(fd.get("manufacturer") ?? "") || null,
        fluid: String(fd.get("fluid") ?? "") || null,
        status: "incompleto",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      toast.error("Erro ao criar componente", { description: error?.message });
      setBusy(false);
      return;
    }

    // Cria a linha de dados extraídos vazia
    await supabase.from("component_data").insert({
      component_id: data.id,
      fields: {},
      field_sources: {},
    });

    await supabase.from("component_history").insert({
      component_id: data.id,
      user_id: user.id,
      action: "created",
      payload: { type },
    });

    toast.success("Componente criado");
    navigate({ to: "/components/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Novo componente"
        description="Cadastre um componente técnico. Você poderá anexar arquivos e preencher dados em seguida."
        actions={
          <Button variant="outline" asChild>
            <Link to="/components">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de componente</Label>
              <Select value={type} onValueChange={(v) => setType(v as ComponentType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COMPONENT_TYPE_LABELS) as ComponentType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {COMPONENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome técnico</Label>
              <Input id="name" name="name" required placeholder="Ex.: Bitzer 4FES-5Y" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input id="manufacturer" name="manufacturer" placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fluid">Fluido</Label>
                <Input id="fluid" name="fluid" placeholder="Ex.: R134a" />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Criando…" : "Criar componente"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
