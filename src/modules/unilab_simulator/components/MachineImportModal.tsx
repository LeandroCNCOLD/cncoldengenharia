import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Check } from "lucide-react";
import { toast } from "sonner";
import { useCnCoilsSimulationStore } from "../store/useUnilabSimulationStore";
import type { UnilabComponentType } from "../types/unilab.types";

/**
 * Definição completa de máquina importada de um catálogo (ex.: Samcode/CN Cold).
 * Quando uma máquina é importada, TODOS os campos disponíveis devem ser
 * propagados para o store (geometria, ventilação, fluido, condições de
 * contorno, capacidade alvo, compressor), tanto para evaporador quanto
 * condensador.
 */
interface MachineDefinition {
  id: string;
  name: string;
  type: UnilabComponentType;

  // Geometria física
  physical: {
    geometryId?: string;
    rows?: number;
    tubesPerRow?: number;
    finPitchMm?: number;
    finnedLengthMm?: number;
    finnedHeightMm?: number;
    numberOfCircuits?: number;
    tubeOuterDiameterMm?: number;
    tubeInnerDiameterMm?: number;
    tubePitchTransverseMm?: number;
    tubePitchLongitudinalMm?: number;
    finThicknessMm?: number;
  };

  // Lado Ar / Ventilação
  air: {
    airFlowM3H?: number;
    /** Temperatura de entrada do ar (bulbo seco) — câmara/ambiente */
    tempInDB_C?: number;
    /** Umidade relativa de entrada do ar (%) */
    rhIn_pct?: number;
    fanCount?: number;
    fanRole?: "blower" | "exhaust";
  };

  // Lado Fluido / Refrigerante
  fluid: {
    /** ID do refrigerante (ex.: REF_R404A) */
    refrigerantId?: string;
    /** Temperatura de evaporação (°C) — para evaporadores */
    evaporatingTempC?: number;
    /** Temperatura de condensação (°C) — para condensadores */
    condensingTempC?: number;
    superheatK?: number;
    subcoolingK?: number;
    /** Sobreaquecimento de descarga (gás quente) — condensadores */
    dischargeSuperheatK?: number;
    fluidMassFlowKgH?: number;
  };

  /** Capacidade nominal (W) — usada como alvo no modo Desenho. */
  capacityW?: number;

  /** Modelo do compressor a buscar no compressors.json. */
  compressorModel?: string;
  compressorCount?: number;
}

