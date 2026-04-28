import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, AlertCircle, Save, Play } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { runSimulation, type SimulationOutput } from "@/lib/engine";

export const Route = createFileRoute("/_app/systems/$id/simulate")({
  component: SimulatePage,
});

function SimulatePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tEvap, setTEvap] = useState("-30");
  const [tAirEvap, setTAirEvap] = useState("-25");
  const [tAirCond, setTAirCond] = useState("35");
  const [output, setOutput] = useState<SimulationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: bundle } = useQuery({
    queryKey: ["system-bundle", id],
    queryFn: async () => {
      const { data: sys, error: e1 } = await supabase
        .from("systems")
        .select("name, compressor_id, evaporator_id, condenser_id")
        .eq("id", id)
        .single();
      if (e1) throw e1;
      const ids = [sys.compressor_id, sys.evaporator_id, sys.condenser_id];
      const { data: cdata, error: e2 } = await supabase
        .from("component_data")
        .select("component_id, fields")
        .in("component_id", ids);
      if (e2) throw e2;
      const map = new Map(
        (cdata ?? []).map((d) => [d.component_id, (d.fields ?? {}) as Record<string, unknown>]),
      );
      return {
        name: sys.name,
        compressor: { fields: map.get(sys.compressor_id) ?? {} },
        evaporator: { fields: map.get(sys.evaporator_id) ?? {} },
        condenser: { fields: map.get(sys.condenser_id) ?? {} },
      };
    },
  });

  function handleRun() {
    if (!bundle) return;
    setError(null);
    setOutput(null);
    setRunning(true);
    try {
      const r = runSimulation({
        tEvapTarget: Number(tEvap),
        tAirEvap: Number(tAirEvap),
        tAirCond: Number(tAirCond),
        compressor: bundle.compressor,
        evaporator: bundle.evaporator,
        condenser: bundle.condenser,
      });
      setOutput(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!output || !user) return;
    setSaving(true);
    const { error } = await supabase.from("simulations").insert({
      system_id: id,
      t_evap_target: Number(tEvap),
      t_air_evap: Number(tAirEvap),
      t_air_cond: Number(tAirCond),
      t_cond_eq: output.result.tCondEq,
      q_evap: output.result.qEvap,
      q_comp: output.result.qComp,
      w_comp: output.result.wComp,
      q_cond: output.result.qCond,
      cop: output.result.cop,
      balance_error: output.result.balanceError,
      util_comp: output.result.utilCompressor,
      util_evap: output.result.utilEvaporator,
      util_cond: output.result.utilCondenser,
      bottleneck: output.result.bottleneck,
      recommendations: output.recommendations as never,
      raw: { warnings: output.warnings } as never,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Simulação salva.");
    navigate({ to: "/systems/$id", params: { id } });
  }

  return (
    <div>
      <PageHeader
        title="Nova simulação"
        description={bundle?.name ?? "Carregando sistema…"}
        actions={
          <Link to="/systems/$id" params={{ id }}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <h3 className="text-sm font-semibold">Condições</h3>
            <NumField label="T_evap alvo (°C)" value={tEvap} onChange={setTEvap} />
            <NumField label="T_ar no evaporador (°C)" value={tAirEvap} onChange={setTAirEvap} />
            <NumField label="T_ar no condensador (°C)" value={tAirCond} onChange={setTAirCond} />

            <Button onClick={handleRun} disabled={!bundle || running} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              {running ? "Calculando…" : "Simular"}
            </Button>

            {output && (
              <Button onClick={handleSave} disabled={saving} variant="outline" className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando…" : "Salvar simulação"}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {error && (
            <Card className="border-destructive/40">
              <CardContent className="flex items-start gap-3 p-4 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Não foi possível simular</p>
                  <p className="text-muted-foreground">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!output && !error && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Defina as condições e clique em <strong>Simular</strong>.
              </CardContent>
            </Card>
          )}

          {output && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="T_cond equilíbrio" value={`${output.result.tCondEq.toFixed(1)} °C`} />
                <MetricCard label="COP" value={output.result.cop.toFixed(2)} />
                <MetricCard label="Q_evap" value={`${(output.result.qEvap / 1000).toFixed(2)} kW`} />
                <MetricCard label="W_comp" value={`${(output.result.wComp / 1000).toFixed(2)} kW`} />
              </div>

              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-3 text-sm font-semibold">Utilização e gargalo</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <UtilBar label="Compressor" value={output.result.utilCompressor} highlight={output.result.bottleneck === "compressor"} />
                    <UtilBar label="Evaporador" value={output.result.utilEvaporator} highlight={output.result.bottleneck === "evaporador"} />
                    <UtilBar label="Condensador" value={output.result.utilCondenser} highlight={output.result.bottleneck === "condensador"} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Erro de balanço: {(output.result.balanceError / 1000).toFixed(2)} kW · Gargalo:{" "}
                    <span className="font-medium capitalize">{output.result.bottleneck}</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-3 text-sm font-semibold">Recomendações</h3>
                  <ul className="space-y-3">
                    {output.recommendations.map((r, i) => (
                      <li key={i} className="rounded-md border border-border p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge
                            variant={r.priority === "alta" ? "destructive" : r.priority === "media" ? "default" : "secondary"}
                          >
                            {r.priority}
                          </Badge>
                          <p className="font-medium">{r.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{r.description}</p>
                        {r.impact && <p className="mt-1 text-xs text-primary">{r.impact}</p>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {output.warnings.length > 0 && (
                <Card className="border-warning/40">
                  <CardContent className="p-4 text-sm">
                    <p className="mb-2 font-medium">Avisos</p>
                    <ul className="ml-4 list-disc text-muted-foreground">
                      {output.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="0.5" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function UtilBar({ label, value, highlight }: { label: string; value: number; highlight: boolean }) {
  const pct = Math.max(0, Math.min(150, value * 100));
  const color =
    value > 0.9 ? "bg-destructive" : value > 0.75 ? "bg-warning" : "bg-success";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={highlight ? "font-semibold" : ""}>{label}</span>
        <span className="text-muted-foreground">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
