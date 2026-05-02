import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  CoilGeometryCatalogItem,
  FinPitchItem,
  FinThicknessItem,
  TubeMaterialItem,
} from "../types/unilab.types";
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

  const handleGeometryChange = (id: string | undefined) => {
    const geo = geometries.find((g) => g.id === id);
    setSelectedGeometry(geo);
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <SelectField
        label={f.geometry}
        value={physical.geometryId}
        options={geometries.map((g) => ({ value: g.id, label: g.name }))}
        onChange={handleGeometryChange}
        disabled={disabled}
      />

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
        <NumberField
          label={f.tubePitchTransverse}
          unit="mm"
          value={physical.tubePitchTransverseMm}
          onChange={(v) => setPhysical({ tubePitchTransverseMm: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.tubePitchLongitudinal}
          unit="mm"
          value={physical.tubePitchLongitudinalMm}
          onChange={(v) => setPhysical({ tubePitchLongitudinalMm: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.tubeOuterDiameter}
          unit="mm"
          value={physical.tubeOuterDiameterMm}
          onChange={(v) => setPhysical({ tubeOuterDiameterMm: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.tubeInnerDiameter}
          unit="mm"
          value={physical.tubeInnerDiameterMm}
          onChange={(v) => setPhysical({ tubeInnerDiameterMm: v })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
