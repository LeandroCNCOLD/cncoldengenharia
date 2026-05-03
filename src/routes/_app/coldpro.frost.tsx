import { createFileRoute } from "@tanstack/react-router";
import { FrostAnalysisPage } from "@/modules/cn_coils/pages/FrostAnalysisPage";

export const Route = createFileRoute("/_app/coldpro/frost")({
  component: FrostAnalysisPage,
});
