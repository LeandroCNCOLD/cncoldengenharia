import { createFileRoute } from "@tanstack/react-router";
import { AssemblyWorkspacePage } from "@/modules/cn_coils/pages/AssemblyWorkspacePage";

export const Route = createFileRoute("/_app/coldpro/assembly")({
  component: AssemblyWorkspacePage,
});
