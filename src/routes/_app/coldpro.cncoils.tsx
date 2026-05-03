import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { CnCoilsDashboardPage } from "@/modules/cn_coils/pages/CnCoilsDashboardPage";

export const Route = createFileRoute("/_app/coldpro/cncoils")({
  component: CnCoilsLayout,
});

function CnCoilsLayout() {
  const matches = useMatches();
  const hasChild = matches.some(
    (m) =>
      m.routeId !== "/_app/coldpro/cncoils" &&
      m.routeId.startsWith("/_app/coldpro/cncoils"),
  );
  return hasChild ? <Outlet /> : <CnCoilsDashboardPage />;
}
