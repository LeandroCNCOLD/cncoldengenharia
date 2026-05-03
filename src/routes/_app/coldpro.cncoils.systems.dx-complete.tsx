import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonSystemPage } from "@/modules/cn_coils/pages/systems/ComingSoonSystemPage";

export const Route = createFileRoute(
  "/_app/coldpro/cncoils/systems/dx-complete",
)({
  component: () => (
    <ComingSoonSystemPage
      title="Sistema DX Completo"
      description="Evaporador DX + Condensador a Ar acoplados em ciclo refrigerante."
    />
  ),
});
