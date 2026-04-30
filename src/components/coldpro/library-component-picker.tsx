/**
 * Picker reutilizável para selecionar um componente da Biblioteca Técnica.
 * Usado por compressor / ventilador / válvula / fluido tabs.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listApprovedComponents } from "@/lib/coldpro/technical-library";
import {
  TECHNICAL_SOURCES,
  TECHNICAL_CONTEXTS,
  type TechnicalComponent,
  type TechnicalContext,
  type TechnicalEntityType,
  type TechnicalSource,
} from "@/modules/coldpro/library/types";

interface Props {
  entityTypes: TechnicalEntityType[];
  onSelect: (component: TechnicalComponent) => void;
  triggerLabel?: string;
  title?: string;
}

export function LibraryComponentPicker({
  entityTypes,
  onSelect,
  triggerLabel = "Selecionar da biblioteca",
  title = "Biblioteca Técnica",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<TechnicalSource | "ALL">("ALL");
  const [ctx, setCtx] = useState<TechnicalContext | "ALL">("ALL");
  const [entityType, setEntityType] = useState<TechnicalEntityType>(entityTypes[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["library-picker", entityType, source, ctx],
    queryFn: () =>
      listApprovedComponents({
        entityType,
        source: source === "ALL" ? undefined : source,
        context: ctx === "ALL" ? undefined : ctx,
        limit: 100,
      }),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(
      (c) =>
        (c.manufacturer ?? "").toLowerCase().includes(term) ||
        (c.model ?? "").toLowerCase().includes(term) ||
        (c.code ?? "").toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-4">
          {entityTypes.length > 1 && (
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v as TechnicalEntityType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entityTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={source} onValueChange={(v) => setSource(v as TechnicalSource | "ALL")}>
            <SelectTrigger>
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as fontes</SelectItem>
              {TECHNICAL_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ctx} onValueChange={(v) => setCtx(v as TechnicalContext | "ALL")}>
            <SelectTrigger>
              <SelectValue placeholder="Contexto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os contextos</SelectItem>
              {TECHNICAL_CONTEXTS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Fabricante, modelo, código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="h-[420px] rounded border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhum componente encontrado com esses filtros.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {c.manufacturer ?? "—"} · {c.model ?? c.code ?? "Sem modelo"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {c.entity_type}
                      </Badge>
                      {c.source && (
                        <Badge variant="secondary" className="text-[10px]">
                          {c.source}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {c.context}
                      </Badge>
                      {c.code && <span>· {c.code}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSelect(c);
                      setOpen(false);
                    }}
                  >
                    Selecionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
