import { Link } from "@tanstack/react-router";
import {
  Activity,
  TrendingUp,
  Map,
  FileText,
  Database,
  ShieldCheck,
  Plus,
  ArrowRight,
} from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { useSessionStore } from "../stores/useSessionStore";
import { useUserModeStore } from "../stores/useUserModeStore";
import { useTranslation } from "@/i18n/useTranslation";

const MODULES = [
  {
    to: "/coldpro/simulation",
    labelKey: "navigation.systemEquilibrium",
    description: "Resolve o equilíbrio termodinâmico completo do sistema.",
    Icon: Activity,
  },
  {
    to: "/coldpro/curve",
    labelKey: "navigation.performanceCurve",
    description: "Gera a curva capacidade × temperatura do produto.",
    Icon: TrendingUp,
  },
  {
    to: "/coldpro/map",
    labelKey: "navigation.operatingMap",
    description: "Mapa multivariável de operação do equipamento.",
    Icon: Map,
  },
  {
    to: "/coldpro/record",
    labelKey: "navigation.productRecord",
    description: "Ficha técnica final auditada do produto.",
    Icon: FileText,
  },
  {
    to: "/coldpro/registry",
    labelKey: "navigation.productRegistry",
    description: "Registro de produtos versionados e auditados.",
    Icon: Database,
  },
  {
    to: "/coldpro/audit",
    label: "Auditoria CN COLD",
    description: "Audita o catálogo CN COLD contra o motor.",
    Icon: ShieldCheck,
  },
] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function DashboardPage() {
  const { t } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const mode = useUserModeStore((s) => s.mode);

  const recent = [...sessions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const handleNewSession = () => {
    const stamp = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    createSession(`Sessão ${stamp}`, mode);
  };

  return (
    <PageContainer
      title={t("dashboard.title")}
      subtitle={t("dashboard.subtitle")}
      actions={
        <button
          type="button"
          onClick={handleNewSession}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1E6FD9] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1858b0]"
        >
          <Plus className="h-4 w-4" />
          {t("dashboard.newSession")}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.recentSessions")}</h2>
            <span className="text-xs text-slate-400">
              {sessions.length} {t("dashboard.total")}
            </span>
          </div>

          {recent.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {t("dashboard.emptySessions")}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recent.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(s.createdAt)} · {t("dashboard.mode")} {s.mode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSession(s.id)}
                      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        isActive
                          ? "bg-[#1E6FD9] text-white"
                          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {isActive ? t("common.active") : t("common.select")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.engineStatus")}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">{t("dashboard.version")}</dt>
              <dd className="font-medium text-slate-800">ColdPro V2</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">{t("dashboard.currentMode")}</dt>
              <dd className="font-medium capitalize text-slate-800">{mode}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">{t("dashboard.memorySessions")}</dt>
              <dd className="font-medium text-slate-800">{sessions.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{t("dashboard.availableModules")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.Icon;
            return (
              <Link
                key={m.to}
                to={m.to}
                className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#1E6FD9]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1E6FD9]/10 text-[#1E6FD9]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#1E6FD9]" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{t(m.labelKey)}</h3>
                <p className="text-xs text-slate-500">{m.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </PageContainer>
  );
}
