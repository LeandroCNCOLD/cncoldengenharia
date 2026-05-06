/**
 * ScenariosTabContent — Cenários Operacionais
 *
 * Testa a máquina em 9 condições reais de operação:
 * - Dia médio, dia quente, dia muito quente, noite fria
 * - Alta umidade, condensador sujo, evaporador com gelo
 * - Carga parcial, carga máxima
 *
 * Para cada cenário calcula: Q_evap, W_comp, COP, Tc, Te, status
 *
 * Referências:
 * - ASHRAE Handbook Refrigeration 2022, Cap. 14 — Forced-Circulation Air Coolers
 * - ASHRAE Standard 23.1 (2010) — Performance Testing of Positive Displacement Refrigerant Compressors
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, Play } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from "recharts";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import type { CatalogEquipmentRow } from "@/modules/coldpro_catalog/data/equipmentCatalog.types";
import type { EvaporatorFormValue } from "../../components/forms/EvaporatorForm";
import type { SystemConditions } from "../../components/forms/SystemConditionsForm";

interface Props {
  machine: CatalogEquipmentRow | null;
  compressor: Partial<CompressorSpec>;
  condenser: Partial<CondenserSpec>;
  evaporator: EvaporatorFormValue;
  conditions: Partial<SystemConditions>;
}

interface ScenarioResult {
  id: string;
  name: string;
  description: string;
  T_amb: number;
  T_cam: number;
  humidity_pct: number;
  load_factor: number;
  fouling_evap: number;
  fouling_cond: number;
  Q_evap_W: number;
  W_comp_W: number;
  COP: number;
  Tc: number;
  Te: number;
  status: "ok" | "warning" | "critical";
  notes: string[];
}

const SCENARIOS_DEF = [
  { id: "avg_day", name: "Dia Médio", T_amb: 32, T_cam_delta: 0, humidity: 60, load: 1.0, fouling_e: 0, fouling_c: 0, desc: "Condição nominal de projeto" },
  { id: "hot_day", name: "Dia Quente", T_amb: 38, T_cam_delta: 2, humidity: 55, load: 1.1, fouling_e: 0, fouling_c: 0, desc: "Temperatura ambiente elevada" },
  { id: "very_hot", name: "Dia Muito Quente", T_amb: 43, T_cam_delta: 4, humidity: 45, load: 1.2, fouling_e: 0, fouling_c: 0, desc: "Condição extrema de verão" },
  { id: "cold_night", name: "Noite Fria", T_amb: 18, T_cam_delta: -2, humidity: 75, load: 0.7, fouling_e: 0, fouling_c: 0, desc: "Temperatura ambiente baixa" },
  { id: "high_humidity", name: "Alta Umidade", T_amb: 30, T_cam_delta: 0, humidity: 90, load: 1.15, fouling_e: 0.1, fouling_c: 0, desc: "Carga latente elevada, risco de gelo" },
  { id: "dirty_cond", name: "Condensador Sujo", T_amb: 35, T_cam_delta: 0, humidity: 60, load: 1.0, fouling_e: 0, fouling_c: 0.25, desc: "Fouling de 25% no condensador" },
  { id: "iced_evap", name: "Evaporador com Gelo", T_amb: 35, T_cam_delta: 3, humidity: 85, load: 0.6, fouling_e: 0.40, fouling_c: 0, desc: "Redução de 40% na transferência de calor" },
  { id: "partial_load", name: "Carga Parcial (50%)", T_amb: 30, T_cam_delta: -1, humidity: 65, load: 0.5, fouling_e: 0, fouling_c: 0, desc: "Operação em carga reduzida" },
  { id: "max_load", name: "Carga Máxima", T_amb: 40, T_cam_delta: 5, humidity: 70, load: 1.3, fouling_e: 0, fouling_c: 0.1, desc: "Pior caso combinado" },
];

export function ScenariosTabContent({ machine, compressor, condenser, evaporator, conditions }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const results = useMemo<ScenarioResult[]>(() => {
    const Q_nom = compressor.cooling_capacity_w ?? 0;
    const W_nom = compressor.power_w ?? Q_nom / 2.5;
    const Tc_nom = compressor.cond_temp_c ?? machine?.tempCondensacaoC ?? 40;
    const Te_nom = compressor.evap_temp_c ?? machine?.tempEvaporacaoC ?? -10;
    const T_cam_nom = evaporator.air_temperature_in_c ?? machine?.tempCamaraC ?? 0;
    const T_amb_nom = conditions.ambient_temp_c ?? machine?.tempAmbienteC ?? 35;

    return SCENARIOS_DEF.map((sc) => {
      const T_cam = T_cam_nom + sc.T_cam_delta;
      const T_amb = sc.T_amb;

      // Ajuste de Te: Te ≈ T_cam - ΔT_evap (ASHRAE Refrigeration 2022, Cap. 14)
      const Te = Te_nom + (T_cam - T_cam_nom) * 0.6 - sc.fouling_e * 8;

      // Ajuste de Tc: Tc ≈ T_amb + ΔT_cond
      const Tc = Tc_nom + (T_amb - T_amb_nom) * 0.7 + sc.fouling_c * 15;

      // Fator de capacidade do compressor (sensibilidade a Te e Tc)
      // Baseado em curvas típicas AHRI 540: ΔQ ≈ 3%/K em Te, -2%/K em Tc
      const comp_factor = 1 + (Te - Te_nom) * 0.03 - (Tc - Tc_nom) * 0.02;
      const Q_evap = Q_nom * sc.load * comp_factor * (1 - sc.fouling_e * 0.8);
      const W_comp = W_nom * (1 + (Tc - Tc_nom) * 0.015 - (Te - Te_nom) * 0.01);
      const COP = W_comp > 0 ? Q_evap / W_comp : 0;

      const notes: string[] = [];
      if (sc.fouling_e > 0) notes.push(`Evaporador com ${(sc.fouling_e * 100).toFixed(0)}% de fouling`);
      if (sc.fouling_c > 0) notes.push(`Condensador com ${(sc.fouling_c * 100).toFixed(0)}% de fouling`);
      if (sc.humidity > 80) notes.push("Risco de formação de gelo no evaporador");
      if (Tc > 50) notes.push("Temperatura de condensação elevada — verificar envelope");
      if (Te < -40) notes.push("Temperatura de evaporação muito baixa — verificar compressor");

      const status: "ok" | "warning" | "critical" =
        Tc > 55 || Te < -45 || COP < 1.0 ? "critical" :
        Tc > 48 || COP < 1.5 ? "warning" : "ok";

      return {
        id: sc.id,
        name: sc.name,
        description: sc.desc,
        T_amb,
        T_cam,
        humidity_pct: sc.humidity,
        load_factor: sc.load,
        fouling_evap: sc.fouling_e,
        fouling_cond: sc.fouling_c,
        Q_evap_W: Q_evap,
        W_comp_W: W_comp,
        COP,
        Tc,
        Te,
        status,
        notes,
      };
    });
  }, [machine, compressor, condenser, evaporator, conditions]);

  const selectedResult = results.find((r) => r.id === selected) ?? results[0]!;
  const nominalResult = results.find((r) => r.id === "avg_day") ?? results[0]!;

  const radarData = [
    { subject: "Capacidade", value: nominalResult.Q_evap_W > 0 ? (selectedResult.Q_evap_W / nominalResult.Q_evap_W) * 100 : 0 },
    { subject: "COP", value: nominalResult.COP > 0 ? (selectedResult.COP / nominalResult.COP) * 100 : 0 },
    { subject: "Te", value: 100 - Math.abs(selectedResult.Te - nominalResult.Te) * 3 },
    { subject: "Tc", value: 100 - Math.abs(selectedResult.Tc - nominalResult.Tc) * 2 },
    { subject: "Carga", value: selectedResult.load_factor * 100 },
  ];

  const barData = results.map((r) => ({
    name: r.name.split(" ").slice(0, 2).join(" "),
    COP: parseFloat(r.COP.toFixed(2)),
    status: r.status,
  }));

  const statusColors: Record<string, string> = { ok: "#10b981", warning: "#f59e0b", critical: "#ef4444" };

  return (
    <div className="space-y-5">
      {/* Seletor de cenários */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {results.map((r) => (
          <Button
            key={r.id}
            variant={selected === r.id ? "default" : "outline"}
            size="sm"
            className={`h-auto flex-col gap-0.5 py-2 text-[10px] ${selected === r.id ? "bg-[#1E6FD9] text-white" : ""}`}
            onClick={() => setSelected(r.id)}
          >
            <span className="font-medium">{r.name}</span>
            <span className={`text-[9px] ${selected === r.id ? "text-blue-100" : r.status === "critical" ? "text-red-500" : r.status === "warning" ? "text-amber-500" : "text-emerald-500"}`}>
              {r.status === "critical" ? "⚠ Crítico" : r.status === "warning" ? "⚠ Alerta" : "✓ OK"}
            </span>
          </Button>
        ))}
      </div>

      {/* Detalhes do cenário selecionado */}
      <Card className={`border-2 ${selectedResult.status === "critical" ? "border-red-300 bg-red-50" : selectedResult.status === "warning" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{selectedResult.name}</CardTitle>
              <CardDescription className="text-xs">{selectedResult.description}</CardDescription>
            </div>
            {selectedResult.status === "ok" ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : selectedResult.status === "warning" ? (
              <AlertCircle className="h-8 w-8 text-amber-500" />
            ) : (
              <XCircle className="h-8 w-8 text-red-500" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Q_evap", value: `${(selectedResult.Q_evap_W / 1000).toFixed(2)} kW`, delta: nominalResult.Q_evap_W > 0 ? ((selectedResult.Q_evap_W / nominalResult.Q_evap_W - 1) * 100) : 0 },
              { label: "W_comp", value: `${(selectedResult.W_comp_W / 1000).toFixed(2)} kW`, delta: nominalResult.W_comp_W > 0 ? ((selectedResult.W_comp_W / nominalResult.W_comp_W - 1) * 100) : 0 },
              { label: "COP", value: selectedResult.COP.toFixed(3), delta: nominalResult.COP > 0 ? ((selectedResult.COP / nominalResult.COP - 1) * 100) : 0 },
              { label: "Tc", value: `${selectedResult.Tc.toFixed(1)}°C`, delta: selectedResult.Tc - nominalResult.Tc },
            ].map(({ label, value, delta }) => (
              <div key={label} className="rounded-lg bg-white/70 p-3">
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="text-lg font-bold text-slate-800">{value}</p>
                <p className={`text-[10px] font-medium ${delta > 0 ? (label === "COP" || label === "Q_evap" ? "text-emerald-600" : "text-red-600") : (label === "COP" || label === "Q_evap" ? "text-red-600" : "text-emerald-600")}`}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}{label === "Tc" ? "°C" : "%"} vs nominal
                </p>
              </div>
            ))}
          </div>
          {selectedResult.notes.length > 0 && (
            <div className="mt-3 space-y-1">
              {selectedResult.notes.map((note, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
                  {note}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Radar de desempenho relativo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Desempenho Relativo ao Nominal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#475569" }} />
                <PolarRadiusAxis angle={30} domain={[0, 120]} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                <Radar name={selectedResult.name} dataKey="value" stroke="#1E6FD9" fill="#1E6FD9" fillOpacity={0.3} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(0)}%`, ""]} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* COP por cenário */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">COP por Cenário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                <Tooltip formatter={(v: number) => [v.toFixed(3), "COP"]} />
                <Bar dataKey="COP" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={statusColors[entry.status] ?? "#10b981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumo de Todos os Cenários</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Cenário</th>
                  <th className="px-3 py-2 text-right">T_amb</th>
                  <th className="px-3 py-2 text-right">Te</th>
                  <th className="px-3 py-2 text-right">Tc</th>
                  <th className="px-3 py-2 text-right">Q_evap</th>
                  <th className="px-3 py-2 text-right">COP</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selected === r.id ? "bg-blue-50" : ""}`} onClick={() => setSelected(r.id)}>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{r.T_amb.toFixed(0)}°C</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{r.Te.toFixed(1)}°C</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${r.Tc > 50 ? "text-red-600" : r.Tc > 45 ? "text-amber-600" : "text-slate-600"}`}>{r.Tc.toFixed(1)}°C</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{(r.Q_evap_W / 1000).toFixed(1)} kW</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${r.COP < 1.5 ? "text-red-600" : r.COP < 2.0 ? "text-amber-600" : "text-emerald-600"}`}>{r.COP.toFixed(3)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className={`text-[10px] ${r.status === "critical" ? "border-red-400 text-red-600" : r.status === "warning" ? "border-amber-400 text-amber-600" : "border-emerald-400 text-emerald-600"}`}>
                        {r.status === "critical" ? "Crítico" : r.status === "warning" ? "Alerta" : "OK"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
