import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { RollEditor } from "./RollEditor";
import { useComponentStore } from "../../stores/useComponentStore";
import { useTranslation } from "@/i18n/useTranslation";
import type {
  ProgressiveCoilInput,
  RollGeometry,
} from "@/modules/coldpro_v2";

interface CoilFormProps {
  onSaved: () => void;
}

type CoilRole = "evaporator" | "condenser_coil" | "reheat";
type CoilMaterial = "copper" | "aluminum" | "steel";

const MATERIALS: CoilMaterial[] = ["copper", "aluminum", "steel"];
const REFRIGERANTS = ["R404A", "R134a", "R410A", "R22", "R407C", "R448A"];

function materialLabel(material: CoilMaterial, t: (path: string) => string): string {
  return t(`components.materials.${material}`);
}

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function CoilForm({ onSaved }: CoilFormProps) {
  const { t } = useTranslation();
  const addCoil = useComponentStore((s) => s.addCoil);
  const [name, setName] = useState("");
  const [role, setRole] = useState<CoilRole>("evaporator");
  const [rolls, setRolls] = useState<RollGeometry[]>([
    { fin_spacing_mm: 12, rows_in_roll: 2 },
    { fin_spacing_mm: 6, rows_in_roll: 2 },
  ]);

  const [tubeOd, setTubeOd] = useState(12);
  const [tubeId, setTubeId] = useState(10);
  const [pitchT, setPitchT] = useState(30);
  const [pitchL, setPitchL] = useState(26);
  const [finHeight, setFinHeight] = useState(600);
  const [finThickness, setFinThickness] = useState(0.1);
  const [coilWidth, setCoilWidth] = useState(0.8);
  const [coilHeight, setCoilHeight] = useState(0.6);
  const [tubeMat, setTubeMat] = useState<CoilMaterial>("copper");
  const [finMat, setFinMat] = useState<CoilMaterial>("aluminum");
  const [airTempIn, setAirTempIn] = useState(5);
  const [airRh, setAirRh] = useState(0.85);
  const [airMass, setAirMass] = useState(1.5);
  const [tEvap, setTEvap] = useState(-8);
  const [refrigerant, setRefrigerant] = useState("R404A");

  const canSave =
    name.trim().length > 0 &&
    rolls.length > 0 &&
    coilWidth > 0 &&
    coilHeight > 0 &&
    tubeOd > tubeId;

  const handleSave = () => {
    if (!canSave) return;
    const spec: ProgressiveCoilInput = {
      tube_outer_diameter_mm: tubeOd,
      tube_inner_diameter_mm: tubeId,
      tube_pitch_transverse_mm: pitchT,
      tube_pitch_longitudinal_mm: pitchL,
      fin_height_mm: finHeight,
      fin_thickness_mm: finThickness,
      coil_width_m: coilWidth,
      coil_height_m: coilHeight,
      tube_material: tubeMat,
      fin_material: finMat,
      rolls,
      air_temperature_in_c: airTempIn,
      air_relative_humidity_in: airRh,
      air_mass_flow_kg_s: airMass,
      T_evaporating_c: tEvap,
      refrigerant,
    };
    addCoil(name.trim(), role, spec);
    onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalField
          label="Nome / código"
          value={name}
          onChange={(v) => setName(v)}
          type="text"
          placeholder={t("components.placeholders.coil")}
          required
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Função
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CoilRole)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="evaporator">Evaporador</option>
            <option value="condenser_coil">Condensador aletado</option>
            <option value="reheat">Bateria de reaquecimento</option>
          </select>
        </div>
      </div>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Geometria do tubo
        </h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TechnicalField
            label="Diâm. externo"
            value={tubeOd}
            onChange={(v) => setTubeOd(num(v))}
            type="number"
            unit="mm"
          />
          <TechnicalField
            label="Diâm. interno"
            value={tubeId}
            onChange={(v) => setTubeId(num(v))}
            type="number"
            unit="mm"
          />
          <TechnicalField
            label="Passo transversal"
            value={pitchT}
            onChange={(v) => setPitchT(num(v))}
            type="number"
            unit="mm"
          />
          <TechnicalField
            label="Passo longitudinal"
            value={pitchL}
            onChange={(v) => setPitchL(num(v))}
            type="number"
            unit="mm"
          />
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Geometria da aleta e da face
        </h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TechnicalField
            label="Altura da aleta"
            value={finHeight}
            onChange={(v) => setFinHeight(num(v))}
            type="number"
            unit="mm"
          />
          <TechnicalField
            label="Espessura aleta"
            value={finThickness}
            onChange={(v) => setFinThickness(num(v))}
            type="number"
            unit="mm"
          />
          <TechnicalField
            label="Largura da face"
            value={coilWidth}
            onChange={(v) => setCoilWidth(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Altura da face"
            value={coilHeight}
            onChange={(v) => setCoilHeight(num(v))}
            type="number"
            unit="m"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Material do tubo
            </label>
            <select
              value={tubeMat}
              onChange={(e) => setTubeMat(e.target.value as CoilMaterial)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {materialLabel(m, t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Material da aleta
            </label>
            <select
              value={finMat}
              onChange={(e) => setFinMat(e.target.value as CoilMaterial)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {materialLabel(m, t)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          {t("components.rollsConfig")}
        </h4>
        <RollEditor rolls={rolls} onChange={setRolls} />
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Condições do ar e refrigerante
        </h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TechnicalField
            label="T ar entrada"
            value={airTempIn}
            onChange={(v) => setAirTempIn(num(v))}
            type="number"
            unit="°C"
          />
          <TechnicalField
            label="UR ar entrada"
            value={airRh}
            onChange={(v) => setAirRh(num(v))}
            type="number"
            unit="0–1"
          />
          <TechnicalField
            label="Vazão mássica de ar"
            value={airMass}
            onChange={(v) => setAirMass(num(v))}
            type="number"
            unit="kg/s"
          />
          <TechnicalField
            label="T evaporação"
            value={tEvap}
            onChange={(v) => setTEvap(num(v))}
            type="number"
            unit="°C"
          />
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Refrigerante
          </label>
          <select
            value={refrigerant}
            onChange={(e) => setRefrigerant(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {REFRIGERANTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Serpentina
      </button>
    </div>
  );
}
