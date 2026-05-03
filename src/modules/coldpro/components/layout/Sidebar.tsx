import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  Map,
  FileText,
  Database,
  Download,
  ShieldCheck,
  LogOut,
  Boxes,
  Wrench,
  Database as DatabaseIcon,
  Gauge,
  Scale,
} from "lucide-react";
import { CnLogo } from "@/components/cn-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { UserModeSwitcher } from "../mode/UserModeSwitcher";

type NavItem = {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  exact?: boolean;
  comingSoon?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Início",
    items: [
      { to: "/coldpro", label: "Dashboard", Icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Simulação",
    items: [
      { to: "/coldpro/cncoils", label: "CN COILS", Icon: Gauge },
      { to: "/coldpro/map", label: "Mapa Operacional", Icon: Map },
      { to: "/coldpro/curve", label: "Curva de Desempenho", Icon: TrendingUp },
      { to: "/coldpro/simulation", label: "Equilíbrio do Sistema", Icon: Scale },
    ],
  },
  {
    label: "Dados",
    items: [
      { to: "/coldpro/components", label: "Componentes", Icon: Boxes },
      { to: "/coldpro/catalog", label: "Catálogo CN COLD", Icon: DatabaseIcon },
      { to: "/coldpro/ficha-tecnica", label: "Ficha Técnica", Icon: FileText, comingSoon: true },
      { to: "/coldpro/registry", label: "Registry de Produtos", Icon: Database },
    ],
  },
  {
    label: "Produção",
    items: [
      { to: "/coldpro/montagem", label: "Montagem", Icon: Wrench, comingSoon: true },
      { to: "/coldpro/export", label: "Exportação", Icon: Download },
      { to: "/coldpro/audit", label: "Auditoria CN COLD", Icon: ShieldCheck, comingSoon: true },
    ],
  },
];

export function Sidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-[#0F2744] text-slate-100">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <CnLogo variant="dark" />
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">ColdPro V2</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400">CN COLD</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={group.label} className={gIdx === 0 ? "" : "pt-3"}>
            <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400/70">
              {group.label}
            </p>
            <ul className="space-y-0">
              {group.items.map((item) => {
                const Icon = item.Icon;
                const active = isActive(item);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      title={item.comingSoon ? "Em desenvolvimento" : undefined}
                      className={
                        active
                          ? "flex items-center gap-2 rounded bg-[#1E6FD9] px-2 py-1 text-[11px] font-medium text-white"
                          : "flex items-center gap-2 rounded px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 hover:text-white"
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.comingSoon && (
                        <span className="ml-auto rounded bg-amber-500/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-amber-300">
                          Em breve
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1.5 border-t border-white/10 px-3 py-2">
        <p className="text-[9px] uppercase tracking-wider text-slate-400">Modo do usuário</p>
        <UserModeSwitcher />

        <div>
          <p className="truncate text-[11px] font-medium text-slate-100">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="truncate text-[9px] text-slate-400">
            {isAdmin ? "Administrador" : "Engenheiro"}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-2 px-2 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </Button>

        <p className="text-[9px] text-slate-500">Motor V2 — CN COLD</p>
      </div>
    </aside>
  );
}
