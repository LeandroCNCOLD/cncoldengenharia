import { Link } from "@tanstack/react-router";
import { ArrowLeft, Construction, type LucideIcon } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

interface PlaceholderPageProps {
  title?: string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  emoji?: string;
}

export function PlaceholderPage({
  title = "Módulo em preparação",
  subtitle,
  description = "Esta tela será implementada nos próximos prompts. A infraestrutura técnica (motor, hooks e stores) já está pronta.",
  icon: Icon = Construction,
  emoji,
}: PlaceholderPageProps) {
  return (
    <PageContainer title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
          {emoji ?? <Icon className="h-8 w-8 text-muted-foreground" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          🚧 Em desenvolvimento
        </span>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{description}</p>
        <Link
          to="/coldpro"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Link>
      </div>
    </PageContainer>
  );
}
