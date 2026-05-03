import { createFileRoute } from "@tanstack/react-router";
import { OperatingMapPage } from "@/modules/coldpro/pages/OperatingMapPage";

export const Route = createFileRoute("/_app/coldpro/operating-map")({
  component: OperatingMapPage,
});
