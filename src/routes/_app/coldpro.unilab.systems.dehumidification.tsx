import { createFileRoute } from "@tanstack/react-router";
import { DehumidificationSystemPage } from "@/modules/cn_coils/pages/systems/DehumidificationSystemPage";

export const Route = createFileRoute(
  "/_app/coldpro/unilab/systems/dehumidification",
)({
  component: DehumidificationSystemPage,
});
