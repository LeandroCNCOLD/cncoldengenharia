import { useState, useMemo } from "react";
import { PlusCircle, X, Flame, Droplets, Zap, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  calculateHumidityRatio,
  calculateEnthalpy,
  calculateRelativeHumidityFromHumidityRatio,
  calculateDewPoint,
  calculateSaturationPressure,
} from "../engine/psychrometrics";

export type CoilType =
  | "evaporator_dx"
  | "reheat_hot_water"
  | "reheat_electric"
  | "precool_chilled_water"
  | "hot_gas_reheat";

export interface SeriesCoilConfig {
  id: string;
  type: CoilType;
  label: string;
  // Água quente
  T_water_in?: number;
  T_water_out?: number;
  rows?: number;
  geometryId?: string;
  // Elétrico
  powerKW?: number;
  // Gás quente — modo manual
  bypassFraction?: number;
  // Gás quente — modo setpoint
  hotGasMode?: "manual" | "setpoint";
  targetRH?: number; // UR alvo na saída (0–100 %)
  targetDewPoint?: number; // Ponto de orvalho alvo (°C) — alternativo
  // Resultados calculados
  deltaP_Pa?: number;
  Q_kcalh?: number;
  T_ar_saida?: number;
  // Resultados de desumidificação
  dehumid?: DehumidResult;
}

/** Dados do ciclo necessários para calcular a bateria de gás quente */
export interface HotGasSourceData {
  T_discharge_C: number;
  h_discharge_kJkg: number;
  h_condOut_kJkg: number;
  m_dot_total_kgS: number;
  Tc_C: number;
}

/** Resultado do cálculo de desumidificação */
export interface DehumidResult {
  /** Razão de umidade na entrada da bateria (kg_água/kg_ar_seco) */
  W_in: number;
  /** Razão de umidade na saída da bateria (inalterada — reaquecimento sensível) */
  W_out: number;
  /** UR na saída após reaquecimento (%) */
  RH_out_pct: number;
  /** Ponto de orvalho na saída (°C) */
  dewPoint_out_C: number;
  /** Q reaquecimento necessário para atingir o setpoint (W) */
  Q_required_W: number;
  /** Q reaquecimento necessário (kcal/h) */
  Q_required_kcalh: number;
  /** Fração de by-pass calculada para atingir o setpoint */
  bypassFractionRequired: number;
  /** Temperatura de saída do ar após reaquecimento (°C) */
  T_ar_saida_C: number;
  /** Se o setpoint é atingível com a capacidade disponível */
  achievable: boolean;
  /** Capacidade máxima disponível (kcal/h) com 100% de by-pass */
  Q_max_kcalh: number;
}

const PATM_PA = 101325;

const coilTypeLabels: Record<CoilType, string> = {
  evaporator_dx: "Evaporador DX",
  reheat_hot_water: "Bateria de Reaquecimento (água quente)",
  reheat_electric: "Bateria de Aquecimento Elétrico",
  precool_chilled_water: "Bateria de Pré-resfriamento (água gelada)",
  hot_gas_reheat: "Bateria de Reaquecimento por Gás Quente",
};

