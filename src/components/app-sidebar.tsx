import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  Settings,
  LogOut,
  Database,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  BookOpen,
  Upload,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";

import { CnLogo } from "@/components/cn-logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavChild {
  label: string;
  to: string;
}

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: NavChild[];
}

export const UNILAB_DB_TABLES: { mode: string; label: string }[] = [
  { mode: "cooling", label: "Raffreddamento" },
  { mode: "heating", label: "Riscaldamento" },
  { mode: "condensing", label: "Condensazione" },
  { mode: "direct_expansion", label: "Espansione Diretta" },
  { mode: "pump_evaporator", label: "Evaporatoria Pompa" },
  { mode: "steam", label: "Vapore" },
];

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Painel ColdPro", to: "/coldpro/dashboard", icon: FileBarChart },
  { label: "Projetos", to: "/coldpro/projetos", icon: FolderKanban },
  { label: "Equipamentos", to: "/coldpro/equipamentos", icon: Boxes },
  { label: "Catálogo Técnico", to: "/coldpro/catalogo", icon: BookOpen },
  { label: "Administração", to: "/admin", icon: Settings, adminOnly: true },
  { label: "Importar Unilab", to: "/admin/unilab-import", icon: Upload, adminOnly: true },
  { label: "Banco Técnico", to: "/coldpro/admin/banco-tecnico", icon: Database, adminOnly: true },
  { label: "Revisão Técnica", to: "/coldpro/admin/revisao-tecnica", icon: Database, adminOnly: true },
  {
    label: "Banco de Dados",
    to: "/admin/database",
    icon: Database,
    adminOnly: true,
    children: UNILAB_DB_TABLES.map((t) => ({
      label: t.label,
      to: `/admin/database/${t.mode}`,
    })),
  },
];

export function AppSidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visibleItems = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const initialOpen: Record<string, boolean> = {};
  for (const item of visibleItems) {
    if (item.children && pathname.startsWith(item.to)) initialOpen[item.to] = true;
  }
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <CnLogo />
      </div>

      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          ColdPro
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(item.to + "/");

          if (item.children) {
            const isOpen = openGroups[item.to] ?? active;
            return (
              <div key={item.to}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [item.to]: !isOpen }))
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1 border-l border-sidebar-border/60 pl-3 ml-5">
                    {item.children.map((child) => {
                      const childActive = pathname === child.to;
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={cn(
                            "block rounded-md px-3 py-1.5 text-xs transition-colors",
                            childActive
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
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
