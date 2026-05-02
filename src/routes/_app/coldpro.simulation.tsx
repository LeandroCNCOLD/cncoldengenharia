import { createFileRoute } from "@tanstack/react-router";
import { SimulationPage } from "@/modules/coldpro/pages/SimulationPage";

export const Route = createFileRoute("/_app/coldpro/simulation")({
  component: SimulationPage,
});
