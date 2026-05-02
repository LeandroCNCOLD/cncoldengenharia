import { createFileRoute } from "@tanstack/react-router";
import { ComponentsPage } from "@/modules/coldpro/pages/ComponentsPage";

export const Route = createFileRoute("/_app/coldpro/components")({
  component: ComponentsPage,
});
