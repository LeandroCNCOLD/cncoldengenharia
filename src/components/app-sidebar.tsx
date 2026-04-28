import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  Upload,
  BookOpen,
  FlaskConical,
  FileBarChart,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { CnLogo } from "@/components/cn-logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Componentes", to: "/components", icon: Boxes },
  { label: "Uploads", to: "/uploads", icon: Upload },
  { label: "Catálogo Técnico", to: "/catalog", icon: BookOpen },
  { label: "Simulação", to: "/simulation", icon: FlaskConical, badge: "Em breve" },
  { label: "Relatórios", to: "/reports", icon: FileBarChart, badge: "Em breve" },
  { label: "Administração", to: "/admin", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visibleItems = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <CnLogo />
      </div>

      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Engineering
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visibleItems.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.badge && (
                <span className="rounded-full bg-sidebar-foreground/10 px-2 py-0.5 text-[10px] uppercase text-sidebar-foreground/60">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-2 text-xs">
          <p className="truncate font-medium text-sidebar-foreground">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="truncate text-sidebar-foreground/60">
            {isAdmin ? "Administrador" : "Engenheiro"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