interface CoilsInSeriesPanelProps {
  primaryCoilResult?: {
    deltaP_Pa: number;
    Q_kcalh: number;
    T_ar_saida: number;
    /** UR na saída do evaporador (%) — necessário para cálculo de desumidificação */
    RH_saida_pct?: number;
  };
  hotGasSource?: HotGasSourceData;
  airFlowM3H?: number;
  /** UR na entrada do evaporador (%) — para referência */
  airRH_in?: number;
  onCoilsChange?: (coils: SeriesCoilConfig[]) => void;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `coil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Calcula o estado psicométrico e o reaquecimento necessário para atingir
 * um setpoint de UR ou ponto de orvalho na saída.
 *
 * Princípio: o reaquecimento por gás quente é SENSÍVEL — não remove nem
 * adiciona umidade. A razão de umidade W permanece constante. Ao aumentar
 * a temperatura do ar, a UR cai.
 *
 *   W_evap_out = W(T_evap_out, RH_evap_out)   [kg/kg]
 *   T_target = T tal que RH(T_target, W) = RH_alvo
 *   Q_req = ṁ_ar × cp_ar × (T_target − T_evap_out)
 *   f_bypass = Q_req / (ṁ_total × (h_discharge − h_condOut))
 */
function calcDehumidSetpoint(
  T_evap_out_C: number,
  RH_evap_out_pct: number,
  targetRH_pct: number,
  airFlowM3H: number,
  source: HotGasSourceData,
): DehumidResult {
  const RH_evap = RH_evap_out_pct / 100;
  const W_in = calculateHumidityRatio(T_evap_out_C, RH_evap, PATM_PA);

  // Capacidade máxima disponível (100% by-pass)
  const Q_max_W = source.m_dot_total_kgS * (source.h_discharge_kJkg - source.h_condOut_kJkg) * 1000;
  const Q_max_kcalh = Q_max_W * 0.86;

  // Vazão mássica de ar seco (kg/s)
  const rho_ar = 1.2; // kg/m³ (simplificado)
  const m_dot_ar = (airFlowM3H / 3600) * rho_ar;
  const cp_ar = 1006; // J/(kg·K)

  // Temperatura alvo: RH(T_target, W_in) = targetRH
  // Inversa: T_target = f(W_in, RH_alvo)
  // Resolvemos numericamente (bissecção em T de 0 a 60°C)
  const RH_target = targetRH_pct / 100;
  let T_lo = T_evap_out_C;
  let T_hi = 60.0;
  let T_target = T_evap_out_C;
  for (let i = 0; i < 50; i++) {
    const T_mid = (T_lo + T_hi) / 2;
    const RH_mid = calculateRelativeHumidityFromHumidityRatio(T_mid, W_in, PATM_PA);
    if (RH_mid > RH_target) {
      T_lo = T_mid;
    } else {
      T_hi = T_mid;
    }
    T_target = T_mid;
    if (Math.abs(T_hi - T_lo) < 0.01) break;
  }

  const Q_required_W = Math.max(0, m_dot_ar * cp_ar * (T_target - T_evap_out_C));
  const Q_required_kcalh = Q_required_W * 0.86;

  const bypassFractionRequired = Q_max_W > 0
    ? Math.min(1, Q_required_W / Q_max_W)
    : 0;

  const achievable = Q_required_W <= Q_max_W;

  // UR real na saída (com o Q disponível se não atingível)
  const Q_actual_W = achievable ? Q_required_W : Q_max_W;
  const T_ar_saida_C = T_evap_out_C + (m_dot_ar > 0 ? Q_actual_W / (m_dot_ar * cp_ar) : 0);
  const RH_out = calculateRelativeHumidityFromHumidityRatio(T_ar_saida_C, W_in, PATM_PA);
  const dewPoint_out_C = calculateDewPoint(T_ar_saida_C, RH_out);

  return {
    W_in,
    W_out: W_in, // reaquecimento sensível — W não muda
    RH_out_pct: RH_out * 100,
    dewPoint_out_C,
    Q_required_W,
    Q_required_kcalh,
    bypassFractionRequired,
    T_ar_saida_C,
    achievable,
    Q_max_kcalh,
  };
}

/**
 * Cálculo direto (modo manual): dado f_bypass, calcula Q e estado do ar.
 */
function calcHotGasManual(
  source: HotGasSourceData,
  bypassFraction: number,
  airFlowM3H: number,
  T_ar_in: number,
  RH_ar_in_pct: number,
): { Q_W: number; Q_kcalh: number; T_ar_saida: number; deltaP_Pa: number; dehumid: DehumidResult } {
  const fraction = Math.max(0, Math.min(1, bypassFraction));
  const m_dot_bypass = fraction * source.m_dot_total_kgS;
  const Q_W = m_dot_bypass * (source.h_discharge_kJkg - source.h_condOut_kJkg) * 1000;
  const Q_kcalh = Q_W * 0.86;

  const m_dot_ar = (airFlowM3H / 3600) * 1.2;
  const cp_ar = 1006;
  const deltaT_ar = m_dot_ar > 0 ? Q_W / (m_dot_ar * cp_ar) : 0;
  const T_ar_saida = T_ar_in + deltaT_ar;
  const deltaP_Pa = 20 + fraction * 30;

  // Estado psicométrico
  const W_in = calculateHumidityRatio(T_ar_in, RH_ar_in_pct / 100, PATM_PA);
  const RH_out = calculateRelativeHumidityFromHumidityRatio(T_ar_saida, W_in, PATM_PA);
  const dewPoint_out_C = calculateDewPoint(T_ar_saida, RH_out);
  const Q_max_W = source.m_dot_total_kgS * (source.h_discharge_kJkg - source.h_condOut_kJkg) * 1000;

  const dehumid: DehumidResult = {
    W_in,
    W_out: W_in,
    RH_out_pct: RH_out * 100,
    dewPoint_out_C,
    Q_required_W: Q_W,
    Q_required_kcalh: Q_kcalh,
    bypassFractionRequired: fraction,
    T_ar_saida_C: T_ar_saida,
    achievable: true,
    Q_max_kcalh: Q_max_W * 0.86,
  };

  return { Q_W, Q_kcalh, T_ar_saida, deltaP_Pa, dehumid };
}

export function CoilsInSeriesPanel({
  primaryCoilResult,
  hotGasSource,
  airFlowM3H = 5000,
  airRH_in = 60,
  onCoilsChange,
}: CoilsInSeriesPanelProps) {
  const [additionalCoils, setAdditionalCoils] = useState<SeriesCoilConfig[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const T_ar_evap_out = primaryCoilResult?.T_ar_saida ?? 10;
  // UR na saída do evaporador — estimamos 90% se não informada (ar saindo do evap quase saturado)
  const RH_evap_out = primaryCoilResult?.RH_saida_pct ?? 90;

  const coilsWithCalc = useMemo<SeriesCoilConfig[]>(() => {
    return additionalCoils.map((coil) => {
      if (coil.type !== "hot_gas_reheat" || !hotGasSource) return coil;

      const mode = coil.hotGasMode ?? "manual";

      if (mode === "setpoint" && coil.targetRH !== undefined) {
        const dehumid = calcDehumidSetpoint(
          T_ar_evap_out,
          RH_evap_out,
          coil.targetRH,
          airFlowM3H,
          hotGasSource,
        );
        return {
          ...coil,
          bypassFraction: dehumid.bypassFractionRequired,
          Q_kcalh: dehumid.Q_required_kcalh,
          T_ar_saida: dehumid.T_ar_saida_C,
          deltaP_Pa: 20 + dehumid.bypassFractionRequired * 30,
          dehumid,
        };
      } else {
        // Modo manual
        const calc = calcHotGasManual(
          hotGasSource,
          coil.bypassFraction ?? 0.15,
          airFlowM3H,
          T_ar_evap_out,
          RH_evap_out,
        );
        return {
          ...coil,
          Q_kcalh: calc.Q_kcalh,
          T_ar_saida: calc.T_ar_saida,
          deltaP_Pa: calc.deltaP_Pa,
          dehumid: calc.dehumid,
        };
      }
    });
  }, [additionalCoils, hotGasSource, airFlowM3H, T_ar_evap_out, RH_evap_out]);

  const notify = (coils: SeriesCoilConfig[]) => {
    onCoilsChange?.([
      { id: "primary", type: "evaporator_dx", label: "Evaporador DX" },
      ...coils,
    ]);
  };

  const addCoil = (type: CoilType) => {
    const newCoil: SeriesCoilConfig = {
      id: makeId(),
      type,
      label: coilTypeLabels[type],
      T_water_in: type === "reheat_hot_water" ? 60 : undefined,
      T_water_out: type === "reheat_hot_water" ? 50 : undefined,
      rows: type === "reheat_hot_water" ? 2 : undefined,
      powerKW: type === "reheat_electric" ? 1.5 : undefined,
      bypassFraction: type === "hot_gas_reheat" ? 0.15 : undefined,
      hotGasMode: type === "hot_gas_reheat" ? "setpoint" : undefined,
      targetRH: type === "hot_gas_reheat" ? 55 : undefined,
    };
    const updated = [...additionalCoils, newCoil];
    setAdditionalCoils(updated);
    notify(updated);
    setShowAddMenu(false);
  };

  const updateCoil = (id: string, patch: Partial<SeriesCoilConfig>) => {
    const updated = additionalCoils.map((coil) =>
      coil.id === id ? { ...coil, ...patch } : coil,
    );
    setAdditionalCoils(updated);
    notify(updated);
  };

  const removeCoil = (id: string) => {
    const updated = additionalCoils.filter((coil) => coil.id !== id);
    setAdditionalCoils(updated);
    notify(updated);
  };

  const totalDeltaP =
    (primaryCoilResult?.deltaP_Pa ?? 0) +
    coilsWithCalc.reduce((sum, coil) => sum + (coil.deltaP_Pa ?? 0), 0);

  const fmt = (v: number, d = 0) =>
    Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: d }) : "—";
  const fmtDec = (v: number, d = 1) =>
    Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Arranjo de Coils no Fluxo de Ar</h4>
        {totalDeltaP > 0 && (
          <Badge variant="outline">ΔP total: {totalDeltaP.toFixed(1)} Pa</Badge>
        )}
      </div>

      {/* Evaporador principal */}
      <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
        <span className="text-blue-500">❄️</span>
        <span className="flex-1 text-sm font-medium">Evaporador DX</span>
        {primaryCoilResult && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>ΔP: {primaryCoilResult.deltaP_Pa.toFixed(1)} Pa</span>
            <span>Q: {fmt(primaryCoilResult.Q_kcalh)} kcal/h</span>
            <span>T saída: {fmtDec(primaryCoilResult.T_ar_saida)} °C</span>
            {primaryCoilResult.RH_saida_pct !== undefined && (
              <span>UR saída: {fmtDec(primaryCoilResult.RH_saida_pct)} %</span>
            )}
          </div>
        )}
        <Badge variant="secondary" className="text-xs">Principal</Badge>
      </div>

      {/* Baterias adicionais */}
      {coilsWithCalc.map((coil) => (
        <div key={coil.id} className="flex items-start gap-2 rounded-md border p-2">
          <span className="mt-1">
            {coil.type === "hot_gas_reheat" ? (
              <Flame className="h-4 w-4 text-orange-500" />
            ) : (
              <span className="text-orange-500">🔥</span>
            )}
          </span>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{coil.label}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeCoil(coil.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Campos: água quente */}
            {coil.type === "reheat_hot_water" && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">T entrada água (°C)</Label>
                  <Input type="number" value={coil.T_water_in}
                    onChange={(e) => updateCoil(coil.id, { T_water_in: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">T saída água (°C)</Label>
                  <Input type="number" value={coil.T_water_out}
                    onChange={(e) => updateCoil(coil.id, { T_water_out: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Fileiras</Label>
                  <Input type="number" value={coil.rows} min={1} max={4}
                    onChange={(e) => updateCoil(coil.id, { rows: Number(e.target.value) })}
                    className="h-7 text-xs" />
                </div>
              </div>
            )}

            {/* Campos: elétrico */}
            {coil.type === "reheat_electric" && (
              <div>
                <Label className="text-xs">Potência (kW)</Label>
                <Input type="number" value={coil.powerKW} step={0.5}
                  onChange={(e) => updateCoil(coil.id, { powerKW: Number(e.target.value) })}
                  className="h-7 w-32 text-xs" />
              </div>
            )}

            {/* Campos: gás quente */}
            {coil.type === "hot_gas_reheat" && (
              <div className="space-y-3">
                {/* Modo: setpoint vs manual */}
                <Tabs
                  value={coil.hotGasMode ?? "setpoint"}
                  onValueChange={(v) => updateCoil(coil.id, { hotGasMode: v as "manual" | "setpoint" })}
                >
                  <TabsList className="h-7 text-xs">
                    <TabsTrigger value="setpoint" className="h-6 text-xs px-2">
                      <Droplets className="mr-1 h-3 w-3" />
                      Setpoint UR
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="h-6 text-xs px-2">
                      By-pass manual
                    </TabsTrigger>
                  </TabsList>

                  {/* Modo setpoint */}
                  <TabsContent value="setpoint" className="mt-2">
                    <div className="flex items-end gap-3">
                      <div>
                        <Label className="text-xs">UR alvo na saída (%)</Label>
                        <Input
                          type="number"
                          value={coil.targetRH ?? 55}
                          min={30}
                          max={90}
                          step={1}
                          onChange={(e) => updateCoil(coil.id, { targetRH: Number(e.target.value) })}
                          className="h-7 w-24 text-xs"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground pb-1">
                        UR entrada: {fmtDec(RH_evap_out)} % @ {fmtDec(T_ar_evap_out)} °C
                      </div>
                    </div>
                  </TabsContent>

                  {/* Modo manual */}
                  <TabsContent value="manual" className="mt-2">
                    <div className="flex items-end gap-3">
                      <div>
                        <Label className="text-xs">Fração de by-pass (%)</Label>
                        <Input
                          type="number"
                          value={Math.round((coil.bypassFraction ?? 0.15) * 100)}
                          min={5}
                          max={60}
                          step={1}
                          onChange={(e) => updateCoil(coil.id, { bypassFraction: Number(e.target.value) / 100 })}
                          className="h-7 w-24 text-xs"
                        />
                      </div>
                      {hotGasSource && (
                        <div className="text-xs text-muted-foreground pb-1">
                          T descarga: {fmtDec(hotGasSource.T_discharge_C)} °C · Tc: {fmtDec(hotGasSource.Tc_C)} °C
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Resultados calculados */}
                {coil.dehumid && hotGasSource ? (
                  <div className="space-y-1">
                    {/* Linha principal de resultados */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-orange-50 px-3 py-2 text-xs dark:bg-orange-950/30">
                      <span className="font-semibold text-orange-700 dark:text-orange-400">
                        Q reaquecimento: {fmt(coil.dehumid.Q_required_kcalh)} kcal/h
                      </span>
                      <span className="text-muted-foreground">
                        By-pass: {(coil.dehumid.bypassFractionRequired * 100).toFixed(1)} %
                      </span>
                      <span className="text-muted-foreground">
                        T saída ar: {fmtDec(coil.dehumid.T_ar_saida_C)} °C
                      </span>
                    </div>
                    {/* Linha psicométrica */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-blue-50 px-3 py-2 text-xs dark:bg-blue-950/30">
                      <span className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        UR saída: {fmtDec(coil.dehumid.RH_out_pct)} %
                      </span>
                      <span className="text-muted-foreground">
                        Ponto de orvalho: {fmtDec(coil.dehumid.dewPoint_out_C)} °C
                      </span>
                      <span className="text-muted-foreground">
                        W: {(coil.dehumid.W_out * 1000).toFixed(2)} g/kg
                      </span>
                    </div>
                    {/* Aviso se não atingível */}
                    {!coil.dehumid.achievable && (
                      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        ⚠ Capacidade insuficiente para atingir o setpoint. Máximo disponível: {fmt(coil.dehumid.Q_max_kcalh)} kcal/h
                        ({(coil.dehumid.Q_max_kcalh / coil.dehumid.Q_required_kcalh * 100).toFixed(0)}% do necessário).
                        Considere aumentar o compressor ou reduzir a carga de umidade.
                      </div>
                    )}
                  </div>
                ) : !hotGasSource ? (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    ⚠ Execute o cálculo do ciclo para obter os resultados de reaquecimento.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Botão adicionar */}
      {!showAddMenu ? (
        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setShowAddMenu(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar coil em série
        </Button>
      ) : (
        <div className="space-y-1 rounded-md border bg-muted/30 p-2">
          <p className="mb-2 text-xs font-medium">Selecionar tipo de coil:</p>
          {(["reheat_hot_water", "reheat_electric", "hot_gas_reheat", "precool_chilled_water"] as CoilType[]).map((type) => (
            <Button key={type} variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => addCoil(type)}>
              {type === "reheat_hot_water" && <Droplets className="mr-2 h-3 w-3 text-red-500" />}
              {type === "reheat_electric" && <Zap className="mr-2 h-3 w-3 text-yellow-500" />}
              {type === "hot_gas_reheat" && <Flame className="mr-2 h-3 w-3 text-orange-500" />}
              {type === "precool_chilled_water" && <Snowflake className="mr-2 h-3 w-3 text-sky-500" />}
              {coilTypeLabels[type]}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAddMenu(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  );
}
