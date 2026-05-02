import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Play, Send, RotateCcw } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ptBR } from "../i18n/messages.ptBR";
import { useUnilabCatalogs } from "../hooks/useUnilabCatalogs";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { GeometryForm } from "../components/GeometryForm";
import { ThermoForm } from "../components/ThermoForm";
import { ResultPanel } from "../components/ResultPanel";
import { AirSidePanel } from "../components/AirSidePanel";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import { useUnilabSimulation } from "../hooks/useUnilabSimulation";
import {
  validatePhysicalInputs,
  validateThermoInputs,
  validateCanSendToAssembly,
} from "../validators/simulationValidator";
import {
  toEvaporatorInput,
  toCondenserInput,
} from "../adapters/toColdProAdapter";
import { useComponentStore } from "@/modules/coldpro/stores/useComponentStore";
import {
  loadCoilGeometries,
  type CoilGeometryItem,
} from "../services/coilGeometryCatalogService";
import type {
  UnilabComponentType,
  UnilabPhysicalInputs,
  UnilabThermoInputs,
} from "../types/unilab.types";

const COMPONENT_LABELS: Record<UnilabComponentType, string> = {
  evaporator_dx: "Evaporador DX",
  evaporator_pumped: "Evaporador Bombeado",
  condenser_air: "Condensador a Ar",
  condenser_shell_tube: "Condensador Casco-Tubo",
  heating_coil: "Bateria de Aquecimento",
  cooling_coil: "Bateria de Resfriamento",
  defrost_steam_coil: "Serpentina de Degelo",
};

function isCondenser(t: UnilabComponentType) {
  return t === "condenser_air" || t === "condenser_shell_tube";
}

export function UnilabWorkspacePage() {
  const search = useSearch({ from: "/_app/coldpro/unilab/workspace" }) as {
    type?: UnilabComponentType;
  };
  const componentType = search.type ?? "evaporator_dx";
  const componentLabel = COMPONENT_LABELS[componentType] ?? componentType;
  const navigate = useNavigate();

  const catalogs = useUnilabCatalogs();
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const thermo = useUnilabSimulationStore((s) => s.thermoInputs);
  const result = useUnilabSimulationStore((s) => s.result);
  const warnings = useUnilabSimulationStore((s) => s.warnings);
  const isSimulating = useUnilabSimulationStore((s) => s.isSimulating);
  const reset = useUnilabSimulationStore((s) => s.reset);
  const setWarnings = useUnilabSimulationStore((s) => s.setWarnings);

  // Catálogo enriquecido de geometrias (com tipo_serpentina, campos pt-BR etc.).
  // Carregado via service dedicado; o `useUnilabCatalogs` continua provendo a
  // versão base usada pelo motor termodinâmico (não alteramos coldpro_v2).
  const [enrichedGeometries, setEnrichedGeometries] = useState<CoilGeometryItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadCoilGeometries()
      .then((items) => {
        if (!cancelled) setEnrichedGeometries(items);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setWarnings([`Falha ao carregar coilGeometries.json: ${msg}`]);
      });
    return () => {
      cancelled = true;
    };
  }, [setWarnings]);

  const simulationDeps = useMemo(
    () => ({
      geometries: catalogs.geometries,
      tubeMaterials: catalogs.tubeMaterials,
      correctionCoefficients: catalogs.correctionCoefficients,
      pressureDropFan: catalogs.pressureDropFan,
    }),
    [
      catalogs.geometries,
      catalogs.tubeMaterials,
      catalogs.correctionCoefficients,
      catalogs.pressureDropFan,
    ],
  );

  const { run } = useUnilabSimulation(simulationDeps);
  const [sending, setSending] = useState(false);

  const inputsValid =
    validatePhysicalInputs(physical).isValid &&
    validateThermoInputs(thermo).isValid;
  const canSimulate = catalogs.ready && inputsValid && !isSimulating;

  const handleSimulate = () => {
    const physCheck = validatePhysicalInputs(physical);
    const thermoCheck = validateThermoInputs(thermo);
    const errors = [...physCheck.errors, ...thermoCheck.errors];
    if (errors.length > 0) {
      setWarnings(errors);
      return;
    }
    run();
  };

  const handleSendToAssembly = () => {
    const sendCheck = validateCanSendToAssembly(result, physical);
    if (!sendCheck.isValid) {
      setWarnings(sendCheck.errors);
      return;
    }
    setSending(true);
    try {
      const phys = physical as UnilabPhysicalInputs;
      const therm = thermo as UnilabThermoInputs;
      const ctx = { tubeMaterials: catalogs.tubeMaterials };
      const baseName = `UNILAB ${componentLabel} ${new Date().toLocaleString("pt-BR")}`;

      if (isCondenser(componentType)) {
        const spec = toCondenserInput(therm, result!);
        useComponentStore.getState().addCondenser(baseName, spec);
        navigate({ to: "/coldpro/components" });
      } else {
        const spec = toEvaporatorInput(phys, therm, result!, ctx);
        useComponentStore
          .getState()
          .addCoil(baseName, "evaporator", spec);
        navigate({ to: "/coldpro/components" });
      }
    } catch (err) {
      setWarnings([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSending(false);
    }
  };

  return (
    <PageContainer
      title={`${ptBR.workspace.title} — ${componentLabel}`}
      subtitle={ptBR.module.subtitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/coldpro/unilab"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {ptBR.workspace.actions.backToDashboard}
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar
          </button>
          <button
            type="button"
            disabled={!canSimulate}
            onClick={handleSimulate}
            title={
              !catalogs.ready
                ? ptBR.validation.blockedNoDatasets
                : !inputsValid
                  ? "Preencha todos os campos obrigatórios."
                  : ptBR.workspace.actions.simulate
            }
            className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1759b3] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Play className="h-4 w-4" />
            {isSimulating ? "Simulando…" : ptBR.workspace.actions.simulate}
          </button>
          <button
            type="button"
            disabled={!result || sending}
            onClick={handleSendToAssembly}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Send className="h-4 w-4" />
            {ptBR.workspace.actions.sendToAssembly}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Column title={ptBR.workspace.columns.geometry}>
          {catalogs.loading ? (
            <SkeletonCard />
          ) : (
            <GeometryForm
              geometries={
                enrichedGeometries.length > 0
                  ? enrichedGeometries
                  : catalogs.geometries
              }
              tubeMaterials={catalogs.tubeMaterials}
              finPitches={catalogs.finPitches}
              finThicknesses={catalogs.finThicknesses}
              disabled={!catalogs.ready}
            />
          )}
        </Column>
        <Column title="Lado Ar / Ventilação">
          <AirSidePanel />
        </Column>
        <Column title={ptBR.workspace.columns.thermo}>
          {catalogs.loading ? (
            <SkeletonCard />
          ) : (
            <ThermoForm
              refrigerants={catalogs.refrigerants}
              componentType={componentType}
              disabled={!catalogs.ready}
            />
          )}
        </Column>
        <Column title={ptBR.workspace.columns.result}>
          <DatasetStatusPanel
            loading={catalogs.loading}
            ready={catalogs.ready}
            errors={catalogs.errors}
            missing={catalogs.missing}
            compact
          />
          <div className="mt-4">
            <ResultPanel result={result} warnings={warnings} />
          </div>
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

function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
      <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-8 w-2/3 animate-pulse rounded bg-slate-100" />
    </div>
  );
}
