import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GeometryCombobox } from "./GeometryCombobox";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import {
  loadCoilGeometries,
  type CoilGeometryItem,
} from "../services/coilGeometryCatalogService";
import { loadSecurityFactorMap } from "../services/securityFactorCatalog";
import { tipoSerpentinaForComponent } from "../config/coilTypeFilter";
import type { UnilabComponentType } from "../types/unilab.types";

interface Props {
  open: boolean;
  onClose: () => void;
  componentType?: UnilabComponentType;
}

export function GeometryPickerModal({ open, onClose, componentType }: Props) {
  const selectedId = useUnilabSimulationStore(
    (s) => s.selectedGeometry?.id ?? s.physicalInputs.geometryId,
  );
  const setSelectedGeometry = useUnilabSimulationStore(
    (s) => s.setSelectedGeometry,
  );
  const setErrorFactorPercent = useUnilabSimulationStore(
    (s) => s.setErrorFactorPercent,
  );

  const [geometries, setGeometries] = useState<CoilGeometryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forcedTipo = componentType ? tipoSerpentinaForComponent(componentType) : undefined;

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
        {forcedTipo && (
          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
            Mostrando apenas geometrias para <b>{forcedTipo}</b>.
          </div>
        )}
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
              forcedTipo={forcedTipo}
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
