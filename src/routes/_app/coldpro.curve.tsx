import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/curve")({
  component: () => <PlaceholderPage title="Curva de Desempenho" />,
});
