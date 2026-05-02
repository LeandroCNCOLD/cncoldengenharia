import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/coldpro/curve")({
  component: () => <PlaceholderPage title="Curva de Desempenho" />,
});
