import { createFileRoute } from "@tanstack/react-router";
import { OptimizationPage } from "@/modules/cn_coils/pages/OptimizationPage";

export const Route = createFileRoute("/_app/coldpro/optimization")({
  component: OptimizationPage,
});
