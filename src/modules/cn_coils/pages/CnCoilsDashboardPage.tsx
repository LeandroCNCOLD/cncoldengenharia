import {
  Snowflake,
  Flame,
  Wind,
  Droplets,
  Zap,
  RefreshCw,
  Cylinder,
  Server,
  Waves,
  Combine,
  Box,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ptBR } from "../i18n/messages.ptBR";
import { useCnCoilsCatalogs } from "../hooks/useCnCoilsCatalogs";
import { CnCoilsDashboardCard } from "../components/CnCoilsDashboardCard";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import type { CnCoilsComponentType } from "../types/cncoils.types";

interface CardConfig {
  type: CnCoilsComponentType;
  title: string;
  description: string;
  Icon: LucideIcon;
}

interface SystemCardConfig {
  id: string;
  title: string;
  description: string;
  href: string;
  Icon: LucideIcon;
  comingSoon?: boolean;
}

const CARDS: CardConfig[] = [
  {
    type: "evaporator_dx",
    title: ptBR.dashboard.cards.evaporators.title,
    description: ptBR.dashboard.cards.evaporators.description,
    Icon: Snowflake,
  },
  {
    type: "condenser_air",
    title: ptBR.dashboard.cards.condensers.title,
    description: ptBR.dashboard.cards.condensers.description,
    Icon: Wind,
  },
  {
    type: "heating_coil",
    title: ptBR.dashboard.cards.heating.title,
    description: ptBR.dashboard.cards.heating.description,
    Icon: Flame,
  },
  {
    type: "cooling_coil",
    title: ptBR.dashboard.cards.cooling.title,
    description: ptBR.dashboard.cards.cooling.description,
    Icon: Droplets,
  },
  {
    type: "defrost_steam_coil",
    title: ptBR.dashboard.cards.defrost.title,
    description: ptBR.dashboard.cards.defrost.description,
    Icon: Zap,
  },
  {
    type: "recuperator",
    title: ptBR.dashboard.cards.recuperator.title,
    description: ptBR.dashboard.cards.recuperator.description,
    Icon: RefreshCw,
  },
  {
    type: "shell_tube",
    title: ptBR.dashboard.cards.shellTube.title,
    description: ptBR.dashboard.cards.shellTube.description,
    Icon: Cylinder,
  },
  {
    type: "chiller_unit",
    title: ptBR.dashboard.cards.chiller.title,
    description: ptBR.dashboard.cards.chiller.description,
    Icon: Server,
  },
];

const SYSTEM_CARDS: SystemCardConfig[] = [
  {
    id: "dehumidification",
    title: "Desumidificação",
    description: "Evaporador (resfria/desumidifica) + Bateria de Reaquecimento sensível.",
    href: "/coldpro/cncoils/systems/dehumidification",
    Icon: Waves,
  },
  {
    id: "dx-complete",
    title: "Sistema DX Completo",
    description: "Evaporador DX + Condensador a Ar acoplados.",
    href: "/coldpro/cncoils/systems/dx-complete",
    Icon: Combine,
    comingSoon: true,
  },
  {
    id: "cold-room",
    title: "Câmara Fria",
    description: "Evaporador + Condensador + Carga Térmica da câmara.",
    href: "/coldpro/cncoils/systems/cold-room",
    Icon: Box,
    comingSoon: true,
  },
  {
    id: "heat-pump",
    title: "Bomba de Calor",
    description: "Unidade Interna + Unidade Externa em ciclo reverso.",
    href: "/coldpro/cncoils/systems/heat-pump",
    Icon: Thermometer,
    comingSoon: true,
  },
];

export function CnCoilsDashboardPage() {
  const catalogs = useCnCoilsCatalogs();
  const blocked = !catalogs.loading && !catalogs.ready;

  return (
    <PageContainer title={ptBR.module.title} subtitle={ptBR.module.subtitle}>
      <div className="space-y-8">
        <DatasetStatusPanel
          loading={catalogs.loading}
          ready={catalogs.ready}
          errors={catalogs.errors}
          missing={catalogs.missing}
        />

        <p className="text-sm text-slate-600">{ptBR.dashboard.intro}</p>

        {/* GRUPO A — Componentes Isolados (Mundo 1) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Componentes Isolados
            </h2>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Mundo 1
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CARDS.map((card) => (
              <CnCoilsDashboardCard
                key={card.type}
                title={card.title}
                description={card.description}
                href="/coldpro/cncoils/workspace"
                searchParams={{ type: card.type }}
                Icon={card.Icon}
                disabled={blocked}
                disabledHint={blocked ? ptBR.validation.blockedNoDatasets : undefined}
              />
            ))}
          </div>
        </section>

        {/* GRUPO B — Sistemas Completos (Mundo 2) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Sistemas Completos
            </h2>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Mundo 2
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SYSTEM_CARDS.map((card) => (
              <CnCoilsDashboardCard
                key={card.id}
                title={card.title}
                description={card.description}
                href={card.href}
                Icon={card.Icon}
                disabled={blocked || card.comingSoon}
                disabledHint={
                  blocked
                    ? ptBR.validation.blockedNoDatasets
                    : card.comingSoon
                      ? "Em breve"
                      : undefined
                }
              />
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <strong className="text-slate-800">Aviso técnico:</strong> {ptBR.module.disclaimer}
        </div>
      </div>
    </PageContainer>
  );
}
