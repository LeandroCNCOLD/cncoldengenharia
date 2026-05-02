import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { UnilabDashboardPage } from "@/modules/unilab_simulator/pages/UnilabDashboardPage";

export const Route = createFileRoute("/_app/coldpro/unilab")({
  component: UnilabLayout,
});

function UnilabLayout() {
  const matches = useMatches();
  const hasChild = matches.some(
    (m) => m.routeId === "/_app/coldpro/unilab/workspace",
  );
  return hasChild ? <Outlet /> : <UnilabDashboardPage />;
}
