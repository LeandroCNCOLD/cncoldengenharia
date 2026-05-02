import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        ColdPro V2
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Base limpa. Estrutura modular pronta para receber as novas telas em
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
          src/modules/coldpro
        </code>
        e
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
          src/modules/coldpro_v2
        </code>
        .
      </p>
    </div>
  );
}
