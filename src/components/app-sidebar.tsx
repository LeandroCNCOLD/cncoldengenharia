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
  
  ClipboardCheck,
  Library,
  Cpu,
  Plug,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

import { CnLogo } from "@/components/cn-logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavChild {
  label: string;
  to: string;
  icon: LucideIcon;
  description?: string;
  adminOnly?: boolean;
}

interface NavSubGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children: NavChild[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children: NavChild[];
  subGroups?: NavSubGroup[];
}

export const UNILAB_DB_TABLES: { mode: string; label: string }[] = [
  { mode: "cooling", label: "Raffreddamento" },
  { mode: "heating", label: "Riscaldamento" },
  { mode: "condensing", label: "Condensazione" },
  { mode: "direct_expansion", label: "Espansione Diretta" },
  { mode: "pump_evaporator", label: "Evaporatoria Pompa" },
  { mode: "steam", label: "Vapore" },
];

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Visão Geral",
    icon: LayoutDashboard,
    children: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: LayoutDashboard,
        description: "Indicadores e atividade recente do sistema",
      },
    ],
  },
  {
    id: "engineering",
    label: "Engenharia / Base Técnica",
    icon: Library,
    children: [
      {
        label: "Catálogo Técnico",
        to: "/coldpro/catalogo",
        icon: BookOpen,
        description: "Curvas e dados técnicos publicados",
      },
      {
        label: "Catálogo 480",
        to: "/coldpro/catalogo-480",
        icon: BookOpen,
        description: "Modelos consolidados prontos para gerar equipamentos",
      },
      {
        label: "Revisão Técnica",
        to: "/coldpro/admin/revisao-tecnica",
        icon: ClipboardCheck,
        description: "Aprovação e auditoria dos dados técnicos",
        adminOnly: true,
      },
    ],
  },
  {
    id: "products",
    label: "Produtos e Desenvolvimento",
    icon: Boxes,
    children: [
      {
        label: "Equipamentos",
        to: "/coldpro/equipamentos",
        icon: Boxes,
        description: "Produtos consolidados e prontos para uso",
      },
    ],
  },
  {
    id: "projects",
    label: "Projetos e Simulação",
    icon: FolderKanban,
    children: [
      {
        label: "Projetos",
        to: "/coldpro/projetos",
        icon: FolderKanban,
        description: "Projetos de aplicação e dimensionamento",
      },
      {
        label: "Painel ColdPro",
        to: "/coldpro/dashboard",
        icon: Cpu,
        description: "Análise e simulação termodinâmica",
      },
    ],
  },
  {
    id: "imports",
    label: "Importação e Integrações",
    icon: Plug,
    adminOnly: true,
    children: [
      {
        label: "Importar Unilab",
        to: "/admin/unilab-import",
        icon: Upload,
        description: "Importação de planilhas Unilab",
        adminOnly: true,
      },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    icon: Settings,
    adminOnly: true,
    children: [
      {
        label: "Administração",
        to: "/admin",
        icon: Settings,
        description: "Usuários, permissões e configurações",
        adminOnly: true,
      },
    ],
    subGroups: [
      {
        id: "admin-settings",
        label: "Configurações",
        icon: SlidersHorizontal,
        adminOnly: true,
        children: [
          {
            label: "Banco de Dados",
            to: "/admin/database",
            icon: Database,
            description: "Tabelas Unilab por modo de operação",
            adminOnly: true,
          },
          {
            label: "Banco Técnico",
            to: "/coldpro/admin/banco-tecnico",
            icon: Database,
            description: "Componentes técnicos consolidados (compressores, válvulas, ventiladores)",
            adminOnly: true,
          },
        ],
      },
    ],
  },
];

export function AppSidebar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    children: g.children.filter((c) => !c.adminOnly || isAdmin),
    subGroups: (g.subGroups ?? [])
      .map((sg) => ({
        ...sg,
        children: sg.children.filter((c) => !c.adminOnly || isAdmin),
      }))
      .filter((sg) => sg.children.length > 0 && (!sg.adminOnly || isAdmin)),
  })).filter(
    (g) =>
      (g.children.length > 0 || g.subGroups.length > 0) &&
      (!g.adminOnly || isAdmin),
  );

  // Default: all groups and subgroups open
  const initialOpen: Record<string, boolean> = {};
  for (const g of visibleGroups) {
    initialOpen[g.id] = true;
    for (const sg of g.subGroups) {
      initialOpen[`${g.id}:${sg.id}`] = true;
    }
  }
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  const renderLink = (item: NavChild) => {
    const Icon = item.icon;
    const active =
      pathname === item.to || pathname.startsWith(item.to + "/");
    const link = (
      <Link
        to={item.to}
        className={cn(
          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
        )}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
    return item.description ? (
      <Tooltip key={item.to}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {item.description}
        </TooltipContent>
      </Tooltip>
    ) : (
      <div key={item.to}>{link}</div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <CnLogo />
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            ColdPro
          </p>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {visibleGroups.map((group, idx) => {
            const GroupIcon = group.icon;
            const isOpen = openGroups[group.id] ?? true;
            const hasActive =
              group.children.some(
                (c) => pathname === c.to || pathname.startsWith(c.to + "/"),
              ) ||
              group.subGroups.some((sg) =>
                sg.children.some(
                  (c) => pathname === c.to || pathname.startsWith(c.to + "/"),
                ),
              );

            return (
              <div key={group.id}>
                {idx > 0 && (
                  <div className="mb-3 border-t border-sidebar-border/40" />
                )}
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    hasActive
                      ? "text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground/80",
                  )}
                >
                  <GroupIcon className="h-3.5 w-3.5 opacity-70" />
                  <span className="flex-1 text-left">{group.label}</span>
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3 w-3 opacity-60" />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-1 space-y-0.5">
                    {group.children.map(renderLink)}

                    {group.subGroups.map((sg) => {
                      const SubIcon = sg.icon;
                      const subKey = `${group.id}:${sg.id}`;
                      const subOpen = openGroups[subKey] ?? true;
                      return (
                        <div key={sg.id} className="mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenGroups((prev) => ({
                                ...prev,
                                [subKey]: !subOpen,
                              }))
                            }
                            className="ml-2 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                          >
                            <SubIcon className="h-3 w-3 opacity-70" />
                            <span className="flex-1 text-left">{sg.label}</span>
                            {subOpen ? (
                              <ChevronDown className="h-3 w-3 opacity-60" />
                            ) : (
                              <ChevronRight className="h-3 w-3 opacity-60" />
                            )}
                          </button>
                          {subOpen && (
                            <div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                              {sg.children.map(renderLink)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
    </TooltipProvider>
  );
}
