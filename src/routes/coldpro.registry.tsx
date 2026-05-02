import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/coldpro/registry")({
  component: () => <PlaceholderPage title="Registry de Produtos" />,
});
