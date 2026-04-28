import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <div>
      <PageHeader
        title="Catálogo Técnico"
        description="Vitrine interna de consulta dos componentes catalogados."
      />

      {!data?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum componente no catálogo ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => {
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
