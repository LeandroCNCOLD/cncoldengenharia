import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Copy, Trash2, Plus, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  ENTITY_CONFIG,
  LIBRARY_ENTITIES,
  type EntityConfig,
  type EntityKey,
  type FieldDef,
  createItem,
  deleteItem,
  duplicateItem,
  listItems,
  updateItem,
} from "@/modules/coldpro/services/libraryService";

type Item = Record<string, any>;

export default function LibraryPage() {
  const [active, setActive] = useState<EntityKey>("projects");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Biblioteca</h1>
        <p className="text-sm text-slate-500">
          Todos os itens cadastrados e calculados — projetos, equipamentos e simulações.
        </p>
      </div>
      <Tabs value={active} onValueChange={(v) => setActive(v as EntityKey)}>
        <TabsList className="flex flex-wrap h-auto">
          {LIBRARY_ENTITIES.map((k) => (
            <TabsTrigger key={k} value={k}>
              {ENTITY_CONFIG[k].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {LIBRARY_ENTITIES.map((k) => (
          <TabsContent key={k} value={k}>
            <EntitySection config={ENTITY_CONFIG[k]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EntitySection({ config }: { config: EntityConfig }) {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [viewing, setViewing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listItems(config.key);
      setItems(data as Item[]);
    } catch (e: any) {
      toast.error("Falha ao carregar", { description: e.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [config.key]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      config.listColumns.some((c) =>
        String(it[c.key] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [items, search, config]);

  const canMutate = (it: Item) => isAdmin || it.created_by === user?.id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>
          {config.label} <span className="text-slate-400 text-sm">({items.length})</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Nenhum item encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {config.listColumns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it) => (
                  <TableRow key={it.id}>
                    {config.listColumns.map((c) => (
                      <TableCell key={c.key}>{formatCell(it[c.key])}</TableCell>
                    ))}
                    <TableCell className="text-xs text-slate-500">
                      {it.updated_at
                        ? new Date(it.updated_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <IconBtn
                          title="Visualizar"
                          onClick={() => setViewing(it)}
                          icon={<Eye className="h-4 w-4" />}
                        />
                        <IconBtn
                          title="Editar"
                          onClick={() => setEditing(it)}
                          icon={<Pencil className="h-4 w-4" />}
                          disabled={!canMutate(it)}
                        />
                        <IconBtn
                          title="Duplicar"
                          onClick={async () => {
                            try {
                              await duplicateItem(config.key, it.id);
                              toast.success("Item duplicado");
                              void load();
                            } catch (e: any) {
                              toast.error("Falha", {
                                description: e.message ?? String(e),
                              });
                            }
                          }}
                          icon={<Copy className="h-4 w-4" />}
                        />
                        <IconBtn
                          title="Excluir"
                          onClick={async () => {
                            if (!confirm(`Excluir "${it.name ?? it.code}"?`)) return;
                            try {
                              await deleteItem(config.key, it.id);
                              toast.success("Item excluído");
                              void load();
                            } catch (e: any) {
                              toast.error("Falha", {
                                description: e.message ?? String(e),
                              });
                            }
                          }}
                          icon={<Trash2 className="h-4 w-4" />}
                          disabled={!canMutate(it)}
                          danger
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {(creating || editing) && (
        <FormDialog
          config={config}
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}

      {viewing && (
        <ViewDialog item={viewing} config={config} onClose={() => setViewing(null)} />
      )}
    </Card>
  );
}

function IconBtn({
  title,
  onClick,
  icon,
  disabled,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 w-8 p-0 ${danger ? "text-red-600 hover:text-red-700" : ""}`}
    >
      {icon}
    </Button>
  );
}

function formatCell(v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-slate-300">—</span>;
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  return String(v);
}

function buildInitial(config: EntityConfig, initial?: Item): Item {
  const out: Item = {};
  for (const f of config.fields) out[f.key] = initial?.[f.key] ?? "";
  return out;
}

function FormDialog({
  config,
  initial,
  onClose,
  onSaved,
}: {
  config: EntityConfig;
  initial?: Item;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Item>(() => buildInitial(config, initial));
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of config.fields) {
        const raw = form[f.key];
        if (f.type === "number") {
          payload[f.key] = raw === "" || raw === null ? null : Number(raw);
        } else {
          payload[f.key] = raw === "" ? null : raw;
        }
      }
      if (initial?.id) {
        await updateItem(config.key, initial.id, payload);
        toast.success("Atualizado");
      } else {
        await createItem(config.key, payload);
        toast.success("Criado");
      }
      onSaved();
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar" : "Novo"} — {config.label.replace(/s$/, "")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {config.fields.map((f) => (
            <div
              key={f.key}
              className={f.width === "full" ? "col-span-2" : "col-span-2 md:col-span-1"}
            >
              <FieldInput field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{field.label}</Label>
      {field.type === "textarea" ? (
        <Textarea
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          type={field.type === "number" ? "number" : "text"}
          step="any"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ViewDialog({
  item,
  config,
  onClose,
}: {
  item: Item;
  config: EntityConfig;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.name ?? item.code ?? "Item"}
            <Badge variant="secondary">{config.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {config.fields.map((f) => (
            <div
              key={f.key}
              className={f.width === "full" ? "col-span-2" : "col-span-2 md:col-span-1"}
            >
              <p className="text-xs text-slate-500">{f.label}</p>
              <p className="font-medium">{formatCell(item[f.key])}</p>
            </div>
          ))}
          {item.results && Object.keys(item.results).length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500 mb-1">Resultados</p>
              <pre className="bg-slate-50 border rounded p-3 text-xs overflow-x-auto">
                {JSON.stringify(item.results, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
