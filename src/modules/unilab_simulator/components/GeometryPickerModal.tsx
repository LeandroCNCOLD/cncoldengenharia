import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GeometryCombobox } from "./GeometryCombobox";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import {
  loadCoilGeometries,
  type CoilGeometryItem,
} from "../services/coilGeometryCatalogService";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de seleção de Geometria.
 *
 * Ao confirmar uma geometria, o store já faz o auto-fill de:
 *  - dimensões de tubo (Ø externo/interno, espessura)
 *  - passos transversal/longitudinal
 *  - espessura/forma de aleta
 *  - rows / circuits default
 *
 * Esses campos ficam então em modo read-only nos outros modais (Tubo / Aleta /
 * Distribuidor), refletindo exatamente a geometria escolhida.
 */
export function GeometryPickerModal({ open, onClose }: Props) {
  const selectedId = useUnilabSimulationStore(
    (s) => s.selectedGeometry?.id ?? s.physicalInputs.geometryId,
  );
  const setSelectedGeometry = useUnilabSimulationStore(
    (s) => s.setSelectedGeometry,
  );

  const [geometries, setGeometries] = useState<CoilGeometryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadCoilGeometries()
      .then((items) => {
        if (!cancelled) setGeometries(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Geometria</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        ) : loading ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Carregando catálogo de geometrias…
          </div>
        ) : (
          <>
            <GeometryCombobox
              geometries={geometries}
              selectedId={selectedId}
              onChange={(g) => {
                setSelectedGeometry(g);
                if (g) onClose();
              }}
            />
            <p className="text-[11px] text-slate-500">
              Ao escolher uma geometria, os parâmetros de tubo, aleta e
              distribuição são preenchidos automaticamente e ficam bloqueados.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
