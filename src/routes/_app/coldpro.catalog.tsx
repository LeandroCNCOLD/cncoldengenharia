import { createFileRoute } from "@tanstack/react-router";
import ComponentSelectorPage from "@/modules/coldpro_catalog/pages/ComponentSelectorPage";

export const Route = createFileRoute("/_app/coldpro/catalog")({
  component: ComponentSelectorPage,
});
