/**
 * Aba Ventiladores — vincula ventiladores ao evaporador e condensador.
 * Mostra dados técnicos da Biblioteca; ponto de operação fica como pendente.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { LibraryComponentPicker } from "@/components/coldpro/library-component-picker";
import { PendingFeatureDrawer } from "@/components/coldpro/pending-feature-drawer";
import {
  addEquipmentComponentLink,
  listEquipmentComponentLinks,
  removeEquipmentComponentLink,
  type EquipmentComponentLinkExpanded,
  type EquipmentComponentRole,
} from "@/lib/coldpro/equipment-component-links";
import { resolveFanComponent } from "@/modules/coldpro/biblioteca/technicalComponentResolver";

interface Props {
  equipmentProjectId: string;
}

export function FansTab({ equipmentProjectId }: Props) {
  const qc = useQueryClient();
  const {
    data: links,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["equip-component-links", equipmentProjectId],
    queryFn: () => listEquipmentComponentLinks(equipmentProjectId),
  });

  const fans = useMemo(
    () => (links ?? []).filter((l) => l.role === "fan_evaporator" || l.role === "fan_condenser"),
    [links],
  );

  const linkMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: EquipmentComponentRole }) =>
      addEquipmentComponentLink({
        equipmentProjectId,
        technicalComponentId: id,
        role,
      }),
    onSuccess: () => {
      toast.success("Ventilador vinculado");
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: removeEquipmentComponentLink,
    onSuccess: () => {
      toast.success("Ventilador desvinculado");
      qc.invalidateQueries({ queryKey: ["equip-component-links", equipmentProjectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando ventiladores…</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Erro ao carregar ventiladores: {(error as Error).message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <FanSlot
        title="Ventilador do evaporador"
        role="fan_evaporator"
        link={fans.find((f) => f.role === "fan_evaporator") ?? null}
        onAdd={(id) => linkMut.mutate({ id, role: "fan_evaporator" })}
        onRemove={(linkId) => removeMut.mutate(linkId)}
      />
      <FanSlot
        title="Ventilador do condensador"
        role="fan_condenser"
        link={fans.find((f) => f.role === "fan_condenser") ?? null}
        onAdd={(id) => linkMut.mutate({ id, role: "fan_condenser" })}
        onRemove={(linkId) => removeMut.mutate(linkId)}
      />

      <Alert>
        <AlertDescription className="text-sm">
          Ponto de operação (vazão real × pressão estática do duto) ainda não está implementado. Use
          o botão abaixo para registrar próximos passos.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <PendingFeatureDrawer
          triggerLabel="Calcular ponto de operação"
          title="Ponto de operação do ventilador"
          description="Cruzar curva pressão × vazão (fan_curves) com perda de carga do sistema."
          nextSteps={[
            "Carregar fan_curves para o fan_id selecionado",
            "Função pura em thermalcalc/system/fanOperatingPoint.ts (interpolação)",
            "Adicionar entrada de perda de carga total no painel",
          ]}
        />
      </div>
    </div>
  );
}

function FanSlot({
  title,
  role,
  link,
  onAdd,
  onRemove,
}: {
  title: string;
  role: EquipmentComponentRole;
  link: EquipmentComponentLinkExpanded | null;
  onAdd: (id: string) => void;
  onRemove: (linkId: string) => void;
}) {
  const c = link?.component;
  const {
    data: resolved,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["resolved-fan-component", c?.id],
    queryFn: () => resolveFanComponent(c!.id),
    enabled: Boolean(c),
  });
  const fanData = resolved?.data;
  const airflow = fanData?.thermalcalc.nominalAirflowM3h;
  const pressure = fanData?.thermalcalc.nominalPressurePa;
  const power = fanData?.thermalcalc.nominalPowerW;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          {!c ? (
            <LibraryComponentPicker
              entityTypes={["fan"]}
              onSelect={(comp) => onAdd(comp.id)}
              triggerLabel="Selecionar"
              title="Ventiladores da Biblioteca Técnica"
            />
          ) : (
            <Button size="sm" variant="outline" onClick={() => link && onRemove(link.id)}>
              <Trash2 className="mr-1 h-4 w-4" /> Trocar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!c ? (
          <p className="text-sm text-muted-foreground">Nenhum ventilador vinculado.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Fabricante / Modelo">
              {c.manufacturer ?? "—"} · {c.model ?? c.code ?? "—"}
            </Info>
            <Info label="Origem">
              <Badge variant="secondary">{c.source ?? "—"}</Badge>
            </Info>
            {isLoading && <Info label="Resolver técnico">Carregando dados finais…</Info>}
            {isError && (
              <Info label="Resolver técnico">
                <span className="text-destructive">{(error as Error).message}</span>
              </Info>
            )}
            <Info label="Vazão nominal">{airflow != null ? `${airflow} m³/h` : "—"}</Info>
            <Info label="Pressão nominal">{pressure != null ? `${pressure} Pa` : "—"}</Info>
            <Info label="Potência nominal">{power != null ? `${power} W` : "—"}</Info>
            <Info label="Curva disponível">
              {fanData ? (fanData.curves.length > 0 ? "Sim" : "Verificar fan_curves") : "—"}
            </Info>
            {resolved?.warnings.map((warning) => (
              <Info key={warning} label="Aviso técnico">
                <span className="text-amber-600">{warning}</span>
              </Info>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
