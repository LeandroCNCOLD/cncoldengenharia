import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/coldpro/audit")({
  component: () => <PlaceholderPage title="Auditoria CN COLD" />,
});
