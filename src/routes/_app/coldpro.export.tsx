import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/export")({
  component: () => <PlaceholderPage title="Exportação" />,
});
