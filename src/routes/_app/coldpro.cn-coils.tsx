import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { UnilabDashboardPage } from "@/modules/unilab_simulator/pages/UnilabDashboardPage";

export const Route = createFileRoute("/_app/coldpro/cn-coils")({
  component: CnCoilsLayout,
});

function CnCoilsLayout() {
  const matches = useMatches();
  const hasChild = matches.some(
    (m) => m.routeId === "/_app/coldpro/cn-coils/workspace",
  );
  return hasChild ? <Outlet /> : <UnilabDashboardPage />;
}
