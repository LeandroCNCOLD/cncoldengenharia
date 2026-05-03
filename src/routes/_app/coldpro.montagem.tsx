import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/montagem")({
  component: () => (
    <PlaceholderPage
      title="Montagem"
      subtitle="Plano de montagem do equipamento"
      emoji="🔧"
      description="Definição de BOM, sequência de montagem, validações e rastreabilidade dos componentes selecionados. Em breve."
    />
  ),
});
