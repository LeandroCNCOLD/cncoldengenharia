import { createFileRoute } from "@tanstack/react-router";
import { PerformanceCurvePage } from "@/modules/coldpro/pages/PerformanceCurvePage";

export const Route = createFileRoute("/_app/coldpro/curve")({
  component: PerformanceCurvePage,
});
