import { Construction } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

interface PlaceholderPageProps {
  title?: string;
  subtitle?: string;
}

export function PlaceholderPage({
  title = "Módulo em preparação",
  subtitle,
}: PlaceholderPageProps) {
  return (
    <PageContainer title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <Construction className="h-10 w-10 text-slate-400" />
        <h2 className="mt-4 text-base font-semibold text-slate-700">Módulo em preparação</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Esta tela será implementada nos próximos prompts. A infraestrutura técnica (motor, hooks
          e stores) já está pronta.
        </p>
      </div>
    </PageContainer>
  );
}
