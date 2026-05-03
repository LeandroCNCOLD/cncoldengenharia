import { createFileRoute } from "@tanstack/react-router";
import { CycleWorkspacePage } from "@/modules/cn_coils/pages/CycleWorkspacePage";

export const Route = createFileRoute("/_app/coldpro/cycle")({
  component: CycleWorkspacePage,
});
