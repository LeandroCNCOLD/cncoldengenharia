import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonSystemPage } from "@/modules/cn_coils/pages/systems/ComingSoonSystemPage";

export const Route = createFileRoute(
  "/_app/coldpro/unilab/systems/cold-room",
)({
  component: () => (
    <ComingSoonSystemPage
      title="Câmara Fria"
      description="Evaporador + Condensador + Carga Térmica integrados em câmara fria completa."
    />
  ),
});
