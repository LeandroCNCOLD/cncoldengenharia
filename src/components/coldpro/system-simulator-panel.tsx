import { useEffect, useMemo, useState } from "react";
import { Play, Activity, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  simulateSystem,
  listCompressorModels,
  type SystemInput,
  type SystemResolvedTechnicalData,
  type SystemResult,
  type Bottleneck,
} from "@/modules/coldpro/system";

const REFRIGERANTS = ["R404A", "R134a", "R290", "R407C", "R410A"];

const BOTTLENECK_LABEL: Record<Bottleneck, { label: string; color: string }> = {
  evaporator: { label: "Evaporador", color: "bg-blue-500" },
  compressor: { label: "Compressor", color: "bg-orange-500" },
  condenser: { label: "Condensador", color: "bg-red-500" },
  balanced: { label: "Equilibrado", color: "bg-emerald-500" },
  unknown: { label: "Indeterminado", color: "bg-muted" },
};

interface Props {
  defaultEvaporatorCode?: string;
  defaultCondenserCode?: string;
  resolvedTechnicalData?: SystemResolvedTechnicalData;
  resolverWarnings?: string[];
  isResolvingTechnicalData?: boolean;
}

export function SystemSimulatorPanel({
  defaultEvaporatorCode,
  defaultCondenserCode,
  resolvedTechnicalData,
  resolverWarnings = [],
  isResolvingTechnicalData = false,
}: Props) {
  const compressorModels = useMemo(() => listCompressorModels(), []);

  const [form, setForm] = useState<SystemInput>({
    evaporatorGeometryCode: defaultEvaporatorCode ?? "EVAP_DEFAULT",
    condenserGeometryCode: defaultCondenserCode ?? "COND_DEFAULT",
    refrigerant: "R404A",
    evaporatingTempC: -10,
    condensingTempC: 45,
    airInletEvapC: 0,
    airInletCondC: 32,
    airflowEvapM3h: 3000,
    airflowCondM3h: 6000,
    compressorModel: compressorModels[0] ?? "GENERIC_R404A_2HP",
    superheatK: 8,
    subcoolingK: 3,
  });

  const [result, setResult] = useState<SystemResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      evaporatorGeometryCode: defaultEvaporatorCode ?? prev.evaporatorGeometryCode,
      condenserGeometryCode: defaultCondenserCode ?? prev.condenserGeometryCode,
      resolvedTechnicalData,
    }));
  }, [defaultCondenserCode, defaultEvaporatorCode, resolvedTechnicalData]);

  const set = <K extends keyof SystemInput>(k: K, v: SystemInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const run = () => {
    setRunning(true);
    setRunError(null);
    try {
      const r = simulateSystem(form);
      setResult(r);
      if (r.converged) {
        toast.success(`Sistema convergiu em ${r.iterations} iterações`);
      } else {
        toast.warning(`Solver não convergiu — verifique alertas`);
      }
    } catch (e) {
      const message = (e as Error).message;
      setResult(null);
      setRunError(message);
      toast.error(`Erro na simulação: ${message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Refrigerante">
            <Select value={form.refrigerant} onValueChange={(v) => set("refrigerant", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRIGERANTS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Modelo do compressor">
            <Select value={form.compressorModel} onValueChange={(v) => set("compressorModel", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {compressorModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Código geometria evap.">
            <Input
              value={form.evaporatorGeometryCode}
              onChange={(e) => set("evaporatorGeometryCode", e.target.value)}
            />
          </Field>
          <Field label="Código geometria cond.">
            <Input
              value={form.condenserGeometryCode}
              onChange={(e) => set("condenserGeometryCode", e.target.value)}
            />
          </Field>

          <Field label="Tar entrada evap. (°C)">
            <NumInput value={form.airInletEvapC} onChange={(v) => set("airInletEvapC", v)} />
          </Field>
          <Field label="Tar entrada cond. (°C)">
            <NumInput value={form.airInletCondC} onChange={(v) => set("airInletCondC", v)} />
          </Field>
          <Field label="Vazão ar evap. (m³/h)">
            <NumInput value={form.airflowEvapM3h} onChange={(v) => set("airflowEvapM3h", v)} />
          </Field>
          <Field label="Vazão ar cond. (m³/h)">
            <NumInput value={form.airflowCondM3h} onChange={(v) => set("airflowCondM3h", v)} />
          </Field>

          <Field label="Tevap inicial (°C)">
            <NumInput value={form.evaporatingTempC} onChange={(v) => set("evaporatingTempC", v)} />
          </Field>
          <Field label="Tcond inicial (°C)">
            <NumInput value={form.condensingTempC} onChange={(v) => set("condensingTempC", v)} />
          </Field>
          <Field label="Superaquecimento (K)">
            <NumInput value={form.superheatK} onChange={(v) => set("superheatK", v)} />
          </Field>
          <Field label="Subresfriamento (K)">
            <NumInput value={form.subcoolingK} onChange={(v) => set("subcoolingK", v)} />
          </Field>

          <div className="md:col-span-3">
            <Button
              onClick={run}
              disabled={running || isResolvingTechnicalData}
              className="w-full md:w-auto"
            >
              <Play className="mr-2 h-4 w-4" />
              {running ? "Simulando..." : "Simular sistema"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isResolvingTechnicalData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Resolvendo dados técnicos da Biblioteca Técnica…</AlertDescription>
        </Alert>
      )}

      {resolverWarnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dados técnicos resolvidos com avisos</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
              {resolverWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {resolvedTechnicalData && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Simulação conectada a dados resolvidos da Biblioteca Técnica.
          </AlertDescription>
        </Alert>
      )}

      {runError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Simulação não executada</AlertTitle>
          <AlertDescription>{runError}</AlertDescription>
        </Alert>
      )}

      {/* Resultado */}
      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Ponto de equilíbrio
                </span>
                <span className="flex items-center gap-2">
                  {result.converged ? (
                    <Badge variant="default" className="bg-emerald-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Convergiu ({result.iterations} it.)
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Não convergiu
                    </Badge>
                  )}
                  <Badge className={BOTTLENECK_LABEL[result.bottleneck].color}>
                    Gargalo: {BOTTLENECK_LABEL[result.bottleneck].label}
                  </Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <Metric
                label="Capacidade real"
                value={`${(result.capacityRealW / 1000).toFixed(2)} kW`}
                hint={`${result.capacityRealW.toFixed(0)} W`}
              />
              <Metric
                label="Potência compressor"
                value={`${(result.compressorPowerW / 1000).toFixed(2)} kW`}
                hint={`${result.compressorPowerW.toFixed(0)} W`}
              />
              <Metric
                label="COP"
                value={result.cop.toFixed(2)}
                hint={result.cop >= 1.5 && result.cop <= 3.5 ? "Faixa típica" : "Fora da faixa"}
              />
              <Metric
                label="Erro balanço"
                value={`${(result.energyBalanceError * 100).toFixed(1)}%`}
                hint="qCond vs qEvap+W"
              />
              <Metric label="Tevap equilíbrio" value={`${result.evaporatingTempC.toFixed(1)} °C`} />
              <Metric label="Tcond equilíbrio" value={`${result.condensingTempC.toFixed(1)} °C`} />
              <Metric
                label="Tar saída evap."
                value={`${(result.evaporator.airOutletTempC ?? 0).toFixed(1)} °C`}
              />
              <Metric
                label="Tar saída cond."
                value={`${(result.condenser.airOutletTempC ?? 0).toFixed(1)} °C`}
              />
            </CardContent>
          </Card>

          {/* Capacidades por estágio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacidades por estágio</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <StageCard
                title="Evaporador"
                capacity={result.evaporatorCapacityW}
                util={result.utilizationEvap}
                isBottleneck={result.bottleneck === "evaporator"}
                extras={[
                  ["U", `${result.evaporator.uWm2K.toFixed(0)} W/m²K`],
                  ["Área efetiva", `${result.evaporator.effectiveAreaM2.toFixed(2)} m²`],
                  ["h_ar", `${result.evaporator.hAirWm2K.toFixed(0)} W/m²K`],
                ]}
              />
              <StageCard
                title="Compressor"
                capacity={result.compressorCapacityW}
                util={result.utilizationComp}
                isBottleneck={result.bottleneck === "compressor"}
                extras={[
                  ["Modelo", result.compressor.model],
                  ["Vazão massa", `${result.compressor.massFlowKgh.toFixed(1)} kg/h`],
                  ["Envelope", result.compressor.inEnvelope ? "OK" : "FORA"],
                ]}
              />
              <StageCard
                title="Condensador"
                capacity={result.condenserCapacityW}
                util={result.utilizationCond}
                isBottleneck={result.bottleneck === "condenser"}
                extras={[
                  ["U", `${result.condenser.uWm2K.toFixed(0)} W/m²K`],
                  ["Área efetiva", `${result.condenser.effectiveAreaM2.toFixed(2)} m²`],
                  ["h_ar", `${result.condenser.hAirWm2K.toFixed(0)} W/m²K`],
                ]}
              />
            </CardContent>
          </Card>

          {/* Alertas */}
          {result.warnings.length > 0 && (
            <Alert variant={result.converged ? "default" : "destructive"}>
              <Zap className="h-4 w-4" />
              <AlertTitle>Alertas ({result.warnings.length})</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 mt-2 list-disc space-y-1 text-sm">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1 rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function StageCard({
  title,
  capacity,
  util,
  isBottleneck,
  extras,
}: {
  title: string;
  capacity: number;
  util: number;
  isBottleneck: boolean;
  extras: Array<[string, string]>;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${isBottleneck ? "border-orange-500 bg-orange-500/5" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        {isBottleneck && (
          <Badge variant="destructive" className="text-[10px]">
            GARGALO
          </Badge>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold">{(capacity / 1000).toFixed(2)} kW</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Utilização: {(util * 100).toFixed(0)}%
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${util * 100}%` }} />
      </div>
      <div className="mt-3 space-y-1 text-xs">
        {extras.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
