/**
 * OperatingMapTabContent — Aba 4 do Hub de Testes
 * Mapa Operacional usando o operatingMapEngine real (coldpro_v2).
 * Reutiliza o hook useOperatingMap e os componentes existentes.
 */
import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompressorForm } from "../../components/forms/CompressorForm";
import { CondenserForm } from "../../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../../components/forms/SystemConditionsForm";
import { OperatingGridForm, type GridConfig } from "../../components/forms/OperatingGridForm";
import { buildMinimalEvaporatorInput } from "../../components/forms/EvaporatorForm";
import { OperatingMapChart } from "../../components/charts/OperatingMapChart";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ModeGate } from "../../components/mode/ModeGate";
import { WarningBanner } from "../../components/ui/WarningBanner";
import { useOperatingMap } from "../../hooks/useOperatingMap";
import { formatCapacity, formatCOP, formatTemp } from "../../utils/formatting";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { buildMotorComponentsFromCatalog } from "@/modules/coldpro_catalog/adapters/sessionToMotorInputAdapter";
import { useCatalogRevisionStore } from "@/modules/coldpro_catalog/store/useCatalogRevisionStore";

export function OperatingMapTabContent() {
  const { result, isCalculating, calculate } = useOperatingMap();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    evap_temps: [-20, -15, -10, -5, 0, 5],
    cond_temps: [25, 30, 35, 40, 45, 50, 55],
  });

  const { selectedCompressor, selectedCondenser, selectedEvaporator } =
    useCatalogSessionStore();
  const revision = useCatalogRevisionStore((s) => s.revision);
  const lastRevisionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (revision === lastRevisionRef.current) return;
    lastRevisionRef.current = revision;
    const { compressorSpec, condenserSpec } = buildMotorComponentsFromCatalog({
      selectedCompressor,
      selectedCondenser,
      selectedEvaporator,
      selectedReheatCoil: null,
    });
    if (compressorSpec) setCompressor(compressorSpec);
    if (condenserSpec) setCondenser(condenserSpec);
  }, [revision, selectedCompressor, selectedCondenser, selectedEvaporator]);

  const canRun = Boolean(
    compressor.cooling_capacity_w &&
      compressor.power_w &&
      compressor.evap_temp_c !== undefined &&
      compressor.cond_temp_c !== undefined &&
      compressor.refrigerant &&
      condenser.heat_rejection_capacity_w &&
      condenser.max_cond_temp_c !== undefined &&
      conditions.ambient_temp_c !== undefined &&
      conditions.required_airflow_m3_h &&
      gridConfig.evap_temps.length > 0 &&
      gridConfig.cond_temps.length > 0,
  );

  const handleRun = () => {
    if (!canRun) return;
    calculate({
      system: {
        compressor: compressor as CompressorSpec,
        evaporator: { progressive_input: buildMinimalEvaporatorInput(compressor, conditions) },
        condenser: condenser as CondenserSpec,
        system_conditions: {
          ambient_temp_c: conditions.ambient_temp_c!,
          required_airflow_m3_h: conditions.required_airflow_m3_h!,
        },
      },
      grid: gridConfig,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Compressor</CardTitle>
          </CardHeader>
          <CardContent>
            <CompressorForm value={compressor} onChange={setCompressor} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Condensador</CardTitle>
          </CardHeader>
          <CardContent>
            <CondenserForm value={condenser} onChange={setCondenser} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Condições</CardTitle>
          </CardHeader>
          <CardContent>
            <SystemConditionsForm value={conditions} onChange={setConditions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grade de Pontos</CardTitle>
          </CardHeader>
          <CardContent>
            <OperatingGridForm value={gridConfig} onChange={setGridConfig} />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleRun}
          disabled={!canRun || isCalculating}
          className="gap-2 bg-[#1E6FD9] hover:bg-[#1a5fb8]"
        >
          {isCalculating ? <LoadingSpinner size="sm" /> : <Play className="h-4 w-4" />}
          Gerar Mapa
        </Button>
      </div>

      {result?.success && result.data && (
        <ModeGate>
          <div className="space-y-4">
            {result.data.warnings && result.data.warnings.length > 0 && (
              <WarningBanner warnings={result.data.warnings} />
            )}
            <OperatingMapChart result={result.data} />
            {result.data.design_point && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ponto de Projeto — Capacidade", value: formatCapacity(result.data.design_point.capacity_w) },
                  { label: "COP no Ponto de Projeto", value: formatCOP(result.data.design_point.cop) },
                  { label: "Te Equilíbrio", value: formatTemp(result.data.design_point.evap_temp_c) },
                ].map(({ label, value }) => (
                  <Card key={label}>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="text-base font-bold text-slate-800">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ModeGate>
      )}
    </div>
  );
}
