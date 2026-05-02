import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Play, Construction } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ptBR } from "../i18n/messages.ptBR";
import { useUnilabCatalogs } from "../hooks/useUnilabCatalogs";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import type { UnilabComponentType } from "../types/unilab.types";

const COMPONENT_LABELS: Record<UnilabComponentType, string> = {
  evaporator_dx: "Evaporador DX",
  evaporator_pumped: "Evaporador Bombeado",
  condenser_air: "Condensador a Ar",
  condenser_shell_tube: "Condensador Casco-Tubo",
  heating_coil: "Bateria de Aquecimento",
  cooling_coil: "Bateria de Resfriamento",
  defrost_steam_coil: "Serpentina de Degelo",
};

export function UnilabWorkspacePage() {
  const search = useSearch({ from: "/_app/coldpro/unilab/workspace" }) as {
    type?: UnilabComponentType;
  };
  const componentType = search.type ?? "evaporator_dx";
  const componentLabel = COMPONENT_LABELS[componentType] ?? componentType;

  const catalogs = useUnilabCatalogs();
  const canSimulate = catalogs.ready;

  return (
    <PageContainer
      title={`${ptBR.workspace.title} — ${componentLabel}`}
      subtitle={ptBR.module.subtitle}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/coldpro/unilab"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {ptBR.workspace.actions.backToDashboard}
          </Link>
          <button
            type="button"
            disabled={!canSimulate}
            title={
              !canSimulate ? ptBR.validation.blockedNoDatasets : ptBR.workspace.actions.simulate
            }
            className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Play className="h-4 w-4" />
            {ptBR.workspace.actions.simulate}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Column title={ptBR.workspace.columns.geometry}>
          <PlaceholderBox />
        </Column>
        <Column title={ptBR.workspace.columns.thermo}>
          <PlaceholderBox />
        </Column>
        <Column title={ptBR.workspace.columns.result}>
          <DatasetStatusPanel
            loading={catalogs.loading}
            ready={catalogs.ready}
            errors={catalogs.errors}
            missing={catalogs.missing}
            compact
          />
          {catalogs.ready && (
            <div className="mt-4 rounded-lg border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              {ptBR.workspace.result.empty}
            </div>
          )}
        </Column>
      </div>
    </PageContainer>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function PlaceholderBox() {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-6 text-center">
      <Construction className="mx-auto mb-2 h-6 w-6 text-slate-400" />
      <p className="text-xs text-slate-500">
        Formulário será habilitado na próxima fase, junto com o motor termodinâmico.
      </p>
    </div>
  );
}
