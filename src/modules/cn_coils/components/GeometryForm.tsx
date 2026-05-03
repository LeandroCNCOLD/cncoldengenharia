import { useMemo } from "react";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import type {
  CoilGeometryCatalogItem,
  FinPitchItem,
  FinThicknessItem,
  TubeMaterialItem,
} from "../types/cncoils.types";
import {
  diagnoseGeometry,
  getCoilGeometryById,
  type CoilGeometryItem,
} from "../services/coilGeometryCatalogService";
import { ptBR } from "../i18n/messages.ptBR";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import { GeometryCombobox } from "./GeometryCombobox";

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
  const physical = useCnCoilsSimulationStore((s) => s.physicalInputs);
  const setPhysical = useCnCoilsSimulationStore((s) => s.setPhysicalInputs);
  const setSelectedGeometry = useCnCoilsSimulationStore((s) => s.setSelectedGeometry);
  const f = ptBR.workspace.fields;

  const enriched = useMemo(() => geometries.map(asGeometryItem), [geometries]);

  const selected = getCoilGeometryById(enriched, physical.geometryId);
  const diagnostic = selected ? diagnoseGeometry(selected) : null;

  const handleGeometryChange = (g: CoilGeometryItem | undefined) => {
    setSelectedGeometry(g);
  };

  const fromGeometryDisabled = disabled || !!selected;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <GeometryCombobox
        geometries={enriched}
        selectedId={physical.geometryId}
        onChange={handleGeometryChange}
        disabled={disabled}
      />

      {/* Card de diagnóstico OK / INCOMPLETA */}
      {selected && diagnostic && (
        <div
          className={`rounded-md border p-3 text-xs ${
            diagnostic.status === "OK"
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`font-semibold ${
                  diagnostic.status === "OK" ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                Status:{" "}
                <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">
                  {diagnostic.status}
                </span>
              </p>
              <p className="mt-1 text-slate-700">
                <span className="font-medium">ID:</span>{" "}
                <span className="font-mono text-[11px]">{selected.id}</span>
              </p>
              <p className="text-slate-700">
                <span className="font-medium">Descrição:</span> {selected.descricao}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">Tipo:</span>{" "}
                {selected.tipo_serpentina ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleGeometryChange(undefined)}
              className="text-[11px] text-slate-700 underline hover:text-slate-900"
              disabled={disabled}
            >
              Limpar
            </button>
          </div>
          {diagnostic.warnings.length > 0 && (
            <div className="mt-2 border-t border-current/10 pt-2">
              <p className="font-semibold text-amber-900">Avisos:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-900">
                {diagnostic.warnings.slice(0, 6).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {diagnostic.warnings.length > 6 && (
                  <li className="text-amber-700">
                    +{diagnostic.warnings.length - 6} aviso(s)…
                  </li>
                )}
              </ul>
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
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 gap-y-1 text-xs">
            <ReadOnlyRow label="Passo de fileiras" value={selected.passo_fileiras_mm} unit="mm" />
            <ReadOnlyRow label="Passo de tubos" value={selected.passo_tubos_mm} unit="mm" />
            <ReadOnlyRow label="Ø externo do tubo" value={selected.diametro_externo_tubo_mm} unit="mm" />
            <ReadOnlyRow label="Ø interno do tubo" value={selected.diametro_interno_tubo_mm} unit="mm" />
            <ReadOnlyRow label="Espessura do tubo" value={selected.espessura_tubo_mm} unit="mm" />
            <ReadOnlyRow label="Espessura da aleta" value={selected.espessura_aleta_mm} unit="mm" />
            <ReadOnlyRow label="Forma da aleta" value={selected.forma_aleta} />
            <ReadOnlyRow label="Tipo de bateria" value={selected.tipo_bateria} />
            <ReadOnlyRow label="Fat. Correção Aleta" value={selected.fator_correcao_aleta} />
            <ReadOnlyRow label="Fat. Atrito Ar" value={selected.fator_atrito_ar} />
            <ReadOnlyRow label="Razão sup. internas" value={selected.razao_superficies_internas} />
            <ReadOnlyRow label="Tubo liso" value={fmtBool(selected.tubo_liso)} />
            <ReadOnlyRow label="Certificação AHRI" value={fmtBool(selected.certificacao_ahri)} />
            <ReadOnlyRow label="Certificação Eurovent" value={fmtBool(selected.certificacao_eurovent)} />
          </div>
        </fieldset>
      )}
      {/* Tipo de aleta + parâmetros condicionais */}
      <div className="space-y-3">
        <SelectField
          label="Tipo de Aleta"
          value={physical.finType ?? "plain"}
          options={[
            { value: "plain", label: "Lisa (Plain)" },
            { value: "wavy", label: "Ondulada (Wavy)" },
            { value: "louver", label: "Persianada (Louver)" },
          ]}
          onChange={(v) =>
            setPhysical({
              finType: (v ?? "plain") as "plain" | "wavy" | "louver",
            })
          }
          disabled={disabled}
        />
        {physical.finType === "louver" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Passo do Louver (L_p)"
              unit="mm"
              value={physical.L_p ?? 1.4}
              onChange={(v) => setPhysical({ L_p: v })}
              disabled={disabled}
            />
            <NumberField
              label="Ângulo do Louver (θ_L)"
              unit="°"
              value={physical.theta_L ?? 27}
              onChange={(v) => setPhysical({ theta_L: v })}
              disabled={disabled}
            />
          </div>
        )}
        {physical.finType === "wavy" && (
          <NumberField
            label="Amplitude da Ondulação (A_w)"
            unit="mm"
            value={physical.A_w ?? 1.5}
            onChange={(v) => setPhysical({ A_w: v })}
            disabled={disabled}
          />
        )}
      </div>

      {/* Campos complementares manuais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
