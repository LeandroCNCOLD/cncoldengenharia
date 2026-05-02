import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/modules/coldpro/pages/DashboardPage";

export const Route = createFileRoute("/coldpro/")({
  component: DashboardPage,
});
