import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonSystemPage } from "@/modules/unilab_simulator/pages/systems/ComingSoonSystemPage";

export const Route = createFileRoute(
  "/_app/coldpro/unilab/systems/heat-pump",
)({
  component: () => (
    <ComingSoonSystemPage
      title="Bomba de Calor"
      description="Unidade Interna + Unidade Externa em ciclo reverso (aquecimento e resfriamento)."
    />
  ),
});
