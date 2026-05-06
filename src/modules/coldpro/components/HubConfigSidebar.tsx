/**
 * HubConfigSidebar.tsx
 *
 * Painel lateral persistente do Hub de Testes.
 * Exibe a máquina selecionada + formulários de compressor/condensador/
 * evaporador/condições sempre visíveis e editáveis.
 *
 * Lê e escreve diretamente no useTestHubStore — qualquer alteração
 * propaga automaticamente para todas as abas.
 */

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Settings2, Cpu, Thermometer, Wind, Gauge, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTestHubStore } from "../stores/useTestHubStore";
import { CompressorForm } from "./forms/CompressorForm";
import { CondenserForm } from "./forms/CondenserForm";
import { EvaporatorForm } from "./forms/EvaporatorForm";
import { SystemConditionsForm } from "./forms/SystemConditionsForm";
import { CapacityDisplay } from "./ui/CapacityDisplay";

// ── Seção colapsável ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isComplete: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ConfigSection({ title, icon: Icon, color, isComplete, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-slate-100 ${color}`}
        >
          <span className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            {title}
          </span>
          <span className="flex items-center gap-1.5">
            {isComplete && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            {open ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-xs [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0 [&_section]:shadow-none [&_h3]:hidden">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Sidebar principal ─────────────────────────────────────────────────────────

export function HubConfigSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    selectedMachine,
    compressor, condenser, evaporator, conditions,
    setCompressor, setCondenser, setEvaporator, setConditions,
    clearMachine, isConfigured,
  } = useTestHubStore();

  const hasCompressor = !!(compressor.cooling_capacity_w && compressor.refrigerant);
  const hasCondenser = !!(condenser.heat_rejection_capacity_w);
  const hasEvaporator = !!(evaporator.T_evaporating_c !== undefined || evaporator.airflow_m3_h);
  const hasConditions = !!(conditions.ambient_temp_c !== undefined);

  const Q_W = compressor.cooling_capacity_w ?? 0;

  const handleClearMachine = useCallback(() => {
    clearMachine();
  }, [clearMachine]);

  // ── Modo colapsado: apenas ícone ─────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title="Expandir configuração"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-2 flex flex-col items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-400" />
          <div className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-amber-400"}`} />
        </div>
      </div>
    );
  }

  // ── Modo expandido ────────────────────────────────────────────────────────
  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Settings2 className="h-3.5 w-3.5 text-[#1E6FD9]" />
          Configuração
        </span>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={`h-5 px-1.5 text-[10px] ${
              isConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {isConfigured ? "Pronto" : "Incompleto"}
          </Badge>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Recolher"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1.5 p-2">

          {/* Máquina selecionada */}
          {selectedMachine && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-blue-800">
                    {selectedMachine.modelo}
                  </p>
                  <p className="mt-0.5 text-[10px] text-blue-600">
                    {selectedMachine.refrigerante} · {selectedMachine.linha}
                  </p>
                </div>
                <button
                  onClick={handleClearMachine}
                  className="shrink-0 rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
                  title="Limpar seleção"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {Q_W > 0 && (
                <div className="mt-2 border-t border-blue-100 pt-2">
                  <CapacityDisplay watts={Q_W} compact />
                </div>
              )}
            </div>
          )}

          {/* Compressor */}
          <ConfigSection
            title="Compressor"
            icon={Cpu}
            color="text-slate-700"
            isComplete={hasCompressor}
            defaultOpen={!hasCompressor}
          >
            <CompressorForm value={compressor} onChange={setCompressor} />
          </ConfigSection>

          {/* Condensador */}
          <ConfigSection
            title="Condensador"
            icon={Thermometer}
            color="text-slate-700"
            isComplete={hasCondenser}
            defaultOpen={false}
          >
            <CondenserForm value={condenser} onChange={setCondenser} />
          </ConfigSection>

          {/* Evaporador */}
          <ConfigSection
            title="Evaporador"
            icon={Wind}
            color="text-slate-700"
            isComplete={hasEvaporator}
            defaultOpen={false}
          >
            <EvaporatorForm value={evaporator} onChange={setEvaporator} />
          </ConfigSection>

          {/* Condições */}
          <ConfigSection
            title="Condições Operacionais"
            icon={Gauge}
            color="text-slate-700"
            isComplete={hasConditions}
            defaultOpen={false}
          >
            <SystemConditionsForm value={conditions} onChange={setConditions} />
          </ConfigSection>

        </div>
      </ScrollArea>
    </div>
  );
}
