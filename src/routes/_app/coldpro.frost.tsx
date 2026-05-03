import { createFileRoute } from "@tanstack/react-router";
import { Snowflake } from "lucide-react";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/frost")({
  component: () => (
    <PlaceholderPage
      title="Análise de Geada"
      subtitle="Curva Q(t) de degradação + tempo até degelo"
      description="A página dedicada de Análise de Geada será integrada na próxima rodada. Por enquanto, você pode acessar a aba 'Geada' dentro de Ciclo de Refrigeração."
      icon={Snowflake}
    />
  ),
});
