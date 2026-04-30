/**
 * Aba Válvula — seleciona uma válvula da Biblioteca Técnica.
 * Cálculo de dimensionamento avançado fica como próximo passo (drawer).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { LibraryComponentPicker } from "@/components/coldpro/library-component-picker";
import { PendingFeatureDrawer } from "@/components/coldpro/pending-feature-drawer";
import {
  addEquipmentComponentLink,
  listEquipmentComponentLinks,
  removeEquipmentComponentLink,
} from "@/lib/coldpro/equipment-component-links";
import type { TechnicalEntityType } from "@/modules/coldpro/library/types";

interface Props {
  equipmentProjectId: string;
}

const VALVE_TYPES: Array<{ value: TechnicalEntityType; label: string }> = [
  { value: "expansion_valve", label: "Expansão (TXV / EEV)" },
  { value: "solenoid_valve", label: "Solenoide" },
  { value: "hot_gas_valve", label: "Hot Gas" },
];

export function ValveTab({ equipmentProjectId }: Props) {
  const qc = useQueryClient();
  const [valveType, setValveType] = useState<TechnicalEntityType>("expansion_valve");

  const {
    data: links,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["equip-component-links", equipmentProjectId],
    queryFn: () => listEquipmentComponentLinks(equipmentProjectId),
  });

  const valveLink = useMemo(() => links?.find((l) => l.role === "valve"), [links]);

  const linkMut = useMutation({
    mutationFn: (id: string) =>
      addEquipmentComponentLink({
        equipmentProjectId,
        technicalComponentId: id,
        role: "valve",
      }),
    onSuccess: () => {
      toast.success("Válvula vinculada");
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: removeEquipmentComponentLink,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const c = valveLink?.component;
  const norm = (c?.normalized_json ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Válvula selecionada</span>
            {!c ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select
                  value={valveType}
                  onValueChange={(v) => setValveType(v as TechnicalEntityType)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALVE_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LibraryComponentPicker
                  entityTypes={[valveType]}
                  onSelect={(comp) => linkMut.mutate(comp.id)}
                  triggerLabel="Selecionar"
                  title={`Válvulas (${valveType}) da Biblioteca Técnica`}
                />
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => removeMut.mutate(valveLink.id)}>
                <Trash2 className="mr-1 h-4 w-4" /> Trocar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando vínculo…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar vínculo: {(error as Error).message}
            </p>
          ) : !c ? (
            <p className="text-sm text-muted-foreground">
              Selecione o tipo de válvula e escolha um modelo da Biblioteca Técnica.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Fabricante / Modelo">
                {c.manufacturer ?? "—"} · {c.model ?? c.code ?? "—"}
              </Info>
              <Info label="Tipo">
                <Badge variant="outline">{c.entity_type}</Badge>
              </Info>
              <Info label="Origem">
                <Badge variant="secondary">{c.source ?? "—"}</Badge>{" "}
                <Badge variant="outline">{c.context}</Badge>
              </Info>
              <Info label="Refrigerantes compatíveis">
                {c.compatible_refrigerants_json?.join(", ") || "—"}
              </Info>
              <Info label="Capacidade nominal">
                {(norm["nominal_capacity_w"] as number | undefined)
                  ? `${norm["nominal_capacity_w"]} W`
                  : "—"}
              </Info>
              <Info label="Faixa de Tevap">
                {(norm["te_min_c"] as number | undefined) != null
                  ? `${norm["te_min_c"]} a ${norm["te_max_c"] ?? "?"} °C`
                  : "—"}
              </Info>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <PendingFeatureDrawer
          triggerLabel="Dimensionar válvula"
          title="Dimensionamento de válvula de expansão"
          description="Calcular orifício/Kv ideal para a carga térmica e refrigerante selecionados."
          nextSteps={[
            "Implementar thermalcalc/engines/system/expansionDeviceEngine (sizing) — hoje só roda em modo verify.",
            "Aceitar entrada: capacidade, ΔP, refrigerante, sub-resfriamento.",
            "Cruzar Kv calculado com catálogo e sugerir modelo.",
          ]}
        />
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
