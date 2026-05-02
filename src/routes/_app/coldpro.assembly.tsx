import { createFileRoute } from "@tanstack/react-router";
import { AssemblyPage } from "@/modules/coldpro/pages/AssemblyPage";

export const Route = createFileRoute("/_app/coldpro/assembly")({
  component: AssemblyPage,
});
