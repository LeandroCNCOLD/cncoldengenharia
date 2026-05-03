import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/modules/coldpro/pages/PlaceholderPage";

export const Route = createFileRoute("/_app/coldpro/ficha-tecnica")({
  component: () => (
    <PlaceholderPage
      title="Ficha Técnica"
      subtitle="Documentação técnica final do produto"
      emoji="📄"
      description="Geração e versionamento de fichas técnicas auditadas, com todos os dados de motor, geometria e operação. Em breve."
    />
  ),
});
