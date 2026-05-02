import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type { CoilGeometryItem } from "../services/coilGeometryCatalogService";

/**
 * Modais informativos (read-only) para Tubo / Aleta / Distribuidor.
 *
 * Os valores exibidos são derivados da Geometria selecionada e não podem ser
 * editados aqui. Para alterar, o usuário deve trocar a geometria no modal de
 * Geometria.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

function ReadField({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
}) {
  const display =
    value === undefined || value === null || value === ""
      ? "—"
      : typeof value === "number"
        ? Number.isFinite(value)
          ? value.toString()
          : "—"
        : value;
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={display}
          readOnly
          className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-right font-mono text-xs text-slate-800"
        />
        {unit ? (
          <span className="w-10 text-[10px] text-slate-500">{unit}</span>
        ) : null}
      </div>
    </label>
  );
}

function NoGeometryHint() {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      Nenhuma geometria selecionada. Abra o modal de <strong>Geometria</strong>{" "}
      para escolher uma; estes valores serão preenchidos automaticamente.
    </div>
  );
}

export function TubeModal({ open, onClose }: ModalProps) {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const selected = useUnilabSimulationStore((s) => s.selectedGeometry) as CoilGeometryItem | undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tubo (derivado da Geometria)</DialogTitle>
        </DialogHeader>
        {!selected && !physical.tubeOuterDiameterMm ? (
          <NoGeometryHint />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <ReadField
              label="Ø externo"
              value={physical.tubeOuterDiameterMm}
              unit="mm"
            />
            <ReadField
              label="Ø interno"
              value={physical.tubeInnerDiameterMm}
              unit="mm"
            />
            <ReadField
              label="Passo transversal"
              value={physical.tubePitchTransverseMm}
              unit="mm"
            />
            <ReadField
              label="Passo longitudinal"
              value={physical.tubePitchLongitudinalMm}
              unit="mm"
            />
            <ReadField
              label="Espessura"
              value={selected?.espessura_tubo_mm}
              unit="mm"
            />
            <ReadField
              label="Tipo de bateria"
              value={selected?.tipo_bateria}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FinModal({ open, onClose }: ModalProps) {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const selected = useUnilabSimulationStore((s) => s.selectedGeometry) as CoilGeometryItem | undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aleta (derivado da Geometria)</DialogTitle>
        </DialogHeader>
        {!selected && !physical.finThicknessMm ? (
          <NoGeometryHint />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <ReadField
              label="Passo da aleta"
              value={physical.finPitchMm}
              unit="mm"
            />
            <ReadField
              label="Espessura"
              value={physical.finThicknessMm}
              unit="mm"
            />
            <ReadField label="Forma" value={selected?.forma_aleta} />
            <ReadField
              label="Fator de correção"
              value={selected?.fator_correcao_aleta}
            />
            <ReadField
              label="Fator de atrito (ar)"
              value={selected?.fator_atrito_ar}
            />
            <ReadField
              label="Razão sup. internas"
              value={selected?.razao_superficies_internas}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DistributorModal({ open, onClose }: ModalProps) {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const selected = useUnilabSimulationStore((s) => s.selectedGeometry) as CoilGeometryItem | undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribuidor / Circuito</DialogTitle>
        </DialogHeader>
        {!selected && !physical.circuits ? (
          <NoGeometryHint />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <ReadField label="Nº de circuitos" value={physical.circuits} />
            <ReadField label="Nº de filas" value={physical.rows} />
            <ReadField
              label="Comprimento aletado"
              value={physical.finnedLengthMm}
              unit="mm"
            />
            <ReadField
              label="Altura aletada"
              value={physical.finnedHeightMm}
              unit="mm"
            />
            <ReadField
              label="Tubo liso?"
              value={
                selected?.tubo_liso === null || selected?.tubo_liso === undefined
                  ? null
                  : selected.tubo_liso
                    ? "Sim"
                    : "Não"
              }
            />
            <ReadField label="Código" value={selected?.codigo} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
