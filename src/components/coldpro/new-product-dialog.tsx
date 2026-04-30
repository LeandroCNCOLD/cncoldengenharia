import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProduct } from "@/server/cnProductDevelopment.functions";

export function NewProductDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ catalog_model: "", linha: "", hp: "", refrigerante: "", notes: "" });

  const m = useMutation({
    mutationFn: () => createProduct({ data: form }),
    onSuccess: () => {
      toast.success("Produto criado.");
      qc.invalidateQueries({ queryKey: ["cn-product-dev"] });
      setOpen(false);
      setForm({ catalog_model: "", linha: "", hp: "", refrigerante: "", notes: "" });
    },
    onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Novo Produto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Produto em Desenvolvimento</DialogTitle>
          <DialogDescription>
            Cria um produto manual no Kanban (vai para a coluna "A Analisar").
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Modelo *</Label>
            <Input
              value={form.catalog_model}
              onChange={(e) => setForm({ ...form, catalog_model: e.target.value })}
              placeholder="Ex: MCC 250"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Linha</Label>
              <Input value={form.linha} onChange={(e) => setForm({ ...form, linha: e.target.value })} />
            </div>
            <div>
              <Label>HP</Label>
              <Input value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })} />
            </div>
            <div>
              <Label>Refrigerante</Label>
              <Input
                value={form.refrigerante}
                onChange={(e) => setForm({ ...form, refrigerante: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !form.catalog_model.trim()}
          >
            {m.isPending ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
