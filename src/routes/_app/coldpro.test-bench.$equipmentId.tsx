import { createFileRoute } from "@tanstack/react-router";
import TestBenchPage from "@/modules/coldpro_catalog/pages/TestBenchPage";

export const Route = createFileRoute("/_app/coldpro/test-bench/$equipmentId")({
  component: TestBenchPage,
});
