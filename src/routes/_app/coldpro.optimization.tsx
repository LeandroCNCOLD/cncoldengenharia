import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/optimization")({
  component: () => (
    <PlaceholderPage
      title="Otimização Multi-objetivo"
      subtitle="Grid search COP × Custo × ΔP"
      description="A página dedicada de Otimização será integrada na próxima rodada. Por enquanto, você pode acessar a aba 'Otimização' dentro de Ciclo de Refrigeração."
      icon={Target}
    />
  ),
});
