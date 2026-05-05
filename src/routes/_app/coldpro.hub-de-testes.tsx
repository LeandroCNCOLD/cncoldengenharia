import { createFileRoute } from "@tanstack/react-router";
import { TestHubPage } from "@/modules/coldpro/pages/TestHubPage";

export const Route = createFileRoute("/_app/coldpro/hub-de-testes")({
  component: TestHubPage,
});
