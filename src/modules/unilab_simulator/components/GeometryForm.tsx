import { useMemo, useState } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  CoilGeometryCatalogItem,
  FinPitchItem,
  FinThicknessItem,
  TubeMaterialItem,
} from "../types/unilab.types";
import {
  TIPO_SERPENTINA_VALUES,
  filterCoilGeometries,
  getCoilGeometryById,
  listMissingPhysicalFields,
  type CoilGeometryItem,
  type TipoSerpentina,
} from "../services/coilGeometryCatalogService";
import { ptBR } from "../i18n/messages.ptBR";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";

interface GeometryFormProps {
  geometries: CoilGeometryCatalogItem[];
  tubeMaterials: TubeMaterialItem[];
  finPitches: FinPitchItem[];
  finThicknesses: FinThicknessItem[];
  disabled?: boolean;
}

/**
 * Aceita tanto a lista enriquecida (CoilGeometryItem) quanto a base
 * (CoilGeometryCatalogItem). Quando vier base, os campos pt-BR ficam null
 * e o card de diagnóstico avisa.
 */
function asGeometryItem(g: CoilGeometryCatalogItem): CoilGeometryItem {
  // Se já vem enriquecido, mantém. Senão, completa com nulls.
  const maybe = g as Partial<CoilGeometryItem> & CoilGeometryCatalogItem;
  if (maybe.tipo_serpentina !== undefined) return maybe as CoilGeometryItem;
  return {
    ...g,
    tipo_serpentina: null,
    descricao: g.name,
    codigo: g.id,
    passo_fileiras_mm: g.tubePitchLongitudinalMm ?? null,
    passo_tubos_mm: g.tubePitchTransverseMm ?? null,
    diametro_externo_tubo_mm: g.tubeOuterDiameterMm ?? null,
    diametro_interno_tubo_mm: g.tubeInnerDiameterMm ?? null,
    espessura_tubo_mm: null,
    espessura_aleta_mm: null,
    forma_aleta: null,
    tipo_bateria: null,
    fator_correcao_aleta: null,
    fator_atrito_ar: null,
    razao_superficies_internas: null,
    tubo_liso: null,
    certificacao_ahri: null,
    certificacao_eurovent: null,
  };
}

