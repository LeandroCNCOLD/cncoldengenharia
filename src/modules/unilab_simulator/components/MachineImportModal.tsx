import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Check } from "lucide-react";
import { toast } from "sonner";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type { UnilabComponentType } from "../types/unilab.types";

interface MachineDefinition {
  id: string;
  name: string;
  type: UnilabComponentType;
  physical: {
    geometryId?: string;
    rows?: number;
    tubesPerRow?: number;
    finPitchMm?: number;
    finnedLengthMm?: number;
    numberOfCircuits?: number;
  };
  thermo: {
    fluid?: string;
    airFlowM3H?: number;
  };
  /** Modelo do compressor a buscar no compressors.json (match por substring no campo `model`). */
  compressorModel?: string;
}

// Mock provisório. Substituir por JSON real (machinesCatalog.json) no futuro.
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
      numberOfCircuits: 12,
    },
    thermo: {
      fluid: "REF_R404A",
      airFlowM3H: 13077,
    },
    compressorModel: "ZR22K3E-TFD",
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
      numberOfCircuits: 8,
    },
    thermo: {
      fluid: "REF_R404A",
      airFlowM3H: 8500,
    },
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
      numberOfCircuits: 14,
    },
    thermo: {
      fluid: "REF_R404A",
      airFlowM3H: 22000,
    },
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
  const setPhysicalInputs = useUnilabSimulationStore((s) => s.setPhysicalInputs);
  const setFluid = useUnilabSimulationStore((s) => s.setFluid);
  const setAirFlow = useUnilabSimulationStore((s) => s.setAirFlow);
  const setSelectedCompressor = useUnilabSimulationStore((s) => s.setSelectedCompressor);

  const [importing, setImporting] = useState<string | null>(null);
  const [machines, setMachines] = useState<MachineDefinition[]>([]);

  useEffect(() => {
    if (!open) return;
    // Filtra mock por tipo. Para condensadores aceita ambos os subtipos.
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
      // Parâmetros físicos
      setPhysicalInputs({
        ...m.physical,
        // numberOfCircuits → mapeia para o campo `circuits` do store quando aplicável
        ...(m.physical.numberOfCircuits != null
          ? { circuits: m.physical.numberOfCircuits }
          : {}),
      });
      // Termo
      if (m.thermo.fluid) setFluid(m.thermo.fluid);
      if (m.thermo.airFlowM3H != null) setAirFlow(m.thermo.airFlowM3H);

      // Compressor
      if (m.compressorModel) {
        const id = await resolveCompressorId(m.compressorModel);
        if (id) {
          setSelectedCompressor(id);
          toast.success(
            `Máquina "${m.name}" importada. Compressor ${m.compressorModel} acoplado.`,
          );
        } else {
          setSelectedCompressor(undefined);
          toast.warning(
            `Máquina "${m.name}" importada, mas o compressor ${m.compressorModel} não foi encontrado no catálogo.`,
          );
        }
      } else {
        setSelectedCompressor(undefined);
        toast.success(`Máquina "${m.name}" importada.`);
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
          Selecione uma máquina de linha para preencher automaticamente
          geometria, ventilador, fluido e compressor.
        </p>

        {machines.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Nenhuma máquina de linha disponível para este tipo de componente.
          </div>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {machines.map((m) => (
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
                    {m.thermo.fluid ? ` · ${m.thermo.fluid}` : ""}
                    {m.compressorModel ? ` · ${m.compressorModel}` : ""}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
                  <Check className="h-3 w-3" />
                  {importing === m.id ? "Importando…" : "Importar"}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
