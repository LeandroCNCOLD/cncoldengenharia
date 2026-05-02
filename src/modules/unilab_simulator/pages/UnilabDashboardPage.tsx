import { Snowflake, Flame, Wind, Droplets, Zap, RefreshCw, Cylinder, Server } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ptBR } from "../i18n/messages.ptBR";
import { useUnilabCatalogs } from "../hooks/useUnilabCatalogs";
import { UnilabDashboardCard } from "../components/UnilabDashboardCard";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import type { UnilabComponentType } from "../types/unilab.types";

interface CardConfig {
  type: UnilabComponentType;
  title: string;
  description: string;
  Icon: typeof Snowflake;
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

export function UnilabDashboardPage() {
  const catalogs = useUnilabCatalogs();
  const blocked = !catalogs.loading && !catalogs.ready;

  return (
    <PageContainer title={ptBR.module.title} subtitle={ptBR.module.subtitle}>
      <div className="space-y-6">
        <DatasetStatusPanel
          loading={catalogs.loading}
          ready={catalogs.ready}
          errors={catalogs.errors}
          missing={catalogs.missing}
        />

        <p className="text-sm text-slate-600">{ptBR.dashboard.intro}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CARDS.map((card) => (
            <UnilabDashboardCard
              key={card.type}
              title={card.title}
              description={card.description}
              href="/coldpro/unilab/workspace"
              searchParams={{ type: card.type }}
              Icon={card.Icon}
              disabled={blocked}
              disabledHint={blocked ? ptBR.validation.blockedNoDatasets : undefined}
            />
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <strong className="text-slate-800">Aviso técnico:</strong> {ptBR.module.disclaimer}
        </div>
      </div>
    </PageContainer>
  );
}
