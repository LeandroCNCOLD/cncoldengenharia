import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/simulation")({
  component: () => <PlaceholderPage title="Equilíbrio do Sistema" />,
});