export function GeometryForm({
  geometries,
  tubeMaterials,
  finPitches,
  finThicknesses,
  disabled,
}: GeometryFormProps) {
  const physical = useUnilabSimulationStore((s) => s.physicalInputs);
  const setPhysical = useUnilabSimulationStore((s) => s.setPhysicalInputs);
  const setSelectedGeometry = useUnilabSimulationStore((s) => s.setSelectedGeometry);
  const f = ptBR.workspace.fields;

  const enriched = useMemo(() => geometries.map(asGeometryItem), [geometries]);

  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<TipoSerpentina | "">("");

  const filtered = useMemo(
    () => filterCoilGeometries(enriched, search, tipo === "" ? undefined : tipo),
    [enriched, search, tipo],
  );

  const selected = getCoilGeometryById(enriched, physical.geometryId);
  const missing = selected ? listMissingPhysicalFields(selected) : [];

  const handleGeometryChange = (id: string | undefined) => {
    const geo = id ? getCoilGeometryById(enriched, id) : undefined;
    setSelectedGeometry(geo);
  };

  const fromGeometryDisabled = disabled || !!selected;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {/* Filtro por tipo de serpentina */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Tipo de serpentina
          </label>
          <select
            value={tipo}
            disabled={disabled}
            onChange={(e) => setTipo(e.target.value as TipoSerpentina | "")}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Todos os tipos</option>
            {TIPO_SERPENTINA_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Buscar geometria
          </label>
          <input
            type="text"
            value={search}
            disabled={disabled}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, descrição ou código…"
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>
      </div>

      <SelectField
        label={`${f.geometry} (${filtered.length} de ${enriched.length})`}
        value={physical.geometryId}
        options={filtered.slice(0, 500).map((g) => ({
          value: g.id,
          label: `${g.descricao}${g.tipo_serpentina ? ` · ${g.tipo_serpentina}` : ""}`,
        }))}
        onChange={handleGeometryChange}
        disabled={disabled}
        placeholder={
          filtered.length === 0
            ? "Nenhuma geometria com esses filtros"
            : "Selecione uma geometria…"
        }
      />
      {filtered.length > 500 && (
        <p className="text-[11px] text-slate-500">
          Exibindo as primeiras 500 geometrias. Refine a busca para ver outras.
        </p>
      )}

      {/* Card de diagnóstico */}
      {selected && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-emerald-900">
                Geometria carregada
              </p>
              <p className="mt-0.5 text-emerald-800">
                <span className="font-medium">ID:</span> {selected.id}
              </p>
              <p className="text-emerald-800">
                <span className="font-medium">Descrição:</span> {selected.descricao}
              </p>
              <p className="text-emerald-800">
                <span className="font-medium">Tipo de serpentina:</span>{" "}
                {selected.tipo_serpentina ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleGeometryChange(undefined)}
              className="text-[11px] text-emerald-900 underline hover:text-emerald-700"
              disabled={disabled}
            >
              Limpar
            </button>
          </div>
          {missing.length > 0 && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
              <p className="font-semibold">Campos ausentes na geometria:</p>
              <p className="mt-0.5">{missing.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {/* Campos físicos vindos da geometria (read-only) */}
      {selected && (
        <fieldset className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Campos da geometria (somente leitura)
          </legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <ReadOnlyRow label="Passo de fileiras" value={selected.passo_fileiras_mm} unit="mm" />
            <ReadOnlyRow label="Passo de tubos" value={selected.passo_tubos_mm} unit="mm" />
            <ReadOnlyRow label="Ø externo do tubo" value={selected.diametro_externo_tubo_mm} unit="mm" />
            <ReadOnlyRow label="Ø interno do tubo" value={selected.diametro_interno_tubo_mm} unit="mm" />
            <ReadOnlyRow label="Espessura do tubo" value={selected.espessura_tubo_mm} unit="mm" />
            <ReadOnlyRow label="Espessura da aleta" value={selected.espessura_aleta_mm} unit="mm" />
            <ReadOnlyRow label="Forma da aleta" value={selected.forma_aleta} />
            <ReadOnlyRow label="Tipo de bateria" value={selected.tipo_bateria} />
            <ReadOnlyRow label="Fator de correção (aleta)" value={selected.fator_correcao_aleta} />
            <ReadOnlyRow label="Fator de atrito (ar)" value={selected.fator_atrito_ar} />
            <ReadOnlyRow label="Razão sup. internas" value={selected.razao_superficies_internas} />
            <ReadOnlyRow label="Tubo liso" value={fmtBool(selected.tubo_liso)} />
            <ReadOnlyRow label="Certificação AHRI" value={fmtBool(selected.certificacao_ahri)} />
            <ReadOnlyRow label="Certificação Eurovent" value={fmtBool(selected.certificacao_eurovent)} />
          </div>
        </fieldset>
      )}

      {/* Campos complementares manuais */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={f.finnedHeight}
          unit="mm"
          value={physical.finnedHeightMm}
          onChange={(v) => setPhysical({ finnedHeightMm: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.finnedLength}
          unit="mm"
          value={physical.finnedLengthMm}
          onChange={(v) => setPhysical({ finnedLengthMm: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.rows}
          value={physical.rows}
          onChange={(v) => setPhysical({ rows: v })}
          step={1}
          min={1}
          disabled={disabled}
        />
        <NumberField
          label={f.circuits}
          value={physical.circuits}
          onChange={(v) => setPhysical({ circuits: v })}
          step={1}
          min={1}
          disabled={disabled}
        />
      </div>

      <SelectField
        label={f.tubeMaterial}
        value={physical.tubeMaterialId}
        options={tubeMaterials.map((m) => ({ value: m.id, label: m.name }))}
        onChange={(v) => setPhysical({ tubeMaterialId: v })}
        disabled={disabled}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={f.finPitch}
          value={
            physical.finPitchMm !== undefined ? String(physical.finPitchMm) : undefined
          }
          options={finPitches.map((p) => ({
            value: String(p.pitchMm),
            label: p.label ?? `${p.pitchMm} mm`,
          }))}
          onChange={(v) =>
            setPhysical({ finPitchMm: v === undefined ? undefined : Number(v) })
          }
          disabled={disabled}
        />
        <SelectField
          label={f.finThickness}
          value={
            physical.finThicknessMm !== undefined
              ? String(physical.finThicknessMm)
              : undefined
          }
          options={finThicknesses.map((p) => ({
            value: String(p.thicknessMm),
            label: p.label ?? `${p.thicknessMm} mm`,
          }))}
          onChange={(v) =>
            setPhysical({ finThicknessMm: v === undefined ? undefined : Number(v) })
          }
          disabled={disabled}
        />
        {/* Campos de tubo: read-only quando vindos da geometria, editáveis se nenhuma */}
        <NumberField
          label={f.tubePitchTransverse}
          unit="mm"
          value={physical.tubePitchTransverseMm}
          onChange={(v) => setPhysical({ tubePitchTransverseMm: v })}
          disabled={fromGeometryDisabled}
        />
        <NumberField
          label={f.tubePitchLongitudinal}
          unit="mm"
          value={physical.tubePitchLongitudinalMm}
          onChange={(v) => setPhysical({ tubePitchLongitudinalMm: v })}
          disabled={fromGeometryDisabled}
        />
        <NumberField
          label={f.tubeOuterDiameter}
          unit="mm"
          value={physical.tubeOuterDiameterMm}
          onChange={(v) => setPhysical({ tubeOuterDiameterMm: v })}
          disabled={fromGeometryDisabled}
        />
        <NumberField
          label={f.tubeInnerDiameter}
          unit="mm"
          value={physical.tubeInnerDiameterMm}
          onChange={(v) => setPhysical({ tubeInnerDiameterMm: v })}
          disabled={fromGeometryDisabled}
        />
      </div>
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? `${Number.isInteger(value) ? value : value.toFixed(2)}${unit ? ` ${unit}` : ""}`
        : String(value);
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 py-0.5 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-medium text-slate-800">{display}</span>
    </div>
  );
}

function fmtBool(v: boolean | null): string | null {
  if (v === null) return null;
  return v ? "Sim" : "Não";
}
