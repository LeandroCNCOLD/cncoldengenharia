/**
 * PerformanceCurveTabContent — Aba 3 do Hub de Testes
 * Curva de Desempenho usando o productPerformanceCurveEngine real.
 * Reutiliza o hook usePerformanceCurve e os componentes existentes.
 */
import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompressorForm } from "../../components/forms/CompressorForm";
import { CondenserForm } from "../../components/forms/CondenserForm";
import { SystemConditionsForm, type SystemConditions } from "../../components/forms/SystemConditionsForm";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ModeGate } from "../../components/mode/ModeGate";
import { WarningBanner } from "../../components/ui/WarningBanner";
import { PerformanceCurveChart } from "../../components/charts/PerformanceCurveChart";
import { usePerformanceCurve } from "../../hooks/usePerformanceCurve";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { buildMotorComponentsFromCatalog } from "@/modules/coldpro_catalog/adapters/sessionToMotorInputAdapter";
import { useCatalogRevisionStore } from "@/modules/coldpro_catalog/store/useCatalogRevisionStore";

export function PerformanceCurveTabContent() {
  const { result, isCalculating, calculate } = usePerformanceCurve();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});

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
      conditions.required_airflow_m3_h,
  );

  const handleRun = () => {
    if (!canRun) return;
    calculate({
      system: {
        compressor: compressor as CompressorSpec,
        condenser: condenser as CondenserSpec,
        system_conditions: {
          ambient_temp_c: conditions.ambient_temp_c!,
          required_airflow_m3_h: conditions.required_airflow_m3_h!,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
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
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleRun}
          disabled={!canRun || isCalculating}
          className="gap-2 bg-[#1E6FD9] hover:bg-[#1a5fb8]"
        >
          {isCalculating ? <LoadingSpinner size="sm" /> : <Play className="h-4 w-4" />}
          Gerar Curva
        </Button>
      </div>

      {result && (
        <ModeGate>
          <div className="space-y-4">
            {result.warnings && result.warnings.length > 0 && (
              <WarningBanner warnings={result.warnings} />
            )}
            <PerformanceCurveChart result={result} />
          </div>
        </ModeGate>
      )}
    </div>
  );
}
