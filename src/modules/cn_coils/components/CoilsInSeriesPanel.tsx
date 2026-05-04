import { useState, useMemo } from "react";
import { PlusCircle, X, Flame, Droplets, Zap, Snowflake, Settings2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  calculateHumidityRatio,
  calculateRelativeHumidityFromHumidityRatio,
  calculateDewPoint,
} from "../engine/psychrometrics";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type CoilType =
  | "evaporator_dx"
  | "reheat_hot_water"
  | "reheat_electric"
  | "precool_chilled_water"
  | "hot_gas_reheat";

/** Geometria do evaporador principal — usada para dimensionar a bateria de gás quente */
export interface EvaporatorGeometry {
  finnedHeightMm: number;
  finnedLengthMm: number;
  finPitchMm: number;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
  tubePitchTransverseMm: number;
  tubePitchLongitudinalMm: number;
}

export interface SeriesCoilConfig {
  id: string;
  type: CoilType;
  label: string;
  // Água quente
  T_water_in?: number;
  T_water_out?: number;
  rows?: number;
  rowsOverride?: boolean; // se true, o usuário fixou o nº de fileiras manualmente
  geometryId?: string;
  // Elétrico
  powerKW?: number;
  // Gás quente — modo manual
  bypassFraction?: number;
  // Gás quente — modo setpoint
  hotGasMode?: "manual" | "setpoint";
  targetRH?: number;       // UR alvo na saída (0–100 %)
  targetDewPoint?: number; // Ponto de orvalho alvo (°C)
  // Resultados calculados
  deltaP_Pa?: number;
  Q_kcalh?: number;
  T_ar_saida?: number;
  dehumid?: DehumidResult;
  // Dimensionamento automático da bateria de gás quente
  autoRows?: number;       // fileiras calculadas automaticamente
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
  W_in: number;
  W_out: number;
  RH_out_pct: number;
  dewPoint_out_C: number;
  Q_required_W: number;
  Q_required_kcalh: number;
  bypassFractionRequired: number;
  T_ar_saida_C: number;
  achievable: boolean;
  Q_max_kcalh: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Máquina de estados de controle de desumidificação
// ─────────────────────────────────────────────────────────────────────────────

export type DehumidControlState =
  | "cooling"        // Refrigeração normal — atingindo T_setpoint
  | "reheat"         // Reaquecimento ativo — controlando UR
  | "ventilation";   // Ventilação — ambos setpoints atingidos

export interface DehumidControlConfig {
  T_setpoint_C: number;      // Temperatura alvo da câmara (°C)
  RH_setpoint_pct: number;   // UR alvo (%)
  dT_diff_C: number;         // Diferencial para religar o compressor (°C) — padrão 2°C
  dT_reheat_off_C: number;   // Temperatura acima do setpoint para desligar reaquecimento (°C) — padrão 3°C
}

export interface DehumidControlResult {
  state: DehumidControlState;
  stateLabel: string;
  stateColor: string;
  compressorOn: boolean;
  reheatOn: boolean;
  fanOn: boolean;
  description: string;
  nextTransition: string;
}

/**
 * Avalia o estado atual da máquina de estados de controle de desumidificação.
 *
 * Lógica:
 *   COOLING:     Compressor ligado, by-pass fechado
 *                → REHEAT quando T ≤ T_sp E UR > UR_sp
 *                → VENTILATION quando T ≤ T_sp E UR ≤ UR_sp
 *
 *   REHEAT:      Compressor ligado, by-pass aberto
 *                → COOLING quando T > T_sp + dT_reheat_off (reaquecimento desliga)
 *                → VENTILATION quando T ≤ T_sp E UR ≤ UR_sp
 *
 *   VENTILATION: Compressor desligado, ventilador ligado
 *                → COOLING quando T > T_sp + dT_diff
 */
export function evaluateDehumidControl(
  T_ambient_C: number,
  RH_ambient_pct: number,
  cfg: DehumidControlConfig,
  currentState: DehumidControlState = "cooling",
): DehumidControlResult {
  const { T_setpoint_C, RH_setpoint_pct, dT_diff_C, dT_reheat_off_C } = cfg;

  const T_reached = T_ambient_C <= T_setpoint_C;
  const RH_reached = RH_ambient_pct <= RH_setpoint_pct;
  const T_too_high_for_reheat = T_ambient_C > T_setpoint_C + dT_reheat_off_C;
  const T_above_diff = T_ambient_C > T_setpoint_C + dT_diff_C;

  let nextState: DehumidControlState = currentState;

  switch (currentState) {
    case "cooling":
      if (T_reached && RH_reached) nextState = "ventilation";
      else if (T_reached && !RH_reached) nextState = "reheat";
      break;
    case "reheat":
      if (T_reached && RH_reached) nextState = "ventilation";
      else if (T_too_high_for_reheat) nextState = "cooling";
      break;
    case "ventilation":
      if (T_above_diff) nextState = "cooling";
      break;
  }

  const stateInfo: Record<DehumidControlState, { label: string; color: string; compressor: boolean; reheat: boolean; fan: boolean; desc: string; next: string }> = {
    cooling: {
      label: "Refrigeração",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
      compressor: true,
      reheat: false,
      fan: true,
      desc: `Compressor ligado, válvula de by-pass fechada. Resfriando câmara até ${T_setpoint_C.toFixed(1)} °C.`,
      next: `Quando T ≤ ${T_setpoint_C.toFixed(1)} °C: verifica UR. Se UR > ${RH_setpoint_pct.toFixed(0)} % → ativa reaquecimento.`,
    },
    reheat: {
      label: "Reaquecimento",
      color: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
      compressor: true,
      reheat: true,
      fan: true,
      desc: `Compressor ligado, gás quente ativo. Desumidificando até UR ≤ ${RH_setpoint_pct.toFixed(0)} %.`,
      next: `Desliga reaquecimento se T > ${(T_setpoint_C + dT_reheat_off_C).toFixed(1)} °C. Para ventilação quando T ≤ ${T_setpoint_C.toFixed(1)} °C E UR ≤ ${RH_setpoint_pct.toFixed(0)} %.`,
    },
    ventilation: {
      label: "Ventilação",
      color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
      compressor: false,
      reheat: false,
      fan: true,
      desc: "Setpoints atingidos. Compressor desligado, ventilador ligado.",
      next: `Religa compressor quando T > ${(T_setpoint_C + dT_diff_C).toFixed(1)} °C.`,
    },
  };

  const info = stateInfo[nextState];
  return {
    state: nextState,
    stateLabel: info.label,
    stateColor: info.color,
    compressorOn: info.compressor,
    reheatOn: info.reheat,
    fanOn: info.fan,
    description: info.desc,
    nextTransition: info.next,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimensionamento automático de fileiras da bateria de gás quente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula o número de fileiras necessárias para a bateria de reaquecimento
 * por gás quente, mantendo a mesma seção transversal do evaporador.
 *
 * Método simplificado (LMTD):
 *   U_base ≈ 25 W/(m²·K) para bateria de condensação com aleta plana
 *   A_fileira = (finnedHeight × finnedLength) / 1e6  [m²]
 *   Q_fileira = U_base × A_fileira × ΔTLM
 *   rows = ceil(Q_required / Q_fileira)
 */
export function calcHotGasReheatRows(
  Q_required_W: number,
  geom: EvaporatorGeometry,
  T_discharge_C: number,
  Tc_C: number,
  T_ar_in_C: number,
  T_ar_out_C: number,
): { rows: number; U_base: number; A_fileira_m2: number; DTLM_C: number; Q_fileira_W: number } {
  // Área frontal por fileira (m²)
  const A_fileira_m2 = (geom.finnedHeightMm / 1000) * (geom.finnedLengthMm / 1000);

  // ΔTLM entre gás quente (condensando de T_discharge até Tc) e ar
  // Simplificação: gás entra a T_discharge e sai a Tc (condensação completa)
  const T_hot_in = T_discharge_C;
  const T_hot_out = Tc_C;
  const dT1 = T_hot_in - T_ar_out_C;
  const dT2 = T_hot_out - T_ar_in_C;
  const DTLM_C = Math.abs(dT1 - dT2) < 0.01
    ? (dT1 + dT2) / 2
    : (dT1 - dT2) / Math.log(Math.max(dT1, 0.1) / Math.max(dT2, 0.1));

  // U_base para bateria de condensação com aleta plana (W/m²·K)
  // Referência: ASHRAE Handbook Fundamentals, típico 20–35 W/m²·K
  const U_base = 25;

  const Q_fileira_W = U_base * A_fileira_m2 * Math.max(DTLM_C, 1);
  const rows = Math.max(1, Math.ceil(Q_required_W / Math.max(Q_fileira_W, 1)));

  return { rows, U_base, A_fileira_m2, DTLM_C, Q_fileira_W };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funções de cálculo psicométrico
// ─────────────────────────────────────────────────────────────────────────────

const PATM_PA = 101325;

function calcDehumidSetpoint(
  T_evap_out_C: number,
  RH_evap_out_pct: number,
  targetRH_pct: number,
  airFlowM3H: number,
  source: HotGasSourceData,
): DehumidResult {
  const RH_evap = RH_evap_out_pct / 100;
  const W_in = calculateHumidityRatio(T_evap_out_C, RH_evap, PATM_PA);

  const Q_max_W = source.m_dot_total_kgS * (source.h_discharge_kJkg - source.h_condOut_kJkg) * 1000;
  const Q_max_kcalh = Q_max_W * 0.86;

  const rho_ar = 1.2;
  const m_dot_ar = (airFlowM3H / 3600) * rho_ar;
  const cp_ar = 1006;

  const RH_target = targetRH_pct / 100;
  let T_lo = T_evap_out_C;
  let T_hi = 60.0;
  let T_target = T_evap_out_C;
  for (let i = 0; i < 50; i++) {
    const T_mid = (T_lo + T_hi) / 2;
    const RH_mid = calculateRelativeHumidityFromHumidityRatio(T_mid, W_in, PATM_PA);
    if (RH_mid > RH_target) T_lo = T_mid;
    else T_hi = T_mid;
    T_target = T_mid;
    if (Math.abs(T_hi - T_lo) < 0.01) break;
  }

  const Q_required_W = Math.max(0, m_dot_ar * cp_ar * (T_target - T_evap_out_C));
  const Q_required_kcalh = Q_required_W * 0.86;
  const bypassFractionRequired = Q_max_W > 0 ? Math.min(1, Q_required_W / Q_max_W) : 0;
  const achievable = Q_required_W <= Q_max_W;

  const Q_actual_W = achievable ? Q_required_W : Q_max_W;
  const T_ar_saida_C = T_evap_out_C + (m_dot_ar > 0 ? Q_actual_W / (m_dot_ar * cp_ar) : 0);
  const RH_out = calculateRelativeHumidityFromHumidityRatio(T_ar_saida_C, W_in, PATM_PA);
  const dewPoint_out_C = calculateDewPoint(T_ar_saida_C, RH_out);

  return {
    W_in, W_out: W_in,
    RH_out_pct: RH_out * 100,
    dewPoint_out_C,
    Q_required_W, Q_required_kcalh,
    bypassFractionRequired,
    T_ar_saida_C,
    achievable, Q_max_kcalh,
  };
}

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
  const T_ar_saida = T_ar_in + (m_dot_ar > 0 ? Q_W / (m_dot_ar * cp_ar) : 0);
  const deltaP_Pa = 20 + fraction * 30;
  const W_in = calculateHumidityRatio(T_ar_in, RH_ar_in_pct / 100, PATM_PA);
  const RH_out = calculateRelativeHumidityFromHumidityRatio(T_ar_saida, W_in, PATM_PA);
  const dewPoint_out_C = calculateDewPoint(T_ar_saida, RH_out);
  const Q_max_W = source.m_dot_total_kgS * (source.h_discharge_kJkg - source.h_condOut_kJkg) * 1000;
  const dehumid: DehumidResult = {
    W_in, W_out: W_in,
    RH_out_pct: RH_out * 100,
    dewPoint_out_C,
    Q_required_W: Q_W, Q_required_kcalh: Q_kcalh,
    bypassFractionRequired: fraction,
    T_ar_saida_C: T_ar_saida,
    achievable: true,
    Q_max_kcalh: Q_max_W * 0.86,
  };
  return { Q_W, Q_kcalh, T_ar_saida, deltaP_Pa, dehumid };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

const coilTypeLabels: Record<CoilType, string> = {
  evaporator_dx: "Evaporador DX",
  reheat_hot_water: "Bateria de Reaquecimento (água quente)",
  reheat_electric: "Bateria de Aquecimento Elétrico",
  precool_chilled_water: "Bateria de Pré-resfriamento (água gelada)",
  hot_gas_reheat: "Bateria de Reaquecimento por Gás Quente",
};

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `coil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface CoilsInSeriesPanelProps {
  primaryCoilResult?: {
    deltaP_Pa: number;
    Q_kcalh: number;
    T_ar_saida: number;
    RH_saida_pct?: number;
  };
  hotGasSource?: HotGasSourceData;
  airFlowM3H?: number;
  airRH_in?: number;
  /** Geometria do evaporador principal para dimensionamento automático da bateria */
  evaporatorGeometry?: EvaporatorGeometry;
  onCoilsChange?: (coils: SeriesCoilConfig[]) => void;
}

export function CoilsInSeriesPanel({
  primaryCoilResult,
  hotGasSource,
  airFlowM3H = 5000,
  airRH_in = 60,
  evaporatorGeometry,
  onCoilsChange,
}: CoilsInSeriesPanelProps) {
  const [additionalCoils, setAdditionalCoils] = useState<SeriesCoilConfig[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ── Máquina de estados de controle ──
  const [showControl, setShowControl] = useState(false);
  const [controlState, setControlState] = useState<DehumidControlState>("cooling");
  const [controlCfg, setControlCfg] = useState<DehumidControlConfig>({
    T_setpoint_C: 2,
    RH_setpoint_pct: 85,
    dT_diff_C: 2,
    dT_reheat_off_C: 3,
  });
  const [T_ambient_sim, setT_ambient_sim] = useState(5);
  const [RH_ambient_sim, setRH_ambient_sim] = useState(90);

  const T_ar_evap_out = primaryCoilResult?.T_ar_saida ?? 10;
  const RH_evap_out = primaryCoilResult?.RH_saida_pct ?? 90;

  // Avalia o estado de controle
  const controlResult = useMemo(
    () => evaluateDehumidControl(T_ambient_sim, RH_ambient_sim, controlCfg, controlState),
    [T_ambient_sim, RH_ambient_sim, controlCfg, controlState],
  );

  // Atualiza estado quando resultado muda
  const handleSimulate = () => {
    setControlState(controlResult.state);
  };

  const coilsWithCalc = useMemo<SeriesCoilConfig[]>(() => {
    return additionalCoils.map((coil) => {
      if (coil.type !== "hot_gas_reheat" || !hotGasSource) return coil;

      const mode = coil.hotGasMode ?? "setpoint";

      let dehumid: DehumidResult | undefined;
      let Q_kcalh = 0;
      let T_ar_saida = T_ar_evap_out;
      let deltaP_Pa = 20;

      if (mode === "setpoint" && coil.targetRH !== undefined) {
        dehumid = calcDehumidSetpoint(T_ar_evap_out, RH_evap_out, coil.targetRH, airFlowM3H, hotGasSource);
        Q_kcalh = dehumid.Q_required_kcalh;
        T_ar_saida = dehumid.T_ar_saida_C;
        deltaP_Pa = 20 + dehumid.bypassFractionRequired * 30;
      } else {
        const calc = calcHotGasManual(hotGasSource, coil.bypassFraction ?? 0.15, airFlowM3H, T_ar_evap_out, RH_evap_out);
        dehumid = calc.dehumid;
        Q_kcalh = calc.Q_kcalh;
        T_ar_saida = calc.T_ar_saida;
        deltaP_Pa = calc.deltaP_Pa;
      }

      // Dimensionamento automático de fileiras
      let autoRows = coil.rows ?? 1;
      if (!coil.rowsOverride && evaporatorGeometry && dehumid && dehumid.Q_required_W > 0) {
        const sizing = calcHotGasReheatRows(
          dehumid.Q_required_W,
          evaporatorGeometry,
          hotGasSource.T_discharge_C,
          hotGasSource.Tc_C,
          T_ar_evap_out,
          dehumid.T_ar_saida_C,
        );
        autoRows = sizing.rows;
      }

      return {
        ...coil,
        bypassFraction: dehumid?.bypassFractionRequired ?? coil.bypassFraction,
        Q_kcalh,
        T_ar_saida,
        deltaP_Pa,
        dehumid,
        autoRows,
        rows: coil.rowsOverride ? coil.rows : autoRows,
      };
    });
  }, [additionalCoils, hotGasSource, airFlowM3H, T_ar_evap_out, RH_evap_out, evaporatorGeometry]);

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
      rowsOverride: false,
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

  const hasHotGasCoil = coilsWithCalc.some((c) => c.type === "hot_gas_reheat");

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Arranjo de Coils no Fluxo de Ar</h4>
          <div className="flex items-center gap-2">
            {hasHotGasCoil && (
              <Button
                variant={showControl ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowControl((v) => !v)}
              >
                <Settings2 className="h-3 w-3" />
                Controle
              </Button>
            )}
            {totalDeltaP > 0 && (
              <Badge variant="outline">ΔP total: {totalDeltaP.toFixed(1)} Pa</Badge>
            )}
          </div>
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
              ) : coil.type === "reheat_electric" ? (
                <Zap className="h-4 w-4 text-yellow-500" />
              ) : coil.type === "precool_chilled_water" ? (
                <Snowflake className="h-4 w-4 text-sky-500" />
              ) : (
                <Droplets className="h-4 w-4 text-red-500" />
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

                    <TabsContent value="setpoint" className="mt-2">
                      <div className="flex items-end gap-3">
                        <div>
                          <Label className="text-xs">UR alvo na saída (%)</Label>
                          <Input
                            type="number"
                            value={coil.targetRH ?? 55}
                            min={30} max={90} step={1}
                            onChange={(e) => updateCoil(coil.id, { targetRH: Number(e.target.value) })}
                            className="h-7 w-24 text-xs"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground pb-1">
                          UR entrada: {fmtDec(RH_evap_out)} % @ {fmtDec(T_ar_evap_out)} °C
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="manual" className="mt-2">
                      <div className="flex items-end gap-3">
                        <div>
                          <Label className="text-xs">Fração de by-pass (%)</Label>
                          <Input
                            type="number"
                            value={Math.round((coil.bypassFraction ?? 0.15) * 100)}
                            min={5} max={60} step={1}
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

                  {/* Dimensionamento automático de fileiras */}
                  <div className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium">Fileiras da bateria</Label>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {coil.rowsOverride ? (
                          <Input
                            type="number"
                            value={coil.rows ?? coil.autoRows ?? 1}
                            min={1} max={8} step={1}
                            onChange={(e) => updateCoil(coil.id, { rows: Number(e.target.value) })}
                            className="h-7 w-20 text-xs"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {coil.autoRows ?? "—"} fileira{(coil.autoRows ?? 1) !== 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {coil.rowsOverride ? "(manual)" : "(automático)"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Fixar</Label>
                      <Switch
                        checked={coil.rowsOverride ?? false}
                        onCheckedChange={(v) => updateCoil(coil.id, {
                          rowsOverride: v,
                          rows: v ? (coil.autoRows ?? 1) : undefined,
                        })}
                        className="h-4 w-7"
                      />
                    </div>
                  </div>

                  {evaporatorGeometry && (
                    <div className="text-xs text-muted-foreground px-1">
                      Geometria herdada: {evaporatorGeometry.finnedHeightMm} × {evaporatorGeometry.finnedLengthMm} mm
                      · Aleta {evaporatorGeometry.finPitchMm} mm · Tubo ⌀{evaporatorGeometry.tubeOuterDiameterMm} mm
                    </div>
                  )}

                  {/* Resultados calculados */}
                  {coil.dehumid && hotGasSource ? (
                    <div className="space-y-1">
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
                      {!coil.dehumid.achievable && (
                        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                          ⚠ Capacidade insuficiente. Máximo: {fmt(coil.dehumid.Q_max_kcalh)} kcal/h
                          ({(coil.dehumid.Q_max_kcalh / Math.max(coil.dehumid.Q_required_kcalh, 1) * 100).toFixed(0)}% do necessário).
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

      {/* Painel de controle de desumidificação */}
      {showControl && hasHotGasCoil && (
        <Card className="p-4 space-y-4 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <h4 className="text-sm font-medium">Controle de Desumidificação — Lógica de Câmara</h4>
          </div>

          {/* Setpoints */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">T setpoint (°C)</Label>
              <Input
                type="number" step={0.5}
                value={controlCfg.T_setpoint_C}
                onChange={(e) => setControlCfg((c) => ({ ...c, T_setpoint_C: Number(e.target.value) }))}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">UR setpoint (%)</Label>
              <Input
                type="number" step={1} min={40} max={95}
                value={controlCfg.RH_setpoint_pct}
                onChange={(e) => setControlCfg((c) => ({ ...c, RH_setpoint_pct: Number(e.target.value) }))}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">ΔT religar (°C)</Label>
              <Input
                type="number" step={0.5} min={0.5} max={5}
                value={controlCfg.dT_diff_C}
                onChange={(e) => setControlCfg((c) => ({ ...c, dT_diff_C: Number(e.target.value) }))}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">ΔT desligar reaq. (°C)</Label>
              <Input
                type="number" step={0.5} min={1} max={10}
                value={controlCfg.dT_reheat_off_C}
                onChange={(e) => setControlCfg((c) => ({ ...c, dT_reheat_off_C: Number(e.target.value) }))}
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Simulação de condição atual */}
          <div className="rounded-md bg-muted/40 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Simular condição atual da câmara:</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <Label className="text-xs">T ambiente (°C)</Label>
                <Input
                  type="number" step={0.5}
                  value={T_ambient_sim}
                  onChange={(e) => setT_ambient_sim(Number(e.target.value))}
                  className="h-7 w-24 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">UR ambiente (%)</Label>
                <Input
                  type="number" step={1} min={0} max={100}
                  value={RH_ambient_sim}
                  onChange={(e) => setRH_ambient_sim(Number(e.target.value))}
                  className="h-7 w-24 text-xs"
                />
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={handleSimulate}>
                Avaliar estado
              </Button>
            </div>
          </div>

          {/* Estado atual */}
          <div className={`rounded-md px-4 py-3 space-y-2 ${controlResult.stateColor}`}>
            <div className="flex items-center gap-3">
              <span className="text-base font-bold">{controlResult.stateLabel}</span>
              <div className="flex gap-2 text-xs">
                <Badge variant={controlResult.compressorOn ? "default" : "outline"} className="text-xs">
                  Compressor {controlResult.compressorOn ? "ON" : "OFF"}
                </Badge>
                <Badge variant={controlResult.reheatOn ? "default" : "outline"} className="text-xs">
                  Gás quente {controlResult.reheatOn ? "ON" : "OFF"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Ventilador ON
                </Badge>
              </div>
            </div>
            <p className="text-xs">{controlResult.description}</p>
            <p className="text-xs text-muted-foreground">→ {controlResult.nextTransition}</p>
          </div>

          {/* Diagrama de transição */}
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <p className="font-medium mb-2">Diagrama de estados:</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded bg-blue-100 px-2 py-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                ❄ Refrigeração
              </span>
              <span className="text-muted-foreground">→ T≤Tsp + UR&gt;URsp →</span>
              <span className="rounded bg-orange-100 px-2 py-1 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                🔥 Reaquecimento
              </span>
              <span className="text-muted-foreground">→ ambos atingidos →</span>
              <span className="rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-950/40 dark:text-green-300">
                💨 Ventilação
              </span>
              <span className="text-muted-foreground">→ T&gt;Tsp+ΔT →</span>
              <span className="rounded bg-blue-100 px-2 py-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                ❄ Refrigeração
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
