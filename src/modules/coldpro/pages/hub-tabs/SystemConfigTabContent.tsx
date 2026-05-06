/**
 * SystemConfigTabContent — Aba 1 do Hub de Testes
 *
 * Permite ao engenheiro configurar o sistema completo:
 * - Selecionar uma máquina do catálogo CN COLD (busca inline)
 *   → auto-preenche compressor, evaporador, condensador e condições
 * - Ou preencher manualmente os formulários
 *
 * Ao concluir, chama onDone() para avançar para a aba de Equilíbrio.
 */
import { useState, useMemo } from "react";
import { ArrowRight, Search, CheckCircle2, AlertCircle, X, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { CompressorForm } from "../../components/forms/CompressorForm";
import { CondenserForm } from "../../components/forms/CondenserForm";
import {
  EvaporatorForm,
  type EvaporatorFormValue,
} from "../../components/forms/EvaporatorForm";
import { SystemConditionsForm, type SystemConditions } from "../../components/forms/SystemConditionsForm";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";
import type { CompressorSpec, CondenserSpec } from "@/modules/coldpro_v2";
import { getEquipmentCatalog } from "@/modules/coldpro_catalog/data/equipmentCatalog.index";
import type { CatalogEquipmentRow } from "@/modules/coldpro_catalog/data/equipmentCatalog.types";
import { catalogToCompressorSpec } from "@/modules/coldpro_catalog/adapters/compressorAdapter";
import { catalogToCondenserSpec } from "@/modules/coldpro_catalog/adapters/condenserAdapter";

interface Props {
  onDone: () => void;
}

// ── Converte CatalogEquipmentRow → EvaporatorFormValue ────────────────────────
function catalogToEvaporatorFormValue(row: CatalogEquipmentRow): EvaporatorFormValue {
  return {
    T_evaporating_c: row.tempEvaporacaoC ?? -10,
    airflow_m3_h: row.vazaoArEvaporadorM3H,
    air_temperature_in_c: row.tempCamaraC ?? row.tempAmbienteC,
    air_relative_humidity_in: row.umidadeCamaraPercent != null
      ? row.umidadeCamaraPercent / 100
      : undefined,
    tube_outer_diameter_mm: row.evaporadorTuboDiametroMm,
    tube_inner_diameter_mm: row.evaporadorTubeInnerDiameterMm,
    tube_pitch_transverse_mm: row.evaporadorTubePitchTransverseMm,
    tube_pitch_longitudinal_mm: row.evaporadorTubePitchLongitudinalMm,
    fin_height_mm: row.evaporadorFinHeightMm,
    fin_thickness_mm: row.evaporadorFinThicknessMm ?? 0.12,
    coil_width_m: row.evaporadorCoilWidthM,
    coil_height_m: row.evaporadorCoilHeightM,
    fin_spacing_mm: row.evaporadorFinSpacingMm,
    rows_total: row.evaporadorRows,
    tube_material: "copper",
    fin_material: "aluminum",
  };
}

// ── Converte CatalogEquipmentRow → SystemConditions ───────────────────────────
// SystemConditions só tem: ambient_temp_c, required_airflow_m3_h
function catalogToSystemConditions(row: CatalogEquipmentRow): Partial<SystemConditions> {
  return {
    ambient_temp_c: row.tempAmbienteC ?? 35,
    required_airflow_m3_h: row.vazaoArEvaporadorM3H,
  };
}

// ── Componente de busca e seleção de máquina ──────────────────────────────────
function CatalogMachinePicker({
  onSelect,
  selectedId,
}: {
  onSelect: (row: CatalogEquipmentRow) => void;
  selectedId?: string;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  const catalog = useMemo(() => getEquipmentCatalog(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog.slice(0, 50);
    const q = search.toLowerCase();
    return catalog
      .filter(
        (r) =>
          r.modelo?.toLowerCase().includes(q) ||
          r.modeloBaseReferencia?.toLowerCase().includes(q) ||
          r.compressorModelo?.toLowerCase().includes(q) ||
          r.refrigerante?.toLowerCase().includes(q) ||
          r.linha?.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [catalog, search]);

  return (
    <Card className="border-[#1E6FD9]/30 bg-blue-50/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1E6FD9]" />
            <CardTitle className="text-sm text-[#1E6FD9]">
              Selecionar Máquina do Catálogo
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {catalog.length} equipamentos
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-slate-500"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <CardDescription className="text-xs">
          Selecione uma máquina para preencher automaticamente todos os campos abaixo.
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, compressor, refrigerante..."
              className="h-8 pl-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tabela de resultados */}
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Linha</th>
                  <th className="px-3 py-2 text-left">Fluido</th>
                  <th className="px-3 py-2 text-right">Cap. kcal/h</th>
                  <th className="px-3 py-2 text-right">COP</th>
                  <th className="px-3 py-2 text-right">Te °C</th>
                  <th className="px-3 py-2 text-right">Tc °C</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                      Nenhum equipamento encontrado
                    </td>
                  </tr>
                )}
                {filtered.map((row) => {
                  const isSelected = row.id === selectedId;
                  const cap = row.capacidadeFrigorificaKcalH ?? row.capacidadeCompressorKcalH;
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-slate-100 hover:bg-blue-50/60 ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-slate-800">
                          {row.modeloBaseReferencia ?? row.modelo}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {row.compressorModelo ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="max-w-[120px] truncate block text-slate-600">
                          {row.linha?.replace(/\[.*?\]/, "").trim() ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {row.refrigerante ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        {cap != null ? cap.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        {row.cop != null ? row.cop.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        {row.tempEvaporacaoC != null ? row.tempEvaporacaoC.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        {row.tempCondensacaoC != null ? row.tempCondensacaoC.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className={`h-6 px-2 text-[10px] ${
                            isSelected
                              ? "bg-[#1E6FD9] hover:bg-[#1a5fb8]"
                              : "hover:border-[#1E6FD9] hover:text-[#1E6FD9]"
                          }`}
                          onClick={() => onSelect(row)}
                        >
                          {isSelected ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" />Selecionado</>
                          ) : (
                            "Selecionar"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!search && catalog.length > 50 && (
              <p className="px-3 py-2 text-center text-[10px] text-slate-400">
                Mostrando 50 de {catalog.length}. Use a busca para filtrar.
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function SystemConfigTabContent({ onDone }: Props) {
  const [compressor, setCompressor] = useState<Partial<CompressorSpec>>({ refrigerant: "R404A" });
  const [condenser, setCondenser] = useState<Partial<CondenserSpec>>({});
  const [evaporator, setEvaporator] = useState<EvaporatorFormValue>({});
  const [conditions, setConditions] = useState<Partial<SystemConditions>>({});
  const [selectedMachineId, setSelectedMachineId] = useState<string | undefined>();
  const [catalogSource, setCatalogSource] = useState<string | undefined>();

  const {
    selectedCompressor,
    selectedCondenser,
    selectedEvaporator,
    setCompressor: storeSetCompressor,
    setCondenser: storeSetCondenser,
    setEvaporator: storeSetEvaporator,
    clearSelection,
  } = useCatalogSessionStore();

  // Auto-preenchimento ao selecionar máquina do catálogo
  function handleMachineSelect(row: CatalogEquipmentRow) {
    setSelectedMachineId(row.id);
    setCatalogSource(row.modeloBaseReferencia ?? row.modelo);

    // Preenche o store (para compatibilidade com outras abas)
    storeSetCompressor(row);
    storeSetCondenser(row);
    storeSetEvaporator(row);

    // Preenche os formulários locais
    try {
      setCompressor(catalogToCompressorSpec(row));
    } catch {
      // Sem capacidade — mantém o formulário atual
    }
    try {
      setCondenser(catalogToCondenserSpec(row));
    } catch {
      // Sem calor rejeitado — mantém o formulário atual
    }
    setEvaporator(catalogToEvaporatorFormValue(row));
    setConditions(catalogToSystemConditions(row));
  }

  function handleClearCatalog() {
    setSelectedMachineId(undefined);
    setCatalogSource(undefined);
    clearSelection();
    setCompressor({ refrigerant: "R404A" });
    setCondenser({});
    setEvaporator({});
    setConditions({});
  }

  const hasCompressor = Boolean(selectedCompressor || compressor.cooling_capacity_w);
  const hasEvaporator = Boolean(selectedEvaporator || evaporator.rows_total);
  const hasCondenser = Boolean(selectedCondenser || condenser.heat_rejection_capacity_w);
  const isReady = hasCompressor && hasEvaporator && hasCondenser;

  return (
    <div className="space-y-5">
      {/* Seletor de máquina do catálogo */}
      <CatalogMachinePicker
        onSelect={handleMachineSelect}
        selectedId={selectedMachineId}
      />

      {/* Banner de máquina selecionada */}
      {catalogSource && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="text-sm text-emerald-800">
            Campos preenchidos automaticamente com dados de{" "}
            <strong>{catalogSource}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-auto p-0 text-xs text-emerald-600 underline hover:text-emerald-800"
            onClick={handleClearCatalog}
          >
            Limpar e preencher manualmente
          </Button>
        </div>
      )}

      {/* Status dos componentes */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Compressor", ok: hasCompressor, source: selectedCompressor?.modelo },
          { label: "Evaporador", ok: hasEvaporator, source: selectedEvaporator?.modelo },
          { label: "Condensador", ok: hasCondenser, source: selectedCondenser?.modelo },
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

      {/* Formulários (editáveis mesmo após auto-preenchimento) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Compressor</CardTitle>
              {catalogSource && hasCompressor && (
                <Badge variant="secondary" className="text-[10px]">Do catálogo</Badge>
              )}
            </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Condensador</CardTitle>
              {catalogSource && hasCondenser && (
                <Badge variant="secondary" className="text-[10px]">Do catálogo</Badge>
              )}
            </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Evaporador</CardTitle>
              {catalogSource && hasEvaporator && (
                <Badge variant="secondary" className="text-[10px]">Do catálogo</Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Geometria da serpentina. O motor usa os fatores de correção do UNILAB automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvaporatorForm value={evaporator} onChange={setEvaporator} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Condições de Operação</CardTitle>
              {catalogSource && (
                <Badge variant="secondary" className="text-[10px]">Do catálogo</Badge>
              )}
            </div>
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
