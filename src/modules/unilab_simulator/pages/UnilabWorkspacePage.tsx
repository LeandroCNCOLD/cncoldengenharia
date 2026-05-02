import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ptBR } from "../i18n/messages.ptBR";
import { useUnilabCatalogs } from "../hooks/useUnilabCatalogs";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { ResultPanel } from "../components/ResultPanel";
import { AirSidePanel } from "../components/AirSidePanel";
import { FluidSidePanel } from "../components/FluidSidePanel";
import { GeometryBottomBar } from "../components/GeometryBottomBar";
import { CoilSchematicModal } from "../components/CoilSchematicModal";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import { useUnilabSimulation } from "../hooks/useUnilabSimulation";
import { useUnilabSimulationV2 } from "../hooks/useUnilabSimulationV2";
import { useUnilabInputBridge } from "../hooks/useUnilabInputBridge";
import { loadUnilabHeatTransferCatalog } from "../services/unilabHeatTransferCatalog";
import type { UnilabHeatTransferCatalog } from "../engine_v2/heatTransfer";
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
import { loadCoilGeometries } from "../services/coilGeometryCatalogService";
import { getApplicationConfig } from "../config/applicationConfig";
import type {
  UnilabComponentType,
  UnilabPhysicalInputs,
  UnilabThermoInputs,
} from "../types/unilab.types";

function isCondenser(t: UnilabComponentType) {
  return t === "condenser_air" || t === "condenser_shell_tube";
}

export function UnilabWorkspacePage() {
  const search = useSearch({ from: "/_app/coldpro/unilab/workspace" }) as {
    type?: UnilabComponentType;
  };
  const componentType = search.type ?? "evaporator_dx";
  const componentLabel = getApplicationConfig(componentType).label;
  const navigate = useNavigate();

  const catalogs = useUnilabCatalogs();
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const thermo = useUnilabSimulationStore((s) => s.thermoInputs);
  const result = useUnilabSimulationStore((s) => s.result);
  const warnings = useUnilabSimulationStore((s) => s.warnings);
  const isSimulating = useUnilabSimulationStore((s) => s.isSimulating);
  const reset = useUnilabSimulationStore((s) => s.reset);
  const setWarnings = useUnilabSimulationStore((s) => s.setWarnings);

  useUnilabInputBridge(componentType);

  // Pré-aquece o cache do catálogo de geometrias (modal carrega sob demanda)
  useEffect(() => {
    let cancelled = false;
    loadCoilGeometries().catch((err) => {
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

  const [htCatalog, setHtCatalog] = useState<UnilabHeatTransferCatalog>({
    entries: [],
  });
  useEffect(() => {
    loadUnilabHeatTransferCatalog().then(setHtCatalog).catch(() => {
      setHtCatalog({ entries: [] });
    });
  }, []);

  const engineVersion = useUnilabSimulationStore((s) => s.engineVersion);
  const { run: runV2 } = useUnilabSimulationV2({
    tubeMaterials: catalogs.tubeMaterials,
    htCatalog,
    componentType,
  });
  const [sending, setSending] = useState(false);
  const [schematicOpen, setSchematicOpen] = useState(false);

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
    if (engineVersion === "v2") {
      runV2();
    } else {
      run();
    }
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
        useComponentStore.getState().addCoil(baseName, "evaporator", spec);
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
      title={`UNILAB — ${componentLabel}`}
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
      {/*
        Layout configurador CN COILS:
        - Esquerda: WorkspaceSidebar (Geometria/Tubo/Aleta/Distribuidor abrem em modal)
        - Centro: Lado Ventilação + Esquema da serpentina (SEMPRE fixos)
        - Direita: FluidSidePanel + Resultado (SEMPRE fixos)
        - Rodapé: GeometryBottomBar (SEMPRE fixo, full width)
      */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[210px_minmax(0,1fr)_minmax(0,1fr)]">
        <WorkspaceSidebar
          componentType={componentType}
          onSimulate={handleSimulate}
          onReset={reset}
          canSimulate={canSimulate}
          isSimulating={isSimulating}
          faceAreaM2={result?.faceAreaM2}
          onOpenSchematic={() => setSchematicOpen(true)}
        />

        <div className="min-w-0 space-y-2 xl:contents">
          {/* COLUNA CENTRAL — Lado Ventilador (fixo). Esquema da serpentina abre via "Desenho". */}
          <div className="min-w-0 space-y-2">
            <AirSidePanel result={result} />
          </div>

          {/* COLUNA DIREITA — Lado Fluido FIXO */}
          <div className="min-w-0 space-y-2">
            <FluidSidePanel
              componentType={componentType}
              refrigerants={catalogs.refrigerants}
              disabled={!catalogs.ready}
              result={result}
            />
            <DatasetStatusPanel
              loading={catalogs.loading}
              ready={catalogs.ready}
              errors={catalogs.errors}
              missing={catalogs.missing}
              compact
            />
            <ResultPanel result={result} warnings={warnings} />
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR — Geometria, full width */}
      <div className="mt-2">
        <GeometryBottomBar />
      </div>

      <CoilSchematicModal
        open={schematicOpen}
        onClose={() => setSchematicOpen(false)}
      />
    </PageContainer>
  );
}

