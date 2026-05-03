import { Link } from "@tanstack/react-router";
import { ArrowLeft, Construction } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";

interface ComingSoonSystemPageProps {
  title: string;
  description: string;
}

export function ComingSoonSystemPage({
  title,
  description,
}: ComingSoonSystemPageProps) {
  return (
    <PageContainer
      title={`Sistema — ${title}`}
      subtitle="Mundo 2 · em desenvolvimento"
      actions={
        <Link
          to="/coldpro/cncoils"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Link>
      }
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Construction className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
        <p className="text-xs text-slate-500">
          Esta integração faz parte das próximas etapas do Mundo 2. A rota já
          está reservada para preservar o mapa de navegação do simulador.
        </p>
      </div>
    </PageContainer>
  );
}
