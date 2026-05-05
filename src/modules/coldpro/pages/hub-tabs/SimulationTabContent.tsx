/**
 * SimulationTabContent — Aba 2 do Hub de Testes
 * Equilíbrio do Sistema usando o systemEquilibriumEngine real (coldpro_v2).
 * Reutiliza o hook useEquilibrium e os componentes existentes.
 */
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompressorForm } from "../../components/forms/CompressorForm";
import { CondenserForm } from "../../components/forms/CondenserForm";
import {
  EvaporatorForm,
  buildEvaporatorInputFromForm,
  type EvaporatorFormValue,
} from "../../components/forms/EvaporatorForm";
import { SystemConditionsForm, type SystemConditions } from "../../components/forms/SystemConditionsForm";
import { UtilizationChart } from "../../components/charts/UtilizationChart";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ModeGate } from "../../components/mode/ModeGate";
import { WarningBanner } from "../../components/ui/WarningBanner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useEquilibrium } from "../../hooks/useEquilibrium";
import { formatCapacity, formatCOP, formatPercent } from "../../utils/formatting";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import { buildMotorComponentsFromCatalog } from "@/modules/coldpro_catalog/adapters/sessionToMotorInputAdapter";
import { useCatalogRevisionStore } from "@/modules/coldpro_catalog/store/useCatalogRevisionStore";

function isComplete(
  c: Partial<CompressorSpec>,
  cd: Partial<CondenserSpec>,
  s: Partial<SystemConditions>,
): boolean {
  return Boolean(
    c.cooling_capacity_w &&
      c.power_w &&
      c.evap_temp_c !== undefined &&
      c.cond_temp_c !== undefined &&
      c.refrigerant &&
      cd.heat_rejection_capacity_w &&
      cd.max_cond_temp_c !== undefined &&
      s.ambient_temp_c !== undefined &&
      s.required_airflow_m3_h,
  );
}

export function SimulationTabContent() {
  const { result, isCalculating, calculate } = useEquilibrium();
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [evaporator, setEvaporator] = useState<EvaporatorFormValue>({});
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

  const canRun = isComplete(compressor, condenser, conditions);

  const handleRun = () => {
    if (!canRun) return;
    const evapInput = buildEvaporatorInputFromForm(evaporator, compressor, conditions);
    calculate({
      system: {
        compressor: compressor as CompressorSpec,
        evaporator: { progressive_input: evapInput },
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
      {/* Formulários de entrada */}
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evaporador</CardTitle>
        </CardHeader>
        <CardContent>
          <EvaporatorForm value={evaporator} onChange={setEvaporator} />
        </CardContent>
      </Card>

      {/* Botão calcular */}
      <div className="flex justify-end">
        <Button
          onClick={handleRun}
          disabled={!canRun || isCalculating}
          className="gap-2 bg-[#1E6FD9] hover:bg-[#1a5fb8]"
        >
          {isCalculating ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Calcular Equilíbrio
        </Button>
      </div>

      {/* Resultados */}
      {result && (
        <ModeGate>
          <div className="space-y-4">
            {result.warnings && result.warnings.length > 0 && (
              <WarningBanner warnings={result.warnings} />
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Capacidade", value: formatCapacity(result.equilibrium_capacity_w) },
                { label: "COP Sistema", value: formatCOP(result.cop_system) },
                { label: "Te Equilíbrio", value: `${result.equilibrium_evap_temp_c?.toFixed(1) ?? "—"} °C` },
                { label: "Utilização", value: formatPercent(result.utilization_ratio) },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="text-lg font-bold text-slate-800">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <StatusBadge status={result.status} />
            <UtilizationChart result={result} />
          </div>
        </ModeGate>
      )}
    </div>
  );
}
