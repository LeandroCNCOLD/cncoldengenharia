/**
 * SystemConfigTabContent — Aba 1 do Hub de Testes
 *
 * Permite ao engenheiro configurar o sistema completo:
 * - Importar do Catálogo (via useCatalogSessionStore)
 * - Ou preencher manualmente os formulários de compressor, evaporador e condensador
 *
 * Ao concluir, chama onDone() para avançar para a aba de Equilíbrio.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CompressorForm } from "../../components/forms/CompressorForm";
import { CondenserForm } from "../../components/forms/CondenserForm";
import {
  EvaporatorForm,
  type EvaporatorFormValue,
} from "../../components/forms/EvaporatorForm";
import { SystemConditionsForm, type SystemConditions } from "../../components/forms/SystemConditionsForm";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";

interface Props {
  onDone: () => void;
}

export function SystemConfigTabContent({ onDone }: Props) {
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [evaporator, setEvaporator] = useState<EvaporatorFormValue>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});

  const {
    selectedCompressor,
    selectedCondenser,
    selectedEvaporator,
    clearSelection,
  } = useCatalogSessionStore();

  const hasCompressor = Boolean(selectedCompressor || compressor.cooling_capacity_w);
  const hasEvaporator = Boolean(selectedEvaporator || evaporator.rows_total);
  const hasCondenser = Boolean(selectedCondenser || condenser.heat_rejection_capacity_w);
  const isReady = hasCompressor && hasEvaporator && hasCondenser;

  return (
    <div className="space-y-6">
      {/* Banner de importação do catálogo */}
      <Alert className="border-blue-200 bg-blue-50">
        <Database className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <span className="font-medium">Dica:</span> Importe os componentes diretamente do{" "}
          <Link to="/coldpro/catalog" className="underline hover:text-blue-900">
            Catálogo & Seleção
          </Link>{" "}
          para preencher automaticamente os formulários abaixo.
          {(selectedCompressor || selectedCondenser || selectedEvaporator) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-3 h-auto p-0 text-xs text-blue-600 underline hover:text-blue-800"
              onClick={() => clearSelection()}
            >
              Limpar seleção do catálogo
            </Button>
          )}
        </AlertDescription>
      </Alert>

      {/* Status dos componentes */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Compressor", ok: hasCompressor, source: selectedCompressor?.name },
          { label: "Evaporador", ok: hasEvaporator, source: selectedEvaporator?.name },
          { label: "Condensador", ok: hasCondenser, source: selectedCondenser?.name },
        ].map(({ label, ok, source }) => (
          <Card key={label} className={`border ${ok ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
            <CardContent className="flex items-center gap-2 p-3">
              {ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700">{label}</p>
                {source && (
                  <p className="truncate text-[10px] text-slate-500">{source}</p>
                )}
                {!ok && (
                  <p className="text-[10px] text-slate-400">Não configurado</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Formulários manuais */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Compressor</CardTitle>
            <CardDescription className="text-xs">
              Polinômios ARI 540 / EN12900 são usados automaticamente se disponíveis no catálogo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompressorForm value={compressor} onChange={setCompressor} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Condensador</CardTitle>
            <CardDescription className="text-xs">
              Capacidade de rejeição de calor e temperatura máxima de condensação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CondenserForm value={condenser} onChange={setCondenser} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Evaporador</CardTitle>
            <CardDescription className="text-xs">
              Geometria da serpentina. O motor usa os fatores de correção do UNILAB
              (FatCorAl, FatCoeflattub, FatRidAumSup) automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvaporatorForm value={evaporator} onChange={setEvaporator} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Condições de Operação</CardTitle>
            <CardDescription className="text-xs">
              Temperatura ambiente, vazão de ar e condições de projeto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemConditionsForm value={conditions} onChange={setConditions} />
          </CardContent>
        </Card>
      </div>

      {/* Botão avançar */}
      <div className="flex justify-end">
        <Button
          onClick={onDone}
          disabled={!isReady}
          className="gap-2 bg-[#1E6FD9] hover:bg-[#1a5fb8]"
        >
          Avançar para Equilíbrio
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
