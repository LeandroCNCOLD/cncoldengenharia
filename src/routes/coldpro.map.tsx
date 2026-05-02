import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/coldpro/map")({
  component: () => <PlaceholderPage title="Mapa Operacional" />,
});
