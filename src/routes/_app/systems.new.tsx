import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { ComponentType } from "@/lib/component-schema";

export const Route = createFileRoute("/_app/systems/new")({
  component: NewSystemPage,
});

function NewSystemPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [compressorId, setCompressorId] = useState("");
  const [evaporatorId, setEvaporatorId] = useState("");
  const [condenserId, setCondenserId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: components } = useQuery({
    queryKey: ["components-ready"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, type, manufacturer, status")
        .eq("status", "pronto")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const byType = (t: ComponentType) => (components ?? []).filter((c) => c.type === t);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !compressorId || !evaporatorId || !condenserId) {
      toast.error("Preencha o nome e selecione os três componentes.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("systems")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        compressor_id: compressorId,
        evaporator_id: evaporatorId,
        condenser_id: condenserId,
        created_by: user.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sistema criado.");
    navigate({ to: "/systems/$id", params: { id: data.id } });
  }

  const compressors = byType("compressor");
  const evaporators = byType("evaporador");
  const condensers = byType("condensador");

  return (
    <div>
      <PageHeader
        title="Novo sistema"
        description="Combine componentes prontos para criar um sistema simulável."
        actions={
          <Link to="/systems">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Câmara túnel -35 °C"
                required
              />
            </div>
            <div>
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <SelectField
              label="Compressor"
              value={compressorId}
              onChange={setCompressorId}
              options={compressors}
              empty="Nenhum compressor pronto disponível."
            />
            <SelectField
              label="Evaporador"
              value={evaporatorId}
              onChange={setEvaporatorId}
              options={evaporators}
              empty="Nenhum evaporador pronto disponível."
            />
            <SelectField
              label="Condensador"
              value={condenserId}
              onChange={setCondenserId}
              options={condensers}
              empty="Nenhum condensador pronto disponível."
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Criar sistema"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string; manufacturer: string | null }[];
  empty: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Selecione um ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
                {o.manufacturer ? ` · ${o.manufacturer}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
