import { ArrowRight, ArrowRightLeft, ArrowDownUp, Info, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import { suggestOptimalCircuits } from "../engine/circuitOptimizer";
import type { HeaderPosition } from "../types/unilab.types";

const POSITIONS: Array<{
  id: HeaderPosition;
  label: string;
  desc: string;
  icon: JSX.Element;
}> = [
  {
    id: "LL",
    label: "Esq / Esq",
    desc: "Distribuidor e Coletor à Esquerda",
    icon: <ArrowDownUp className="h-4 w-4" />,
  },
  {
    id: "LR",
    label: "Esq / Dir",
    desc: "Entra Esq, Sai Dir",
    icon: <ArrowRight className="h-4 w-4" />,
  },
  {
    id: "RR",
    label: "Dir / Dir",
    desc: "Distribuidor e Coletor à Direita",
    icon: <ArrowRightLeft className="h-4 w-4" />,
  },
];

export function CircuitrySelector() {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const setPhysical = useUnilabSimulationStore((s) => s.setPhysicalInputs);
  const fluid = useUnilabSimulationStore((s) => s.fluid);
  const fluidMassFlowKgH = useUnilabSimulationStore(
    (s) => s.fluidMassFlow_kg_h,
  );

  const tubesPerRow =
    physical.finnedHeightMm && physical.tubePitchTransverseMm
      ? Math.max(
          1,
          Math.round(
            physical.finnedHeightMm / physical.tubePitchTransverseMm,
          ),
        )
      : 0;
  const totalTubes = tubesPerRow * (physical.rows ?? 0);

  const handleSuggest = () => {
    const massFlowKgS = (fluidMassFlowKgH || 0) / 3600;
    // Diâmetro interno: usa o do store; senão deriva de OD - 2*espessura aleta
    // (fallback grosseiro quando o catálogo não traz ID); senão 8.92 mm.
    const internalDiamM =
      (physical.tubeInnerDiameterMm && physical.tubeInnerDiameterMm / 1000) ||
      (physical.tubeOuterDiameterMm
        ? (physical.tubeOuterDiameterMm -
            2 * (physical.finThicknessMm ?? 0.3)) /
          1000
        : 0.00892);

    const suggestion = suggestOptimalCircuits(
      totalTubes,
      massFlowKgS,
      internalDiamM,
      fluid || "R404A",
    );

    setPhysical({ circuits: suggestion.optimalCircuits });

    const msg = `Sugestão: ${suggestion.optimalCircuits} circuitos · ${Math.round(suggestion.massVelocity)} kg/m²·s — ${suggestion.reason}`;
    if (suggestion.status === "optimal") toast.success(msg);
    else if (suggestion.status === "acceptable") toast(msg);
    else toast.warning(msg);
  };

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-300 bg-[#1E6FD9] px-3 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-white">
        Circuitagem Inteligente
      </div>

      <div className="space-y-2 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-700">
            Otimizar nº de circuitos
          </span>
          <button
            type="button"
            onClick={handleSuggest}
            className="inline-flex items-center gap-1.5 rounded border border-[#1E6FD9] bg-white px-2 py-1 text-[11px] font-medium text-[#1E6FD9] hover:bg-blue-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Sugerir Nº de Circuitos
          </button>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-medium text-slate-700">
            Posição dos Coletores
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {POSITIONS.map((pos) => {
              const active = physical.headerPosition === pos.id;
              return (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setPhysical({ headerPosition: pos.id })}
                  title={pos.desc}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded border p-2 text-[10px] transition-colors ${
                    active
                      ? "border-[#1E6FD9] bg-blue-50 text-[#1E6FD9]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {pos.icon}
                  <span>{pos.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-tight text-amber-800">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Esq/Esq ou Dir/Dir (mesmo lado) é o padrão mais comum em câmaras
            frias. A sugestão otimiza a velocidade de massa do fluido.
          </span>
        </div>
      </div>
    </div>
  );
}
