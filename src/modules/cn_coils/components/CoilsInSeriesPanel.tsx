import { useState, useMemo } from "react";
import { PlusCircle, X, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  // Gás quente
  bypassFraction?: number; // 0–1: fração do fluxo de massa do compressor desviada para o reaquecedor
  // Resultados calculados
  deltaP_Pa?: number;
  Q_kcalh?: number;
  T_ar_saida?: number;
}

/** Dados do ciclo necessários para calcular a bateria de gás quente */
export interface HotGasSourceData {
  /** Temperatura de descarga do compressor (°C) — ponto 2 */
  T_discharge_C: number;
  /** Entalpia de descarga (kJ/kg) — ponto 2 */
  h_discharge_kJkg: number;
  /** Entalpia do líquido saturado na condensação (kJ/kg) — ponto 3 */
  h_condOut_kJkg: number;
  /** Vazão mássica total do compressor (kg/s) */
  m_dot_total_kgS: number;
  /** Temperatura de condensação (°C) */
  Tc_C: number;
}

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
  };
  /** Dados do ciclo para calcular a bateria de gás quente */
  hotGasSource?: HotGasSourceData;
  /** Vazão de ar do evaporador (m³/h) — para calcular ΔT ar */
  airFlowM3H?: number;
  onCoilsChange?: (coils: SeriesCoilConfig[]) => void;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `coil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Calcula a capacidade de reaquecimento por gás quente.
 *
 * Modelo: o gás quente de descarga (ponto 2, superaquecido) é desviado por
 * uma válvula de by-pass e condensa parcialmente na bateria de reaquecimento,
 * saindo como líquido saturado (ponto 3). A energia cedida ao ar é:
 *
 *   Q_hgr = bypassFraction × m_dot_total × (h_discharge − h_condOut)
 *
 * O ΔT no ar é estimado por balanço de energia:
 *   ΔT_ar = Q_hgr / (m_dot_ar × cp_ar)
 *   onde cp_ar ≈ 1.006 kJ/(kg·K) e ρ_ar ≈ 1.2 kg/m³
 */
function calcHotGasReheat(
  source: HotGasSourceData,
  bypassFraction: number,
  airFlowM3H: number,
  T_ar_in: number,
): { Q_W: number; Q_kcalh: number; T_ar_saida: number; deltaP_Pa: number } {
  const fraction = Math.max(0, Math.min(1, bypassFraction));
  const m_dot_bypass = fraction * source.m_dot_total_kgS; // kg/s
  const Q_W = m_dot_bypass * (source.h_discharge_kJkg - source.h_condOut_kJkg) * 1000; // W
  const Q_kcalh = Q_W * 0.86;

  // Balanço de energia no ar: Q = m_dot_ar × cp × ΔT
  const m_dot_ar = (airFlowM3H / 3600) * 1.2; // kg/s (ρ = 1.2 kg/m³)
  const cp_ar = 1006; // J/(kg·K)
  const deltaT_ar = m_dot_ar > 0 ? Q_W / (m_dot_ar * cp_ar) : 0;
  const T_ar_saida = T_ar_in + deltaT_ar;

  // ΔP estimado: bateria de gás quente é tipicamente 1–2 fileiras, ~15–30 Pa
  // Estimativa simples: 20 Pa base + proporcional à fração de by-pass
  const deltaP_Pa = 20 + fraction * 30;

  return { Q_W, Q_kcalh, T_ar_saida, deltaP_Pa };
}

export function CoilsInSeriesPanel({
  primaryCoilResult,
  hotGasSource,
  airFlowM3H = 5000,
  onCoilsChange,
}: CoilsInSeriesPanelProps) {
  const [additionalCoils, setAdditionalCoils] = useState<SeriesCoilConfig[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Temperatura de saída do ar do evaporador (entrada na bateria de gás quente)
  const T_ar_evap_out = primaryCoilResult?.T_ar_saida ?? 10;

  // Calcula resultados das baterias de gás quente em tempo real
  const coilsWithCalc = useMemo<SeriesCoilConfig[]>(() => {
    return additionalCoils.map((coil) => {
      if (coil.type === "hot_gas_reheat" && hotGasSource) {
        const calc = calcHotGasReheat(
          hotGasSource,
          coil.bypassFraction ?? 0.15,
          airFlowM3H,
          T_ar_evap_out,
        );
        return {
          ...coil,
          Q_kcalh: calc.Q_kcalh,
          T_ar_saida: calc.T_ar_saida,
          deltaP_Pa: calc.deltaP_Pa,
        };
      }
      return coil;
    });
  }, [additionalCoils, hotGasSource, airFlowM3H, T_ar_evap_out]);

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
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>ΔP: {primaryCoilResult.deltaP_Pa.toFixed(1)} Pa</span>
            <span>Q: {fmt(primaryCoilResult.Q_kcalh)} kcal/h</span>
            <span>T saída: {primaryCoilResult.T_ar_saida.toFixed(1)} °C</span>
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
                  <Input
                    type="number"
                    value={coil.T_water_in}
                    onChange={(e) => updateCoil(coil.id, { T_water_in: Number(e.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">T saída água (°C)</Label>
                  <Input
                    type="number"
                    value={coil.T_water_out}
                    onChange={(e) => updateCoil(coil.id, { T_water_out: Number(e.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fileiras</Label>
                  <Input
                    type="number"
                    value={coil.rows}
                    min={1}
                    max={4}
                    onChange={(e) => updateCoil(coil.id, { rows: Number(e.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Campos: elétrico */}
            {coil.type === "reheat_electric" && (
              <div>
                <Label className="text-xs">Potência (kW)</Label>
                <Input
                  type="number"
                  value={coil.powerKW}
                  step={0.5}
                  onChange={(e) => updateCoil(coil.id, { powerKW: Number(e.target.value) })}
                  className="h-7 w-32 text-xs"
                />
              </div>
            )}

            {/* Campos: gás quente */}
            {coil.type === "hot_gas_reheat" && (
              <div className="space-y-2">
                <div className="flex items-end gap-3">
                  <div>
                    <Label className="text-xs">Fração de by-pass (%)</Label>
                    <Input
                      type="number"
                      value={Math.round((coil.bypassFraction ?? 0.15) * 100)}
                      min={5}
                      max={60}
                      step={1}
                      onChange={(e) =>
                        updateCoil(coil.id, { bypassFraction: Number(e.target.value) / 100 })
                      }
                      className="h-7 w-24 text-xs"
                    />
                  </div>
                  {hotGasSource && (
                    <div className="text-xs text-muted-foreground">
                      <span>T descarga: {hotGasSource.T_discharge_C.toFixed(1)} °C</span>
                      <span className="ml-2">Tc: {hotGasSource.Tc_C.toFixed(1)} °C</span>
                    </div>
                  )}
                </div>
                {/* Resultados calculados */}
                {coil.Q_kcalh !== undefined && (
                  <div className="flex flex-wrap gap-3 rounded-md bg-orange-50 px-2 py-1 text-xs dark:bg-orange-950/30">
                    <span className="font-medium text-orange-700 dark:text-orange-400">
                      Q reaquecimento: {fmt(coil.Q_kcalh)} kcal/h
                    </span>
                    {coil.T_ar_saida !== undefined && (
                      <span className="text-muted-foreground">
                        T saída ar: {coil.T_ar_saida.toFixed(1)} °C
                      </span>
                    )}
                    {coil.deltaP_Pa !== undefined && (
                      <span className="text-muted-foreground">
                        ΔP: {coil.deltaP_Pa.toFixed(0)} Pa
                      </span>
                    )}
                    {!hotGasSource && (
                      <span className="text-amber-600 dark:text-amber-400">
                        ⚠ Execute o cálculo do ciclo para obter os resultados
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Botão adicionar */}
      {!showAddMenu ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setShowAddMenu(true)}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar coil em série
        </Button>
      ) : (
        <div className="space-y-1 rounded-md border bg-muted/30 p-2">
          <p className="mb-2 text-xs font-medium">Selecionar tipo de coil:</p>
          {(
            [
              "reheat_hot_water",
              "reheat_electric",
              "hot_gas_reheat",
              "precool_chilled_water",
            ] as CoilType[]
          ).map((type) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => addCoil(type)}
            >
              {type === "hot_gas_reheat" && (
                <Flame className="mr-2 h-3 w-3 text-orange-500" />
              )}
              {coilTypeLabels[type]}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowAddMenu(false)}
          >
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  );
}
