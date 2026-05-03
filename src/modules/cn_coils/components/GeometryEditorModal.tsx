// Modal de edição/criação de geometrias customizadas (CN Coils).
// Permite editar tubo, aleta, distribuidor e identificação.
// Salvo em Lovable Cloud (tabela coil_geometry_overrides).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  emptyEditable,
  geometryToEditable,
  createGeometry,
  updateGeometry,
  type GeometryEditableFields,
} from "../services/coilGeometryOverridesService";
import {
  TIPO_SERPENTINA_VALUES,
  type CoilGeometryItem,
  type TipoSerpentina,
} from "../services/coilGeometryCatalogService";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Geometria base para edição/duplicação. Null = criar nova do zero. */
  baseGeometry: CoilGeometryItem | null;
  /** Modo: editar (override do base) ou duplicar (cria nova sem base_id). */
  mode: "edit" | "duplicate" | "create";
  /** Linha de override existente (se já houver edição prévia). */
  existingOverrideId?: string | null;
  onSaved: () => void;
}

type NumKey =
  | "diametro_externo_tubo_mm"
  | "diametro_interno_tubo_mm"
  | "espessura_tubo_mm"
  | "passo_tubos_mm"
  | "passo_fileiras_mm"
  | "espessura_aleta_mm"
  | "fator_correcao_aleta"
  | "fator_atrito_ar"
  | "razao_superficies_internas"
  | "defaultCircuits"
  | "defaultRows"
  | "uBaseWm2K";

export function GeometryEditorModal({
  open,
  onClose,
  baseGeometry,
  mode,
  existingOverrideId,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [fields, setFields] = useState<GeometryEditableFields>(emptyEditable);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (baseGeometry) {
      const f = geometryToEditable(baseGeometry);
      if (mode === "duplicate") {
        f.codigo = `${f.codigo}-COPY`;
        f.descricao = `${f.descricao} (cópia)`;
        f.name = `${f.name} (cópia)`;
      }
      setFields(f);
    } else {
      setFields(emptyEditable());
    }
  }, [open, baseGeometry, mode]);

  const setNum = (key: NumKey, v: string) => {
    const n = v.trim() === "" ? null : Number(v);
    setFields((f) => ({ ...f, [key]: Number.isFinite(n as number) ? n : null }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    if (!fields.codigo.trim() || !fields.descricao.trim()) {
      toast.error("Código e descrição são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && existingOverrideId) {
        await updateGeometry(existingOverrideId, fields);
      } else if (mode === "edit" && baseGeometry) {
        // Primeiro override desta geometria base
        await createGeometry(fields, user.id, baseGeometry.id);
      } else if (mode === "duplicate") {
        await createGeometry(fields, user.id, null);
      } else {
        await createGeometry(fields, user.id, null);
      }
      toast.success("Geometria salva.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "create"
      ? "Cadastrar Nova Geometria"
      : mode === "duplicate"
        ? "Duplicar Geometria"
        : "Editar Geometria";

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Identificação">
            <Field label="Código">
              <Input
                value={fields.codigo}
                onChange={(e) => setFields((f) => ({ ...f, codigo: e.target.value }))}
              />
            </Field>
            <Field label="Descrição">
              <Input
                value={fields.descricao}
                onChange={(e) => setFields((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Field>
            <Field label="Nome">
              <Input
                value={fields.name}
                onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Tipo de serpentina">
              <Select
                value={fields.tipo_serpentina ?? ""}
                onValueChange={(v) =>
                  setFields((f) => ({ ...f, tipo_serpentina: v as TipoSerpentina }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_SERPENTINA_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Tubo">
            <NumField label="Ø externo (mm)" k="diametro_externo_tubo_mm" v={fields.diametro_externo_tubo_mm} setNum={setNum} />
            <NumField label="Ø interno (mm)" k="diametro_interno_tubo_mm" v={fields.diametro_interno_tubo_mm} setNum={setNum} />
            <NumField label="Espessura (mm)" k="espessura_tubo_mm" v={fields.espessura_tubo_mm} setNum={setNum} />
            <NumField label="Passo de tubos (mm)" k="passo_tubos_mm" v={fields.passo_tubos_mm} setNum={setNum} />
            <NumField label="Passo de fileiras (mm)" k="passo_fileiras_mm" v={fields.passo_fileiras_mm} setNum={setNum} />
          </Section>

          <Section title="Aleta">
            <NumField label="Espessura (mm)" k="espessura_aleta_mm" v={fields.espessura_aleta_mm} setNum={setNum} />
            <Field label="Forma">
              <Input
                value={fields.forma_aleta ?? ""}
                onChange={(e) => setFields((f) => ({ ...f, forma_aleta: e.target.value || null }))}
                placeholder="Lisa / Ondulada / Persianada"
              />
            </Field>
            <NumField label="Fator de correção" k="fator_correcao_aleta" v={fields.fator_correcao_aleta} setNum={setNum} />
            <NumField label="Fator de atrito (ar)" k="fator_atrito_ar" v={fields.fator_atrito_ar} setNum={setNum} />
            <NumField label="Razão superfícies internas" k="razao_superficies_internas" v={fields.razao_superficies_internas} setNum={setNum} />
          </Section>

          <Section title="Distribuidor / Geometria">
            <NumField label="Circuitos (default)" k="defaultCircuits" v={fields.defaultCircuits} setNum={setNum} />
            <NumField label="Fileiras (default)" k="defaultRows" v={fields.defaultRows} setNum={setNum} />
            <NumField label="U base (W/m²K)" k="uBaseWm2K" v={fields.uBaseWm2K} setNum={setNum} />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function NumField({
  label,
  k,
  v,
  setNum,
}: {
  label: string;
  k: NumKey;
  v: number | null;
  setNum: (k: NumKey, v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        step="any"
        value={v ?? ""}
        onChange={(e) => setNum(k, e.target.value)}
      />
    </Field>
  );
}
