import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  TrendingUp,
  Map,
  FileText,
  Database,
  Download,
  ShieldCheck,
  LogOut,
  Boxes,
  FolderOpen,
  Wrench,
  Database as DatabaseIcon,
  Gauge,
  Scale,
  RotateCw,
  Layers,
  Droplets,
  Flame,
  Snowflake,
  Target,
  Thermometer,
  Wind,
  Waves,
  Zap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/modules/cn_coils/components/ThemeToggle";
import { useProjectStore } from "@/modules/cn_coils/store/useProjectStore";

type NavItem = {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  search?: Record<string, string>;
  exact?: boolean;
  comingSoon?: boolean;
  badge?: "projects";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Início",
    items: [{ to: "/coldpro", label: "Dashboard", Icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Simulação",
    items: [
      { to: "/coldpro/projects", label: "Meus Projetos", Icon: FolderOpen, badge: "projects" },
      { to: "/coldpro/compare", label: "Comparar", Icon: Scale },
      { to: "/coldpro/cncoils", label: "CN COILS", Icon: Gauge },
      { to: "/coldpro/cncoils/workspace", label: "· Evaporador DX", Icon: Snowflake, search: { type: "evaporator_dx" } },
      { to: "/coldpro/cncoils/workspace", label: "· Condensador a Ar", Icon: Thermometer, search: { type: "condenser_air" } },
      { to: "/coldpro/cncoils/workspace", label: "· Compressor", Icon: Zap, search: { type: "compressor" } },
      { to: "/coldpro/cncoils/workspace", label: "· Cond. Evaporativo", Icon: Droplets, search: { type: "evaporative_condenser" } },
      { to: "/coldpro/cncoils/workspace", label: "· Cond. a Água", Icon: Waves, search: { type: "water_condenser" } },
      { to: "/coldpro/cncoils/workspace", label: "· Bat. Aquecimento", Icon: Flame, search: { type: "heating_coil" } },
      { to: "/coldpro/cycle", label: "Ciclo de Refrigeração", Icon: RotateCw },
      { to: "/coldpro/map", label: "Mapa Operacional", Icon: Map },
      { to: "/coldpro/assembly", label: "Arranjo de Serpentinas", Icon: Layers },
      { to: "/coldpro/frost", label: "Análise de Geada", Icon: Snowflake, comingSoon: true },
      { to: "/coldpro/optimization", label: "Otimização", Icon: Target, comingSoon: true },
      { to: "/coldpro/curve", label: "Curva de Desempenho", Icon: TrendingUp },
      { to: "/coldpro/simulation", label: "Equilíbrio do Sistema", Icon: Scale },
    ],
  },
  {
    label: "Sistemas",
    items: [
      { to: "/coldpro/systems/cold-room", label: "Câmara Fria", Icon: Snowflake },
      { to: "/coldpro/systems/dx-complete", label: "DX Completo", Icon: Wind },
      { to: "/coldpro/systems/heat-pump", label: "Bomba de Calor", Icon: Thermometer },
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

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectCount = useProjectStore((s) => s.projects.length);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Snowflake className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-tight text-sidebar-foreground">
              <span className="text-primary">CN</span>Cold
            </div>
            <div className="text-xs leading-tight text-sidebar-foreground/60">Engenharia</div>
          </div>
          {/* Close button — only shown when onClose is provided (mobile drawer) */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-0.5">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={group.label} className={gIdx === 0 ? "" : "pt-1"}>
            <p className="px-2 pb-px text-[8px] font-semibold uppercase leading-none tracking-widest text-sidebar-foreground/50">
              {group.label}
            </p>
            <ul className="space-y-0">
              {group.items.map((item) => {
                const Icon = item.Icon;
                const active = isActive(item);
                return (
                  <li key={`${item.to}-${item.label}`}>
                    <Link
                      to={item.to}
                      search={item.search as never}
                      title={item.comingSoon ? "Em desenvolvimento" : undefined}
                      onClick={onClose}
                      className={
                        active
                          ? "flex h-[17px] items-center gap-1.5 rounded bg-sidebar-primary px-2 text-[10px] font-medium leading-none text-sidebar-primary-foreground"
                          : "flex h-[17px] items-center gap-1.5 rounded px-2 text-[10px] leading-none text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.comingSoon && (
                        <span className="ml-auto rounded bg-amber-500/20 px-0.5 py-px text-[7px] font-semibold uppercase leading-none tracking-wide text-amber-300">
                          Em breve
                        </span>
                      )}
                      {item.badge === "projects" && projectCount > 0 && (
                        <Badge variant="secondary" className="ml-auto h-3 px-1 text-[7px] leading-none">
                          {projectCount}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-1.5">
        <div>
          <p className="truncate text-[11px] font-medium text-sidebar-foreground">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="truncate text-[9px] text-sidebar-foreground/60">
            {isAdmin ? "Administrador" : "Engenheiro"}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-2 px-2 text-[11px] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </Button>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[9px] text-sidebar-foreground/50">CNCold Engenharia</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
