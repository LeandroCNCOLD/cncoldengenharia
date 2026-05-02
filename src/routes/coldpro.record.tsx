import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/coldpro/record")({
  component: () => <PlaceholderPage title="Ficha Técnica" />,
});
