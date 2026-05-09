import { createFileRoute } from "@tanstack/react-router";
import { ApplicationEngineeringWorkspace } from "@/modules/coldpro/application-engineering/components/ApplicationEngineeringWorkspace";

export const Route = createFileRoute("/_app/coldpro/application-engineering")({
  component: ApplicationEngineeringWorkspace,
});
