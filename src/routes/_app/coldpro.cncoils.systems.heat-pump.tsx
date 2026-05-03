import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonSystemPage } from "@/modules/cn_coils/pages/systems/ComingSoonSystemPage";

export const Route = createFileRoute(
  "/_app/coldpro/cncoils/systems/heat-pump",
)({
  component: () => (
    <ComingSoonSystemPage
      title="Bomba de Calor"
      description="Unidade Interna + Unidade Externa em ciclo reverso (aquecimento e resfriamento)."
    />
  ),
});
