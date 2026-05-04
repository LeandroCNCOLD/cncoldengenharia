import { createFileRoute } from "@tanstack/react-router";
import { ProjectCompletionPage } from "@/modules/cn_coils/pages/ProjectCompletionPage";

export const Route = createFileRoute("/_app/coldpro/cncoils/project-completion")({
  component: ProjectCompletionPage,
});
