import { useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CoilType =
  | "evaporator_dx"
  | "reheat_hot_water"
  | "reheat_electric"
  | "precool_chilled_water";

export interface SeriesCoilConfig {
  id: string;
  type: CoilType;
  label: string;
  T_water_in?: number;
  T_water_out?: number;
  rows?: number;
  geometryId?: string;
  powerKW?: number;
  deltaP_Pa?: number;
  Q_kcalh?: number;
  T_ar_saida?: number;
}

const coilTypeLabels: Record<CoilType, string> = {
  evaporator_dx: "Evaporador DX",
  reheat_hot_water: "Bateria de Reaquecimento (água quente)",
  reheat_electric: "Bateria de Aquecimento Elétrico",
  precool_chilled_water: "Bateria de Pré-resfriamento (água gelada)",
};

interface CoilsInSeriesPanelProps {
  primaryCoilResult?: { deltaP_Pa: number; Q_kcalh: number; T_ar_saida: number };
  onCoilsChange?: (coils: SeriesCoilConfig[]) => void;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `coil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CoilsInSeriesPanel({ primaryCoilResult, onCoilsChange }: CoilsInSeriesPanelProps) {
  const [additionalCoils, setAdditionalCoils] = useState<SeriesCoilConfig[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

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
    additionalCoils.reduce((sum, coil) => sum + (coil.deltaP_Pa ?? 0), 0);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Arranjo de Coils no Fluxo de Ar</h4>
        {totalDeltaP > 0 && (
          <Badge variant="outline">ΔP total: {totalDeltaP.toFixed(1)} Pa</Badge>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
        <span className="text-blue-500">❄️</span>
        <span className="flex-1 text-sm font-medium">Evaporador DX</span>
        {primaryCoilResult && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>ΔP: {primaryCoilResult.deltaP_Pa.toFixed(1)} Pa</span>
            <span>
              Q: {primaryCoilResult.Q_kcalh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kcal/h
            </span>
          </div>
        )}
        <Badge variant="secondary" className="text-xs">Principal</Badge>
      </div>

      {additionalCoils.map((coil) => (
        <div key={coil.id} className="flex items-start gap-2 rounded-md border p-2">
          <span className="mt-1 text-orange-500">🔥</span>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{coil.label}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeCoil(coil.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            {coil.type === "reheat_hot_water" && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">T entrada água (°C)</Label>
                  <Input
                    type="number"
                    value={coil.T_water_in}
                    onChange={(event) => updateCoil(coil.id, { T_water_in: Number(event.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">T saída água (°C)</Label>
                  <Input
                    type="number"
                    value={coil.T_water_out}
                    onChange={(event) => updateCoil(coil.id, { T_water_out: Number(event.target.value) })}
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
                    onChange={(event) => updateCoil(coil.id, { rows: Number(event.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}
            {coil.type === "reheat_electric" && (
              <div>
                <Label className="text-xs">Potência (kW)</Label>
                <Input
                  type="number"
                  value={coil.powerKW}
                  step={0.5}
                  onChange={(event) => updateCoil(coil.id, { powerKW: Number(event.target.value) })}
                  className="h-7 w-32 text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {!showAddMenu ? (
        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setShowAddMenu(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar coil em série
        </Button>
      ) : (
        <div className="space-y-1 rounded-md border bg-muted/30 p-2">
          <p className="mb-2 text-xs font-medium">Selecionar tipo de coil:</p>
          {(["reheat_hot_water", "reheat_electric", "precool_chilled_water"] as CoilType[]).map((type) => (
            <Button key={type} variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => addCoil(type)}>
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
