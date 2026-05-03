import { Link } from "@tanstack/react-router";
import {
  Snowflake,
  Boxes,
  Database as DatabaseIcon,
  Wrench,
  Map,
  Download,
  ArrowRight,
  TrendingUp,
  Scale,
  Plus,
} from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { useSessionStore } from "../stores/useSessionStore";
import { useUserModeStore } from "../stores/useUserModeStore";
import { useAuth } from "@/lib/auth";

const QUICK_CARDS = [
  {
    to: "/coldpro/cncoils",
    emoji: "🧊",
    Icon: Snowflake,
    title: "CN COILS",
    description: "Simulação de evaporadores e condensadores com motor V2.",
    available: true,
  },
  {
    to: "/coldpro/components",
    emoji: "📦",
    Icon: Boxes,
    title: "Componentes",
    description: "Biblioteca de compressores, ventiladores e serpentinas.",
    available: true,
  },
  {
    to: "/coldpro/catalog",
    emoji: "📋",
    Icon: DatabaseIcon,
    title: "Catálogo CN COLD",
    description: "Selecione equipamentos reais do catálogo CN COLD.",
    available: true,
  },
  {
    to: "/coldpro/montagem",
    emoji: "🔧",
    Icon: Wrench,
    title: "Montagem",
    description: "Plano de montagem e BOM do equipamento.",
    available: false,
  },
  {
    to: "/coldpro/map",
    emoji: "📊",
    Icon: Map,
    title: "Mapa Operacional",
    description: "Mapa multivariável de operação do equipamento.",
    available: true,
  },
  {
    to: "/coldpro/export",
    emoji: "📄",
    Icon: Download,
    title: "Exportação",
    description: "Exporte relatórios técnicos e fichas auditadas.",
    available: true,
  },
] as const;

const SECONDARY_CARDS = [
  { to: "/coldpro/curve", Icon: TrendingUp, title: "Curva de Desempenho" },
  { to: "/coldpro/simulation", Icon: Scale, title: "Equilíbrio do Sistema" },
] as const;

const APP_VERSION = "2.0.0";

export function DashboardPage() {
  const { user } = useAuth();
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const createSession = useSessionStore((s) => s.createSession);
  const mode = useUserModeStore((s) => s.mode);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ??
    [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Engenheiro";

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleNewSession = () => {
    const stamp = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    createSession(`Sessão ${stamp}`, mode);
  };

  return (
    <PageContainer
      title={`Olá, ${userName} 👋 — Motor V2 CN COLD ativo`}
      subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)} • Versão ${APP_VERSION}`}
      actions={
        <button
          type="button"
          onClick={handleNewSession}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1E6FD9] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1858b0]"
        >
          <Plus className="h-4 w-4" />
          Nova sessão
        </button>
      }
    >
      <div className="space-y-6">
        {/* Acesso rápido */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Acesso rápido
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_CARDS.map((card) => {
              const Icon = card.Icon;
              const cls = `group relative flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm transition ${
                card.available
                  ? "border-border hover:-translate-y-0.5 hover:border-[#1E6FD9]/40 hover:shadow-md"
                  : "cursor-not-allowed border-dashed border-border opacity-60"
              }`;
              const inner = (
                <>
                  {!card.available && (
                    <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Em breve
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E6FD9]/10 text-2xl">
                      {card.emoji}
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                  {card.available && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#1E6FD9] group-hover:underline">
                      Abrir <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </span>
                  )}
                </>
              );
              return card.available ? (
                <Link key={card.to} to={card.to} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div key={card.to} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        {/* Última sessão */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Última sessão
            </h2>
            <span className="text-xs text-muted-foreground">{sessions.length} no total</span>
          </div>
          {activeSession ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {activeSession.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Modo {activeSession.mode} •{" "}
                  {new Date(activeSession.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSession(activeSession.id)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Selecionar
                </button>
                <Link
                  to="/coldpro/cncoils"
                  className="inline-flex items-center gap-1 rounded-md bg-[#1E6FD9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1858b0]"
                >
                  Retomar <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhuma sessão ativa — inicie uma simulação em{" "}
              <Link to="/coldpro/cncoils" className="font-medium text-[#1E6FD9] hover:underline">
                CN COILS
              </Link>
              .
            </div>
          )}
        </section>

        {/* Ferramentas avançadas */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Ferramentas avançadas
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SECONDARY_CARDS.map((card) => {
              const Icon = card.Icon;
              return (
                <Link
                  key={card.to}
                  to={card.to}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-[#1E6FD9]/40 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1E6FD9]/10 text-[#1E6FD9]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{card.title}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-[#1E6FD9]" />
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-border pt-3 text-center text-[11px] text-muted-foreground">
          Motor V2 — CN COLD • Versão {APP_VERSION} • {new Date().getFullYear()}
        </footer>
      </div>
    </PageContainer>
  );
}
