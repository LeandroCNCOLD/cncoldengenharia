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
import { CoilTechnicalForm } from "@/components/coldpro/coil-technical-form";
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
            <CoilTechnicalForm
              coilType={mode}
              value={buildTechnicalFormValue(component, null, mode)}
            >
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
            </CoilTechnicalForm>
          </div>
        ))
      )}
    </div>
  );
}

function buildTechnicalFormValue(
  component: { manufacturer: string | null; model: string | null; code: string | null },
  row: Record<string, unknown> | null,
  mode: CoilMode,
) {
  const value = {
    manufacturer: component.manufacturer ?? undefined,
    model: component.model ?? undefined,
    code: component.code ?? undefined,
    refrigerant: (row?.refrigerant as string | null | undefined) ?? undefined,
    nominalCapacityW: numberValue(row?.nominal_capacity_w),
    geometry: {
      tubesPerRow: numberValue(row?.tubes_per_row),
      rows: numberValue(row?.rows),
      circuits: numberValue(row?.circuits),
    },
    dimensions: {
      lengthMm: numberValue(row?.length_mm),
    },
    airflowM3h: numberValue(row?.nominal_airflow_m3h),
    airOutletTempC: numberValue(row?.nominal_air_temp_out_c),
  };
  if (mode === "evaporator") {
    return {
      ...value,
      evaporationTempC: numberValue(row?.nominal_evap_temp_c),
      superheatK: numberValue(row?.superheat_k),
      airInletTempC: numberValue(row?.nominal_air_temp_in_c),
      evaporatorCapacityW: numberValue(row?.nominal_capacity_w),
    };
  }
  return {
    ...value,
    condensationTempC: numberValue(row?.nominal_cond_temp_c),
    subcoolingK: numberValue(row?.subcooling_k),
    ambientAirTempC: numberValue(row?.nominal_air_temp_in_c),
    heatRejectionW: numberValue(row?.nominal_capacity_w),
  };
}

function numberValue(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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
