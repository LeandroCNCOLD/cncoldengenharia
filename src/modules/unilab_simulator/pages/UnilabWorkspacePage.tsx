import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Send, Package } from "lucide-react";
import { toast } from "sonner";
import { runSimulation, SimulationError } from "../engine/simulatorCore";
import { MachineImportModal } from "../components/MachineImportModal";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ptBR } from "../i18n/messages.ptBR";
import { useUnilabCatalogs } from "../hooks/useUnilabCatalogs";
import { DatasetStatusPanel } from "../components/DatasetStatusPanel";
import { ResultPanel } from "../components/ResultPanel";
import { AirSidePanel } from "../components/AirSidePanel";
import { FluidSidePanel } from "../components/FluidSidePanel";
import { GeometryBottomBar } from "../components/GeometryBottomBar";
import { CircuitrySelector } from "../components/CircuitrySelector";
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
  const [machineImportOpen, setMachineImportOpen] = useState(false);

  const physCheck = validatePhysicalInputs(physical);
  const thermoCheck = validateThermoInputs(thermo);
  const inputsValid = physCheck.isValid && thermoCheck.isValid;
  const canSimulate = catalogs.ready && inputsValid && !isSimulating;
  const disabledReason = !catalogs.ready
    ? "Carregando catálogos…"
    : !inputsValid
      ? `Preencha: ${[...physCheck.errors, ...thermoCheck.errors].join(" • ")}`
      : undefined;

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

  // Auto-recalculo: sempre que os inputs mudarem e estiverem válidos, dispara
  // a simulação após um pequeno debounce. O usuário também pode forçar pelo
  // botão "Calcular" a qualquer momento.
  useEffect(() => {
    if (!catalogs.ready || !inputsValid || isSimulating) return;
    const t = setTimeout(() => {
      if (engineVersion === "v2") runV2();
      else run();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogs.ready, inputsValid, engineVersion, physical, thermo]);

  const handleGoalSeek = (targetKw: number) => {
    if (!Number.isFinite(targetKw) || targetKw <= 0) return;
    const physCheck = validatePhysicalInputs(physical);
    const thermoCheck = validateThermoInputs(thermo);
    if (!physCheck.isValid || !thermoCheck.isValid) {
      setWarnings([...physCheck.errors, ...thermoCheck.errors]);
      return;
    }
    const phys = physical as UnilabPhysicalInputs;
    const therm = thermo as UnilabThermoInputs;
    const tubeMat = catalogs.tubeMaterials.find((m) => m.id === phys.tubeMaterialId);
    if (!tubeMat) {
      toast.error("Material do tubo não encontrado.");
      return;
    }
    const geometry = catalogs.geometries.find((g) => g.id === phys.geometryId);

    // Busca binária em finnedLengthMm — apenas o comprimento aletado pode mudar.
    const runAt = (lengthMm: number) =>
      runSimulation({
        physical: { ...phys, finnedLengthMm: lengthMm },
        thermo: therm,
        catalogs: {
          correctionCoefficients: catalogs.correctionCoefficients,
          pressureDropFan: catalogs.pressureDropFan,
        },
        tubeMaterialConductivity: tubeMat.conductivityWmK,
        uBaseWm2K: geometry?.uBaseWm2K,
      });

    try {
      // Estima por proporcionalidade e refina por bisseção.
      const baseLen = phys.finnedLengthMm || 1000;
      const baseQ = result?.totalCapacityKw ?? runAt(baseLen).totalCapacityKw;
      let lo = 50;
      let hi = Math.max(baseLen * Math.max(targetKw / Math.max(baseQ, 1e-6), 1) * 2, baseLen * 2);
      // Garante bracket
      let loQ = runAt(lo).totalCapacityKw;
      let hiQ = runAt(hi).totalCapacityKw;
      let guard = 0;
      while (hiQ < targetKw && guard < 8) {
        hi *= 2;
        hiQ = runAt(hi).totalCapacityKw;
        guard++;
      }
      if (loQ > targetKw) {
        toast.warning(`Capacidade mínima (${loQ.toFixed(2)} kW) já excede a meta.`);
        return;
      }
      if (hiQ < targetKw) {
        toast.error(`Não foi possível atingir ${targetKw} kW alterando apenas o comprimento.`);
        return;
      }
      // Bisseção
      let mid = lo;
      let midQ = loQ;
      for (let i = 0; i < 24; i++) {
        mid = (lo + hi) / 2;
        midQ = runAt(mid).totalCapacityKw;
        if (Math.abs(midQ - targetKw) / targetKw < 0.005) break;
        if (midQ < targetKw) {
          lo = mid;
          loQ = midQ;
        } else {
          hi = mid;
          hiQ = midQ;
        }
      }
      const finalLen = Math.round(mid);
      // Atualiza store + roda final
      useUnilabSimulationStore.getState().setPhysicalInputs({ finnedLengthMm: finalLen });
      const finalRes = runAt(finalLen);
      useUnilabSimulationStore.getState().setResult(finalRes);
      useUnilabSimulationStore.getState().setWarnings(finalRes.warnings);
      toast.success(
        `Para atingir ${targetKw} kW, o Comprimento Aletado foi ajustado para ${finalLen} mm.`,
      );
    } catch (err) {
      const msg = err instanceof SimulationError ? err.errors.join("; ") : String(err);
      toast.error(`Goal Seek falhou: ${msg}`);
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
            onClick={() => setMachineImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600"
          >
            <Package className="h-4 w-4" />
            📥 Importar do Catálogo CN Cold
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
          disabledReason={disabledReason}
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
            <ResultPanel result={result} warnings={warnings} onGoalSeek={handleGoalSeek} />
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR — Geometria, full width */}
      <div className="mt-2 space-y-2">
        <GeometryBottomBar />
        <CircuitrySelector />
      </div>

      <CoilSchematicModal
        open={schematicOpen}
        onClose={() => setSchematicOpen(false)}
      />

      <MachineImportModal
        open={machineImportOpen}
        onClose={() => setMachineImportOpen(false)}
        componentType={componentType}
      />
    </PageContainer>
  );
}

