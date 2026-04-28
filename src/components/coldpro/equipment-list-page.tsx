import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Archive, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  archiveEquipmentProject,
  createEquipmentProject,
  listEquipmentProjects,
} from "@/lib/coldpro/equipment-projects";
import {
  EQUIPMENT_APPLICATION_LABELS,
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_PROJECT_STATUS_LABELS,
  type EquipmentApplication,
  type EquipmentKind,
} from "@/lib/coldpro/labels";
import { useAuth } from "@/lib/auth";

export function EquipmentListPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["equipment-projects"],
    queryFn: listEquipmentProjects,
  });

  const archive = useMutation({
    mutationFn: archiveEquipmentProject,
    onSuccess: () => {
      toast.success("Equipamento arquivado");
      qc.invalidateQueries({ queryKey: ["equipment-projects"] });
    },
  });

  const visible = projects.filter((p) => p.status !== "archived");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipamentos"
        description="Cada equipamento é o projeto principal — componentes, simulações e datasheets ficam dentro dele."
        actions={<NewEquipmentDialog />}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum equipamento ainda. Crie o primeiro para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{p.commercial_name}</h3>
                    <Badge variant="secondary">
                      {EQUIPMENT_PROJECT_STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.code} · {EQUIPMENT_KIND_LABELS[p.equipment_kind]} ·{" "}
                    {EQUIPMENT_APPLICATION_LABELS[p.application]}
                    {p.refrigerant ? ` · ${p.refrigerant}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => archive.mutate(p.id)}
                    title="Arquivar"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/coldpro/equipamentos/$id" params={{ id: p.id }}>
                      Abrir <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewEquipmentDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    commercial_name: "",
    family: "",
    equipment_kind: "outro" as EquipmentKind,
    application: "outro" as EquipmentApplication,
    refrigerant: "",
    target_temperature: "",
    target_capacity: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      return createEquipmentProject({
        code: form.code.trim(),
        commercial_name: form.commercial_name.trim(),
        family: form.family.trim() || null,
        equipment_kind: form.equipment_kind,
        application: form.application,
        refrigerant: form.refrigerant.trim() || null,
        target_temperature: form.target_temperature ? Number(form.target_temperature) : null,
        target_capacity: form.target_capacity ? Number(form.target_capacity) : null,
        notes: form.notes.trim() || null,
        created_by: user.id,
      });
    },
    onSuccess: (created) => {
      toast.success("Equipamento criado");
      qc.invalidateQueries({ queryKey: ["equipment-projects"] });
      setOpen(false);
      navigate({ to: "/coldpro/equipamentos/$id", params: { id: created.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo equipamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo equipamento</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="Nome comercial">
            <Input
              value={form.commercial_name}
              onChange={(e) => setForm({ ...form, commercial_name: e.target.value })}
            />
          </Field>
          <Field label="Família">
            <Input
              value={form.family}
              onChange={(e) => setForm({ ...form, family: e.target.value })}
            />
          </Field>
          <Field label="Tipo de equipamento">
            <Select
              value={form.equipment_kind}
              onValueChange={(v) => setForm({ ...form, equipment_kind: v as EquipmentKind })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EQUIPMENT_KIND_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aplicação">
            <Select
              value={form.application}
              onValueChange={(v) => setForm({ ...form, application: v as EquipmentApplication })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EQUIPMENT_APPLICATION_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fluido refrigerante">
            <Input
              placeholder="R404A, R134a…"
              value={form.refrigerant}
              onChange={(e) => setForm({ ...form, refrigerant: e.target.value })}
            />
          </Field>
          <Field label="Temperatura alvo (°C)">
            <Input
              type="number"
              value={form.target_temperature}
              onChange={(e) => setForm({ ...form, target_temperature: e.target.value })}
            />
          </Field>
          <Field label="Capacidade alvo (W)">
            <Input
              type="number"
              value={form.target_capacity}
              onChange={(e) => setForm({ ...form, target_capacity: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.code || !form.commercial_name || create.isPending}
          >
            Criar equipamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