// Mock provisório. Substituir por JSON real (machinesCatalog.json) no futuro.
// Cada máquina deve trazer TODAS as informações possíveis do catálogo
// original (Samcode), não apenas geometria.
const MOCK_MACHINES: MachineDefinition[] = [
  {
    id: "CN-EVAP-1200-LT",
    name: "Evaporador CN 1200 LT",
    type: "evaporator_dx",
    physical: {
      geometryId: "GEOM_DX_133228_C_S",
      rows: 4,
      tubesPerRow: 24,
      finPitchMm: 7.0,
      finnedLengthMm: 1250,
      finnedHeightMm: 600,
      numberOfCircuits: 12,
    },
    air: {
      airFlowM3H: 13077,
      tempInDB_C: -23,
      rhIn_pct: 90,
      fanCount: 2,
      fanRole: "blower",
    },
    fluid: {
      refrigerantId: "REF_R404A",
      evaporatingTempC: -31,
      superheatK: 5,
      subcoolingK: 0,
    },
    capacityW: 12500,
    compressorModel: "ZR22K3E-TFD",
    compressorCount: 1,
  },
  {
    id: "CN-EVAP-800-MT",
    name: "Evaporador CN 800 MT",
    type: "evaporator_dx",
    physical: {
      rows: 3,
      tubesPerRow: 20,
      finPitchMm: 5.0,
      finnedLengthMm: 1000,
      finnedHeightMm: 500,
      numberOfCircuits: 8,
    },
    air: {
      airFlowM3H: 8500,
      tempInDB_C: 0,
      rhIn_pct: 85,
      fanCount: 2,
      fanRole: "blower",
    },
    fluid: {
      refrigerantId: "REF_R404A",
      evaporatingTempC: -8,
      superheatK: 5,
      subcoolingK: 0,
    },
    capacityW: 8200,
    compressorCount: 1,
  },
  {
    id: "CN-COND-500",
    name: "Condensador CN 500",
    type: "condenser_air",
    physical: {
      rows: 2,
      tubesPerRow: 28,
      finPitchMm: 2.1,
      finnedLengthMm: 1600,
      finnedHeightMm: 700,
      numberOfCircuits: 14,
    },
    air: {
      airFlowM3H: 22000,
      tempInDB_C: 35,
      rhIn_pct: 50,
      fanCount: 2,
      fanRole: "exhaust",
    },
    fluid: {
      refrigerantId: "REF_R404A",
      condensingTempC: 50,
      subcoolingK: 3,
      dischargeSuperheatK: 30,
    },
    capacityW: 35000,
    compressorCount: 1,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  componentType: UnilabComponentType;
}

/** Resolve um modelo de compressor para o ID presente no compressors.json. */
async function resolveCompressorId(model: string): Promise<string | undefined> {
  try {
    const res = await fetch("/data/catalogs/compressors.json", { cache: "no-cache" });
    if (!res.ok) return undefined;
    const list = (await res.json()) as Array<Record<string, unknown>>;
    const target = model.trim().toLowerCase();
    const hit = list.find((c) => {
      const m = String(c.model ?? "").toLowerCase();
      return m === target || m.includes(target);
    });
    return hit ? String(hit.id ?? hit.model) : undefined;
  } catch {
    return undefined;
  }
}

export function MachineImportModal({ open, onClose, componentType }: Props) {
  const setPhysicalInputs = useCnCoilsSimulationStore((s) => s.setPhysicalInputs);
  const setFluid = useCnCoilsSimulationStore((s) => s.setFluid);
  const setAirFlow = useCnCoilsSimulationStore((s) => s.setAirFlow);
  const setTempInDB = useCnCoilsSimulationStore((s) => s.setTempInDB);
  const setRhIn = useCnCoilsSimulationStore((s) => s.setRhIn);
  const setFanCount = useCnCoilsSimulationStore((s) => s.setFanCount);
  const setFanRole = useCnCoilsSimulationStore((s) => s.setFanRole);
  const setFluidOperatingTemp = useCnCoilsSimulationStore((s) => s.setFluidOperatingTemp);
  const setPairedTempC = useCnCoilsSimulationStore((s) => s.setPairedTempC);
  const setSuperheat = useCnCoilsSimulationStore((s) => s.setSuperheat);
  const setSubcooling = useCnCoilsSimulationStore((s) => s.setSubcooling);
  const setDischargeSuperheatK = useCnCoilsSimulationStore((s) => s.setDischargeSuperheatK);
  const setFluidMassFlow = useCnCoilsSimulationStore((s) => s.setFluidMassFlow);
  const setTargetCapacityW = useCnCoilsSimulationStore((s) => s.setTargetCapacityW);
  const setSelectedCompressor = useCnCoilsSimulationStore((s) => s.setSelectedCompressor);
  const setCompressorCount = useCnCoilsSimulationStore((s) => s.setCompressorCount);

  const [importing, setImporting] = useState<string | null>(null);
  const [machines, setMachines] = useState<MachineDefinition[]>([]);

  useEffect(() => {
    if (!open) return;
    const filtered = MOCK_MACHINES.filter((m) => {
      if (
        componentType === "condenser_air" ||
        componentType === "condenser_shell_tube"
      ) {
        return m.type === "condenser_air" || m.type === "condenser_shell_tube";
      }
      return m.type === componentType;
    });
    setMachines(filtered);
  }, [open, componentType]);

  const handleImport = async (m: MachineDefinition) => {
    setImporting(m.id);
    try {
      const isCondenser =
        m.type === "condenser_air" || m.type === "condenser_shell_tube";

      // 1) Geometria física (todos os campos disponíveis)
      setPhysicalInputs({
        ...m.physical,
        ...(m.physical.numberOfCircuits != null
          ? { circuits: m.physical.numberOfCircuits }
          : {}),
      });

      // 2) Lado Ar / Ventilação
      if (m.air.airFlowM3H != null) setAirFlow(m.air.airFlowM3H);
      if (m.air.tempInDB_C != null) setTempInDB(m.air.tempInDB_C);
      if (m.air.rhIn_pct != null) setRhIn(m.air.rhIn_pct);
      if (m.air.fanCount != null) setFanCount(m.air.fanCount);
      if (m.air.fanRole) setFanRole(m.air.fanRole);

      // 3) Lado Fluido / Refrigerante
      if (m.fluid.refrigerantId) setFluid(m.fluid.refrigerantId);

      if (isCondenser) {
        // Condensador: temperatura de operação = Tc; pareada = Te
        if (m.fluid.condensingTempC != null)
          setFluidOperatingTemp(m.fluid.condensingTempC);
        if (m.fluid.evaporatingTempC != null)
          setPairedTempC(m.fluid.evaporatingTempC);
        if (m.fluid.dischargeSuperheatK != null)
          setDischargeSuperheatK(m.fluid.dischargeSuperheatK);
      } else {
        // Evaporador: temperatura de operação = Te; pareada = Tc
        if (m.fluid.evaporatingTempC != null)
          setFluidOperatingTemp(m.fluid.evaporatingTempC);
        if (m.fluid.condensingTempC != null)
          setPairedTempC(m.fluid.condensingTempC);
      }
      if (m.fluid.superheatK != null) setSuperheat(m.fluid.superheatK);
      if (m.fluid.subcoolingK != null) setSubcooling(m.fluid.subcoolingK);
      if (m.fluid.fluidMassFlowKgH != null)
        setFluidMassFlow(m.fluid.fluidMassFlowKgH);

      // 4) Capacidade nominal → alvo do modo Desenho
      if (m.capacityW != null) setTargetCapacityW(m.capacityW);

      // 5) Compressor
      if (m.compressorModel) {
        const id = await resolveCompressorId(m.compressorModel);
        if (id) {
          setSelectedCompressor(id);
          if (m.compressorCount) setCompressorCount(m.compressorCount);
          toast.success(
            `Máquina "${m.name}" importada (geometria + ventilação + fluido + compressor ${m.compressorModel}).`,
          );
        } else {
          setSelectedCompressor(undefined);
          toast.warning(
            `Máquina "${m.name}" importada, mas o compressor ${m.compressorModel} não foi encontrado no catálogo.`,
          );
        }
      } else {
        setSelectedCompressor(undefined);
        if (m.compressorCount) setCompressorCount(m.compressorCount);
        toast.success(
          `Máquina "${m.name}" importada (geometria + ventilação + fluido + condições de contorno).`,
        );
      }
      onClose();
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            Importar Máquina do Catálogo CN Cold
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-slate-500">
          Selecione uma máquina de linha. A importação preenche
          automaticamente <strong>todos</strong> os dados disponíveis no
          catálogo: geometria, ventilação (vazão, T entrada, UR, ventiladores),
          fluido refrigerante (Te/Tc, sobreaquecimento, subresfriamento),
          capacidade nominal e compressor.
        </p>

        {machines.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Nenhuma máquina de linha disponível para este tipo de componente.
          </div>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {machines.map((m) => {
              const isCond =
                m.type === "condenser_air" || m.type === "condenser_shell_tube";
              const opTemp = isCond
                ? m.fluid.condensingTempC
                : m.fluid.evaporatingTempC;
              const opTempLabel = isCond ? "Tc" : "Te";
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={importing === m.id}
                  onClick={() => handleImport(m)}
                  className="flex w-full items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">
                      {m.name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-500">
                      <span className="font-mono">{m.id}</span>
                      {m.physical.rows ? ` · ${m.physical.rows} fileiras` : ""}
                      {m.fluid.refrigerantId
                        ? ` · ${m.fluid.refrigerantId.replace("REF_", "")}`
                        : ""}
                      {opTemp != null ? ` · ${opTempLabel}=${opTemp}°C` : ""}
                      {m.air.airFlowM3H
                        ? ` · ${m.air.airFlowM3H.toLocaleString("pt-BR")} m³/h`
                        : ""}
                      {m.capacityW
                        ? ` · ${(m.capacityW / 1000).toFixed(1)} kW`
                        : ""}
                      {m.compressorModel ? ` · ${m.compressorModel}` : ""}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
                    <Check className="h-3 w-3" />
                    {importing === m.id ? "Importando…" : "Importar"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
