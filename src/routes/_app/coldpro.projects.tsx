import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/modules/cn_coils/pages/ProjectsPage";

export const Route = createFileRoute("/_app/coldpro/projects")({
  component: ProjectsPage,
});
