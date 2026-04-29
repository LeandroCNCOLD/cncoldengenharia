import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createComponent,
  getEvaporatorCoilModel,
  listComponentsByKind,
  upsertEvaporatorCoilModel,
} from "@/lib/coldpro/component-items";
import { useAuth } from "@/lib/auth";
import { UnilabImportForm } from "@/components/coldpro/unilab-import-form";
import { CalibrationPanel } from "@/components/coldpro/calibration-panel";
import {
  buildDatasheetFromCoilRow,
  buildInputFromCoilRow,
} from "@/lib/coldpro/coil-row-mapper";

interface Props {
  equipmentProjectId: string;
}

export function EvaporatorTab({ equipmentProjectId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: items = [] } = useQuery({
    queryKey: ["components", equipmentProjectId, "evaporador"],
    queryFn: () => listComponentsByKind(equipmentProjectId, "evaporador"),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      return createComponent({
        equipment_project_id: equipmentProjectId,
        kind: "evaporador",
        created_by: user.id,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["components", equipmentProjectId, "evaporador"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Evaporadores</h2>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar evaporador
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum evaporador cadastrado.
          </CardContent>
        </Card>
      ) : (
        items.map((c) => (
          <UnilabImportForm
            key={c.id}
            componentId={c.id}
            componentCode={c.code}
            componentStatus={c.status}
            expectedKind="evaporator"
            queryKey={["evap-model", c.id]}
            fetchRow={async () => (await getEvaporatorCoilModel(c.id)) as Record<string, unknown> | null}
            upsertRow={async (patch) => {
              const r = await upsertEvaporatorCoilModel(patch as never);
              return r as unknown as Record<string, unknown>;
            }}
          />
        ))
      )}
    </div>
  );
}
