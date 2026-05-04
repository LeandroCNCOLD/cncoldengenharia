import { createFileRoute } from "@tanstack/react-router";
import { CompleteSystemWizardPage } from "@/modules/cn_coils/pages/systems/CompleteSystemWizardPage";

export const Route = createFileRoute("/_app/coldpro/systems/dx-complete")({
  component: () => <CompleteSystemWizardPage mode="dx-complete" />,
});
