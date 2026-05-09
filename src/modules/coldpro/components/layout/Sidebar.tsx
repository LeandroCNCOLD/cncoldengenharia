import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FlaskConical,
  Gauge,
  FileText,
  Database,
  Library,
  ShieldCheck,
  Settings,
  LogOut,
  BookOpen,
  Cpu,
  Wrench,
  ClipboardList,
  Package,
  ChevronDown,
  ChevronRight,
  Cog,
} from "lucide-react";
import { useState } from "react";
import { CnLogo } from "@/components/cn-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/auth";

type NavItem = {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV_PROJETOS: NavItem[] = [
  { to: "/coldpro", label: "navigation.dashboard", Icon: LayoutDashboard, exact: true },
];

const NAV_ENGENHARIA: NavItem[] = [
  { to: "/coldpro/catalog", label: "navigation.catalogSelection", Icon: Database },
  { to: "/coldpro/cncoils", label: "navigation.cnCoilsSimulator", Icon: Gauge },
  { to: "/coldpro/hub-de-testes", label: "navigation.testHub", Icon: FlaskConical },
  { to: "/coldpro/application-engineering", label: "navigation.applicationEngineering", Icon: Cog },
];

const NAV_CADASTROS: NavItem[] = [
  { to: "/coldpro/components", label: "navigation.components", Icon: Cpu },
  { to: "/coldpro/library", label: "navigation.library", Icon: Library },
  { to: "/coldpro/record", label: "navigation.productRecord", Icon: ClipboardList },
  { to: "/coldpro/registry", label: "navigation.productRegistry", Icon: BookOpen },
  { to: "/coldpro/assembly", label: "navigation.assembly", Icon: Wrench },
];

const NAV_DOCUMENTACAO: NavItem[] = [
  { to: "/coldpro/ficha-tecnica", label: "navigation.technicalSheet", Icon: FileText },
  { to: "/coldpro/export", label: "navigation.export", Icon: Package },
];

const NAV_ADMIN: NavItem[] = [
  { to: "/coldpro/audit", label: "navigation.audit", Icon: ShieldCheck },
  { to: "/coldpro/settings", label: "navigation.settings", Icon: Settings },
];

function NavSection({
  title,
  items,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        className={`mb-1 flex w-full items-center justify-between px-3 ${collapsible ? "cursor-pointer hover:text-slate-300" : "cursor-default"}`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </p>
        {collapsible && (
          open
            ? <ChevronDown className="h-3 w-3 text-slate-500" />
            : <ChevronRight className="h-3 w-3 text-slate-500" />
        )}
      </button>
      {open && (
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.Icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact ?? false }}
                  activeProps={{
                    className:
                      "flex items-center gap-2.5 rounded-md bg-[#1E6FD9] px-3 py-2 text-sm font-medium text-white",
                  }}
                  inactiveProps={{
                    className:
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white",
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Sidebar({ onClose: _onClose }: { onClose?: () => void } = {}) {
  const { t } = useTranslation();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[#0F2744] text-slate-100">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <CnLogo variant="dark" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">CN COLD</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            {t("navigation.engineV2")}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavSection title={t("navigation.sectionProjects")} items={NAV_PROJETOS} />
        <NavSection title={t("navigation.sectionEngineering")} items={NAV_ENGENHARIA} />
        <NavSection
          title={t("navigation.sectionCadastros")}
          items={NAV_CADASTROS}
          collapsible
          defaultOpen={true}
        />
        <NavSection title={t("navigation.sectionDocumentation")} items={NAV_DOCUMENTACAO} collapsible defaultOpen={false} />
        {isAdmin && (
          <NavSection title={t("navigation.sectionAdmin")} items={NAV_ADMIN} collapsible defaultOpen={false} />
        )}
      </nav>

      <div className="space-y-2 border-t border-white/10 px-4 py-3">
        <div>
          <p className="truncate text-xs font-medium text-slate-100">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="truncate text-[10px] text-slate-400">
            {isAdmin ? t("common.administrator") : t("common.engineer")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" />
          {t("common.signOut")}
        </Button>
      </div>
    </aside>
  );
}
