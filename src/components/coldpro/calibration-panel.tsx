import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, Sparkles, History, Gauge } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAuth } from "@/lib/auth";
import {
  getActiveCalibrationForComponent,
  listCoilCalibrations,
  saveCoilCalibration,
} from "@/lib/coldpro/coil-calibrations";
import {
  calibrateCoilFromDatasheet,
  type CalibrationOutcome,
  type DatasheetPoint,
} from "@/modules/coldpro/coil/coilCalibration";
import type { CoilSimulatorInput } from "@/modules/coldpro/coil/coilSimulatorTypes";
import { CALIBRATION_TARGETS } from "@/modules/coldpro/coil/coilEngineTypes";

interface CalibrationPanelProps {
  componentItemId: string;
  coilType: "evaporator" | "condenser";
  datasheet: DatasheetPoint | null;
  simulationInput: CoilSimulatorInput | null;
}

function statusBadge(status?: string | null) {
  if (status === "calibrated")
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Calibrado
      </Badge>
    );
  if (status === "needs_review")
    return (
      <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-500">
        <AlertTriangle className="mr-1 h-3 w-3" /> Revisão
      </Badge>
    );
  return <Badge variant="outline">Sem calibração</Badge>;
}

function devClass(pct: number | null | undefined, target: number) {
  if (pct == null) return "text-muted-foreground";
  const a = Math.abs(pct);
  if (a <= target) return "text-emerald-600";
  if (a <= target * 2) return "text-amber-600";
  return "text-destructive";
}

function fmtPct(v: number | null | undefined) {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtFactor(v: number | null | undefined) {
  if (v == null) return "—";
  return `×${v.toFixed(3)}`;
}

export function CalibrationPanel({
  componentItemId,
  coilType,
  datasheet,
  simulationInput,
}: CalibrationPanelProps) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: active } = useQuery({
    queryKey: ["coil-cal-active", componentItemId],
    queryFn: () => getActiveCalibrationForComponent(componentItemId),
    enabled: !!componentItemId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["coil-cal-history", componentItemId],
    queryFn: () => listCoilCalibrations(componentItemId),
    enabled: !!componentItemId,
  });

  const calMutation = useMutation({
    mutationFn: async (): Promise<CalibrationOutcome> => {
      if (!datasheet) throw new Error("Sem ponto nominal do datasheet.");
      if (!simulationInput) throw new Error("Sem entrada de simulação.");
      const outcome = calibrateCoilFromDatasheet({
        input: simulationInput,
        datasheet,
      });
      await saveCoilCalibration({
        componentItemId,
        coilType,
        outcome,
        referenceSource: "Unilab datasheet",
        inputSnapshot: simulationInput,
        outputSnapshot: outcome.calibratedResult,
        userId: user?.id,
      });
      return outcome;
    },
    onSuccess: (outcome) => {
      qc.invalidateQueries({ queryKey: ["coil-cal-active", componentItemId] });
      qc.invalidateQueries({ queryKey: ["coil-cal-history", componentItemId] });
      qc.invalidateQueries({ queryKey: ["coil-cal-latest", componentItemId] });
      const dev = outcome.deviationAfter.capacityPct;
      if (outcome.meetsTargets) {
        toast.success(`Calibrado: erro de capacidade ${dev?.toFixed(2)}% (≤5%).`);
      } else {
        toast.warning(`Calibração salva — revisar (erro residual ${dev?.toFixed(2)}%).`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = (active as { status?: string } | null)?.status ?? "draft";
  const confidence = Number((active as { confidence_score?: number } | null)?.confidence_score ?? 0.6);
  const devBefore = (active as { deviation_before?: { capacityPct?: number; airDpPct?: number; refDpPct?: number } } | null)?.deviation_before;
  const devAfter = (active as { deviation_after?: { capacityPct?: number; airDpPct?: number; refDpPct?: number } } | null)?.deviation_after;

  const factors = active
    ? {
        capacity: Number((active as { capacity_correction_factor?: number }).capacity_correction_factor ?? 1),
        air: Number((active as { air_dp_correction_factor?: number }).air_dp_correction_factor ?? 1),
        ref: Number((active as { ref_dp_correction_factor?: number }).ref_dp_correction_factor ?? 1),
      }
    : null;

  const canCalibrate = !!datasheet && !!simulationInput;
  const hasActive = !!active;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4" /> Calibração contra datasheet
          </span>
          {statusBadge(status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Confiança</span>
            <span>{(confidence * 100).toFixed(0)}%</span>
          </div>
          <Progress value={confidence * 100} />
        </div>

        {hasActive ? (
          <>
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Erro antes vs depois
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Métrica</TableHead>
                    <TableHead className="text-right">Antes</TableHead>
                    <TableHead className="text-right">Depois</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Capacidade</TableCell>
                    <TableCell className={`text-right ${devClass(devBefore?.capacityPct, CALIBRATION_TARGETS.capacityPct)}`}>
                      {fmtPct(devBefore?.capacityPct)}
                    </TableCell>
                    <TableCell className={`text-right ${devClass(devAfter?.capacityPct, CALIBRATION_TARGETS.capacityPct)}`}>
                      {fmtPct(devAfter?.capacityPct)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">≤{CALIBRATION_TARGETS.capacityPct}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>ΔP ar</TableCell>
                    <TableCell className={`text-right ${devClass(devBefore?.airDpPct, CALIBRATION_TARGETS.airDpPct)}`}>
                      {fmtPct(devBefore?.airDpPct)}
                    </TableCell>
                    <TableCell className={`text-right ${devClass(devAfter?.airDpPct, CALIBRATION_TARGETS.airDpPct)}`}>
                      {fmtPct(devAfter?.airDpPct)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">≤{CALIBRATION_TARGETS.airDpPct}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>ΔP refrigerante</TableCell>
                    <TableCell className={`text-right ${devClass(devBefore?.refDpPct, CALIBRATION_TARGETS.refDpPct)}`}>
                      {fmtPct(devBefore?.refDpPct)}
                    </TableCell>
                    <TableCell className={`text-right ${devClass(devAfter?.refDpPct, CALIBRATION_TARGETS.refDpPct)}`}>
                      {fmtPct(devAfter?.refDpPct)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">≤{CALIBRATION_TARGETS.refDpPct}%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {factors && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Capacidade</div>
                  <div className="font-mono">{fmtFactor(factors.capacity)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ΔP ar</div>
                  <div className="font-mono">{fmtFactor(factors.air)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ΔP refrigerante</div>
                  <div className="font-mono">{fmtFactor(factors.ref)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Heat transfer</div>
                  <div className="font-mono">{fmtFactor(factors.capacity)}</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma calibração registrada para este componente.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => calMutation.mutate()}
            disabled={!canCalibrate || calMutation.isPending}
            size="sm"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {hasActive ? "Recalibrar" : "Calibrar com datasheet"}
          </Button>
          {!canCalibrate && (
            <span className="self-center text-xs text-muted-foreground">
              Importe o datasheet Unilab para habilitar a calibração.
            </span>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <History className="h-3 w-3" /> Últimas calibrações
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">|ΔQ| pós</TableHead>
                  <TableHead className="text-right">Fator Q</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 5).map((h) => {
                  const row = h as unknown as {
                    id: string;
                    created_at: string;
                    status?: string;
                    deviation_after?: { capacityPct?: number };
                    capacity_correction_factor?: number;
                  };
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">
                        {format(new Date(row.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-right text-xs">
                        {fmtPct(row.deviation_after?.capacityPct)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtFactor(Number(row.capacity_correction_factor))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
