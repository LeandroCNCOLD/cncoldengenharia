import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPONENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type ComponentStatus,
  type ComponentType,
} from "@/lib/component-schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, type, manufacturer, fluid, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.manufacturer ?? ""} ${c.fluid ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, typeFilter, statusFilter]);

  const hasFilters = search || typeFilter !== "all" || statusFilter !== "all";

  return (
    <div>
      <PageHeader
        title="Catálogo Técnico"
        description="Vitrine interna de consulta dos componentes catalogados."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, fabricante ou fluido…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(COMPONENT_TYPE_LABELS) as ComponentType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {COMPONENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABELS) as ComponentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {hasFilters
              ? "Nenhum componente corresponde aos filtros."
              : "Nenhum componente no catálogo ainda."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const status = c.status as ComponentStatus;
            return (
              <Link key={c.id} to="/components/$id" params={{ id: c.id }}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {COMPONENT_TYPE_LABELS[c.type as ComponentType]}
                        </p>
                        <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                      </div>
                      {status === "pronto" && (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        <span className="text-muted-foreground/70">Fabricante:</span>{" "}
                        {c.manufacturer || "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground/70">Fluido:</span>{" "}
                        {c.fluid || "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2 py-0.5 text-xs",
                        STATUS_COLORS[status],
                      )}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
