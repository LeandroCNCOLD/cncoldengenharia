import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play } from "lucide-react";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

const REFRIGERANT_OPTIONS = [
  "R404A", "R507A", "R134a", "R22", "R410A",
  "R448A", "R449A", "R452A", "R290", "R32", "R717", "R744",
];

export interface SimulationParams {
  refrigerantId: string;
  Te_C: number;
  Tc_C: number;
  superheatK: number;
  subcoolingK: number;
}

interface Props {
  equipment: CatalogEquipmentRow | null;
  isRunning: boolean;
  errorMessage?: string | null;
  onSimulate: (params: SimulationParams) => void;
}

export function CatalogSimulationPanel({
  equipment,
  isRunning,
  errorMessage,
  onSimulate,
}: Props) {
  const [mode, setMode] = useState<"catalog" | "custom">("catalog");
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(45);
  const [superheat, setSuperheat] = useState(5);
  const [subcooling, setSubcooling] = useState(5);

  // Pré-preencher quando o equipamento mudar
  useEffect(() => {
    if (!equipment) return;
    const ref =
      equipment.refrigerante && equipment.refrigerante !== "unknown"
        ? equipment.refrigerante
        : "R404A";
    setRefrigerantId(ref);
    if (equipment.tempEvaporacaoC !== undefined) setTe(equipment.tempEvaporacaoC);
    if (equipment.tempCondensacaoC !== undefined) setTc(equipment.tempCondensacaoC);
    setSuperheat(equipment.superaquecimentoUtilK ?? 5);
    setSubcooling(equipment.subresfriamentoK ?? 5);
    setMode("catalog");
  }, [equipment]);

  if (!equipment) {
    return (
      <Card className="h-full border-dashed">
        <CardContent className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <span className="text-3xl">⬅</span>
          <p>Selecione um equipamento na lista para iniciar a simulação.</p>
        </CardContent>
      </Card>
    );
  }

  const disabled = isRunning || mode === "catalog";

  const handleSimulate = () => {
    onSimulate({
      refrigerantId,
      Te_C: te,
      Tc_C: tc,
      superheatK: superheat,
      subcoolingK: subcooling,
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Simulação — Motor V2</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {equipment.modelo}
          </Badge>
          {equipment.compressorModelo && (
            <Badge variant="outline" className="font-mono text-xs">
              {equipment.compressorModelo}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Modo */}
        <div className="flex gap-1 rounded-md border p-1">
          <button
            type="button"
            onClick={() => setMode("catalog")}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition ${
              mode === "catalog" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Condições do catálogo
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition ${
              mode === "custom" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Personalizadas
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Refrigerante</Label>
            <Select
              value={refrigerantId}
              onValueChange={setRefrigerantId}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRIGERANT_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Te (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={te}
                onChange={(e) => setTe(Number(e.target.value))}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Tc (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={tc}
                onChange={(e) => setTc(Number(e.target.value))}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Superaq. (K)</Label>
              <Input
                type="number"
                step="0.5"
                value={superheat}
                onChange={(e) => setSuperheat(Number(e.target.value))}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Subresfr. (K)</Label>
              <Input
                type="number"
                step="0.5"
                value={subcooling}
                onChange={(e) => setSubcooling(Number(e.target.value))}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
            <strong>Compressor:</strong>{" "}
            {equipment.compressorModelo ?? "auto-selecionado pelo motor"}
          </div>
        </div>

        <Button
          onClick={handleSimulate}
          disabled={isRunning}
          className="w-full"
          size="sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Simular com Motor V2
            </>
          )}
        </Button>

        {errorMessage && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <p className="text-[10px] leading-snug text-muted-foreground">
          O motor CycleEngine V2 simula o ciclo termodinâmico completo. Desvios
          de ±5% são esperados devido a simplificações do modelo. Desvios acima
          de ±15% indicam possível inconsistência nos dados do catálogo.
        </p>
      </CardContent>
    </Card>
  );
}
