import { Link, useNavigate } from "@tanstack/react-router";
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
};

const NAV_ITEMS: NavItem[] = [
  { to: "/coldpro", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { to: "/coldpro/components", label: "Componentes", Icon: Boxes },
  { to: "/coldpro/assembly", label: "Montagem", Icon: Wrench },
  { to: "/coldpro/simulation", label: "Equilíbrio do Sistema", Icon: Activity },
  { to: "/coldpro/curve", label: "Curva de Desempenho", Icon: TrendingUp },
  { to: "/coldpro/map", label: "Mapa Operacional", Icon: Map },
  { to: "/coldpro/record", label: "Ficha Técnica", Icon: FileText },
  { to: "/coldpro/registry", label: "Registry de Produtos", Icon: Database },
  { to: "/coldpro/export", label: "Exportação", Icon: Download },
  { to: "/coldpro/audit", label: "Auditoria CN COLD", Icon: ShieldCheck },
];

export function Sidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[#0F2744] text-slate-100">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <CnLogo variant="dark" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">ColdPro V2</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">CN COLD</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
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
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-white/10 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Modo do usuário</p>
        <UserModeSwitcher />

        <div className="pt-2">
          <p className="truncate text-xs font-medium text-slate-100">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="truncate text-[10px] text-slate-400">
            {isAdmin ? "Administrador" : "Engenheiro"}
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
          Sair
        </Button>

        <p className="pt-1 text-[10px] text-slate-500">Motor V2 — CN COLD</p>
      </div>
    </aside>
  );
}

