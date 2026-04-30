import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createComponent,
  getCondenserCoilModel,
  getEvaporatorCoilModel,
  listComponentsByKind,
  upsertCondenserCoilModel,
  upsertEvaporatorCoilModel,
} from "@/lib/coldpro/component-items";
import { useAuth } from "@/lib/auth";
import { UnilabImportForm } from "@/components/coldpro/unilab-import-form";
import { CalibrationPanel } from "@/components/coldpro/calibration-panel";
import { PerformanceMapPanel } from "@/components/coldpro/performance-map-panel";
import { buildDatasheetFromCoilRow, buildInputFromCoilRow } from "@/lib/coldpro/coil-row-mapper";

type CoilMode = "evaporator" | "condenser";

interface CoilTabProps {
  equipmentProjectId: string;
  mode: CoilMode;
}

const MODE_CONFIG = {
  evaporator: {
    kind: "evaporador",
    title: "Evaporadores",
    addLabel: "Adicionar evaporador",
    emptyLabel: "Nenhum evaporador cadastrado.",
    expectedKind: "evaporator",
    queryPrefix: "evap-model",
    fetchRow: getEvaporatorCoilModel,
    upsertRow: upsertEvaporatorCoilModel,
  },
  condenser: {
    kind: "condensador",
    title: "Condensadores",
    addLabel: "Adicionar condensador",
    emptyLabel: "Nenhum condensador cadastrado.",
    expectedKind: "condenser",
    queryPrefix: "cond-model",
    fetchRow: getCondenserCoilModel,
    upsertRow: upsertCondenserCoilModel,
  },
} as const;

export function CoilTab({ equipmentProjectId, mode }: CoilTabProps) {
  const config = MODE_CONFIG[mode];
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: items = [] } = useQuery({
    queryKey: ["components", equipmentProjectId, config.kind],
    queryFn: () => listComponentsByKind(equipmentProjectId, config.kind),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      return createComponent({
        equipment_project_id: equipmentProjectId,
        kind: config.kind,
        created_by: user.id,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["components", equipmentProjectId, config.kind] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{config.title}</h2>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="mr-2 h-4 w-4" /> {config.addLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {config.emptyLabel}
          </CardContent>
        </Card>
      ) : (
        items.map((component) => (
          <div key={component.id} className="space-y-3">
            <UnilabImportForm
              componentId={component.id}
              componentCode={component.code}
              componentStatus={component.status}
              expectedKind={config.expectedKind}
              queryKey={[config.queryPrefix, component.id]}
              fetchRow={async () =>
                (await config.fetchRow(component.id)) as Record<string, unknown> | null
              }
              upsertRow={async (patch) => {
                const row = await config.upsertRow(patch as never);
                return row as unknown as Record<string, unknown>;
              }}
            />
            <CoilCalibrationSlot
              componentId={component.id}
              equipmentProjectId={equipmentProjectId}
              mode={mode}
              queryPrefix={config.queryPrefix}
              fetchRow={config.fetchRow}
            />
          </div>
        ))
      )}
    </div>
  );
}

function CoilCalibrationSlot({
  componentId,
  equipmentProjectId,
  mode,
  queryPrefix,
  fetchRow,
}: {
  componentId: string;
  equipmentProjectId: string;
  mode: CoilMode;
  queryPrefix: string;
  fetchRow: (componentItemId: string) => Promise<unknown>;
}) {
  const { data: row } = useQuery({
    queryKey: [queryPrefix, componentId],
    queryFn: async () => (await fetchRow(componentId)) as Record<string, unknown> | null,
  });
  const datasheet = buildDatasheetFromCoilRow(row, mode);
  const input = buildInputFromCoilRow(row, mode);
  return (
    <>
      <CalibrationPanel
        componentItemId={componentId}
        coilType={mode}
        datasheet={datasheet}
        simulationInput={input}
      />
      <PerformanceMapPanel
        componentItemId={componentId}
        equipmentProjectId={equipmentProjectId}
        coilType={mode}
        simulationInput={input}
      />
    </>
  );
}
