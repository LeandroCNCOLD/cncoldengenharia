import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GeometryCombobox } from "./GeometryCombobox";
import { GeometryEditorModal } from "./GeometryEditorModal";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import {
  loadCoilGeometries,
  type CoilGeometryItem,
} from "../services/coilGeometryCatalogService";
import {
  loadGeometryOverrides,
  mergeWithOverrides,
  deleteGeometryOverride,
  tombstoneBaseGeometry,
  type GeometryOverrideRow,
} from "../services/coilGeometryOverridesService";
import { loadSecurityFactorMap } from "../services/securityFactorCatalog";
import { tipoSerpentinaForComponent } from "../config/coilTypeFilter";
import { useAuth } from "@/lib/auth";
import type { UnilabComponentType } from "../types/unilab.types";

interface Props {
  open: boolean;
  onClose: () => void;
  componentType?: UnilabComponentType;
}

export function GeometryPickerModal({ open, onClose, componentType }: Props) {
  const { user, isAdmin } = useAuth();
  const selectedId = useUnilabSimulationStore(
    (s) => s.selectedGeometry?.id ?? s.physicalInputs.geometryId,
  );
  const setSelectedGeometry = useUnilabSimulationStore((s) => s.setSelectedGeometry);
  const setErrorFactorPercent = useUnilabSimulationStore((s) => s.setErrorFactorPercent);

  const [base, setBase] = useState<CoilGeometryItem[]>([]);
  const [overrides, setOverrides] = useState<GeometryOverrideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "duplicate" | "create">("create");
  const [editorBase, setEditorBase] = useState<CoilGeometryItem | null>(null);
  const [editorOverrideId, setEditorOverrideId] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const forcedTipo = componentType ? tipoSerpentinaForComponent(componentType) : undefined;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, o] = await Promise.all([loadCoilGeometries(), loadGeometryOverrides()]);
      setBase(b);
      setOverrides(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const geometries = mergeWithOverrides(base, overrides);
  const selected = geometries.find((g) => g.id === selectedId);

  // Identifica override existente para a seleção atual.
  const overrideForSelected =
    selected && selected.id.startsWith("custom:")
      ? overrides.find((o) => `custom:${o.id}` === selected.id) ?? null
      : selected
        ? [...overrides]
            .filter((o) => !o.deleted && o.base_id === selected.id)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
        : null;

  const isCustom = selected?.id.startsWith("custom:") ?? false;

  const openEditor = (mode: "edit" | "duplicate" | "create") => {
    setEditorMode(mode);
    if (mode === "create") {
      setEditorBase(null);
      setEditorOverrideId(null);
    } else {
      setEditorBase(selected ?? null);
      setEditorOverrideId(mode === "edit" ? overrideForSelected?.id ?? null : null);
    }
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!selected || !user?.id) return;
    try {
      if (isCustom && overrideForSelected) {
        await deleteGeometryOverride(overrideForSelected.id);
      } else if (overrideForSelected) {
        // Override existente do base → marcar como tombstone (substitui)
        await deleteGeometryOverride(overrideForSelected.id);
        await tombstoneBaseGeometry(selected.id, selected, user.id);
      } else {
        await tombstoneBaseGeometry(selected.id, selected, user.id);
      }
      toast.success("Geometria excluída.");
      setSelectedGeometry(undefined);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <>
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
                  if (g) {
                    loadSecurityFactorMap().then((map) => {
                      const sf = map.get(g.codigo) ?? map.get(g.id);
                      if (sf !== undefined && Number.isFinite(sf)) {
                        setErrorFactorPercent((sf - 1) * 100);
                      } else {
                        setErrorFactorPercent(0);
                      }
                    });
                  }
                }}
              />

              {selected && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  {selected.tipo_serpentina && (
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                      {selected.tipo_serpentina}
                    </span>
                  )}
                  {selected.forma_aleta && (
                    <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-800">
                      Aleta: {selected.forma_aleta}
                    </span>
                  )}
                  {selected.fator_correcao_aleta != null && (
                    <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                      Fat. Correção Aleta: {selected.fator_correcao_aleta.toFixed(4)}
                    </span>
                  )}
                  {selected.fator_atrito_ar != null && (
                    <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                      Fat. Atrito Ar: {selected.fator_atrito_ar.toFixed(4)}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditor("edit")}
                  disabled={!selected}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditor("duplicate")}
                  disabled={!selected}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Duplicar
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditor("create")}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Nova
                </Button>
                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={!selected || !isAdmin}
                    title={!isAdmin ? "Somente administradores podem excluir" : undefined}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>

              {!isAdmin && (
                <p className="text-[10px] text-slate-400">
                  Exclusão permitida apenas para usuários administradores.
                </p>
              )}

              <p className="text-[11px] text-slate-500">
                Ao escolher uma geometria, os parâmetros de tubo, aleta e
                distribuição são preenchidos automaticamente. Use “Editar” para
                ajustar parâmetros ou “Nova” para cadastrar uma geometria
                customizada.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <GeometryEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        baseGeometry={editorBase}
        mode={editorMode}
        existingOverrideId={editorOverrideId}
        onSaved={() => void refresh()}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir geometria?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected ? (
                <>
                  A geometria <b>{selected.codigo}</b> será removida da lista.
                  {!isCustom && " (Geometria do catálogo será ocultada)."}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
