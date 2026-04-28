import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PlaceholderArea } from "@/components/placeholder-area";

export const Route = createFileRoute("/_app/reports")({
  component: () => (
    <div>
      <PageHeader title="Relatórios" description="Geração de relatórios técnicos finais." />
      <PlaceholderArea
        icon={FileBarChart}
        title="Relatórios técnicos"
        description="A geração de PDFs técnicos, comparativos e análises de custo será habilitada nas próximas etapas."
      />
    </div>
  ),
});
