import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage } from "@/modules/cn_coils/pages/ComparisonPage";

export const Route = createFileRoute("/_app/coldpro/compare")({
  component: ComparisonPage,
});
