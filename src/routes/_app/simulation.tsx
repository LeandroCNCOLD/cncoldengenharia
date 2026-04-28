import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PlaceholderArea } from "@/components/placeholder-area";

export const Route = createFileRoute("/_app/simulation")({
  component: () => (
    <div>
      <PageHeader title="Simulação" description="Motores térmicos e solver de equilíbrio." />
      <PlaceholderArea
        icon={FlaskConical}
        title="Motor de simulação"
        description="A engenharia avançada (compressor, evaporador, condensador, solver e simulação dinâmica) será habilitada nas próximas etapas. A base já armazena tudo o que esses módulos precisam consumir."
      />
    </div>
  ),
});
