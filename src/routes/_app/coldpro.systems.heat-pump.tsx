import { createFileRoute } from "@tanstack/react-router";
import { CompleteSystemWizardPage } from "@/modules/cn_coils/pages/systems/CompleteSystemWizardPage";

export const Route = createFileRoute("/_app/coldpro/systems/heat-pump")({
  component: () => <CompleteSystemWizardPage mode="heat-pump" />,
});
