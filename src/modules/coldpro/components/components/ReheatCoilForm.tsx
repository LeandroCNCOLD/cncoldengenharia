import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { ReheatCoilSizingInput } from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

type TubeMaterial = "copper" | "aluminum" | "steel" | "stainless_steel";
type FinMaterial = "aluminum" | "copper";

const TUBE_MATERIALS: TubeMaterial[] = [
  "copper",
  "aluminum",
  "steel",
  "stainless_steel",
];
const FIN_MATERIALS: FinMaterial[] = ["aluminum", "copper"];

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ReheatCoilForm({ onSaved }: Props) {
  const addReheatCoil = useComponentStore((s) => s.addReheatCoil);
  const [name, setName] = useState("");
  const [qTarget, setQTarget] = useState(2000);
  const [tAirIn, setTAirIn] = useState(8);
  const [tAirOut, setTAirOut] = useState(14);
  const [airMass, setAirMass] = useState(1.5);
  const [tCond, setTCond] = useState(35);
  const [tHotGas, setTHotGas] = useState(75);
  const [refrigerant, setRefrigerant] = useState("R404A");
  const [tubeOdM, setTubeOdM] = useState(0.012);
  const [tubeThicknessM, setTubeThicknessM] = useState(0.001);
  const [tubeMat, setTubeMat] = useState<TubeMaterial>("copper");
  const [finSpacingM, setFinSpacingM] = useState(0.003);
  const [finThicknessM, setFinThicknessM] = useState(0.0001);
  const [finMat, setFinMat] = useState<FinMaterial>("aluminum");
  const [pitchT, setPitchT] = useState(0.03);
  const [pitchL, setPitchL] = useState(0.026);
  const [coilLength, setCoilLength] = useState(0.8);
  const [circuits, setCircuits] = useState(4);

  const canSave =
    name.trim().length > 0 &&
    qTarget > 0 &&
    airMass > 0 &&
    tubeOdM > 0 &&
    finSpacingM > 0 &&
    coilLength > 0 &&
    circuits > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: ReheatCoilSizingInput = {
      Q_reheat_target_w: qTarget,
      T_air_in_c: tAirIn,
      T_air_out_c: tAirOut,
      air_mass_flow_kg_s: airMass,
      T_condensing_c: tCond,
      T_hot_gas_in_c: tHotGas,
      refrigerant,
      tube_outer_diameter_m: tubeOdM,
      tube_thickness_m: tubeThicknessM,
      tube_material: tubeMat,
      fin_spacing_m: finSpacingM,
      fin_thickness_m: finThicknessM,
      fin_material: finMat,
      tube_pitch_transversal_m: pitchT,
      tube_pitch_longitudinal_m: pitchL,
      coil_length_m: coilLength,
      circuits,
    };
    addReheatCoil(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: Reheat 2kW"
        required
      />

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Carga térmica e ar
        </h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TechnicalField
            label="Q reaquecimento alvo"
            value={qTarget}
            onChange={(v) => setQTarget(num(v))}
            type="number"
            unit="W"
          />
          <TechnicalField
            label="T ar entrada"
            value={tAirIn}
            onChange={(v) => setTAirIn(num(v))}
            type="number"
            unit="°C"
          />
          <TechnicalField
            label="T ar saída"
            value={tAirOut}
            onChange={(v) => setTAirOut(num(v))}
            type="number"
            unit="°C"
          />
          <TechnicalField
            label="Vazão mássica de ar"
            value={airMass}
            onChange={(v) => setAirMass(num(v))}
            type="number"
            unit="kg/s"
          />
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Refrigerante (gás quente)
        </h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <TechnicalField
            label="T condensação"
            value={tCond}
            onChange={(v) => setTCond(num(v))}
            type="number"
            unit="°C"
          />
          <TechnicalField
            label="T gás quente entrada"
            value={tHotGas}
            onChange={(v) => setTHotGas(num(v))}
            type="number"
            unit="°C"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Refrigerante
            </label>
            <input
              type="text"
              value={refrigerant}
              onChange={(e) => setRefrigerant(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Geometria (metros)
        </h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TechnicalField
            label="Diâm. externo tubo"
            value={tubeOdM}
            onChange={(v) => setTubeOdM(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Espessura tubo"
            value={tubeThicknessM}
            onChange={(v) => setTubeThicknessM(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Passo aleta"
            value={finSpacingM}
            onChange={(v) => setFinSpacingM(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Espessura aleta"
            value={finThicknessM}
            onChange={(v) => setFinThicknessM(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Passo transversal"
            value={pitchT}
            onChange={(v) => setPitchT(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Passo longitudinal"
            value={pitchL}
            onChange={(v) => setPitchL(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Comprimento da serpentina"
            value={coilLength}
            onChange={(v) => setCoilLength(num(v))}
            type="number"
            unit="m"
          />
          <TechnicalField
            label="Nº de circuitos"
            value={circuits}
            onChange={(v) => setCircuits(num(v))}
            type="number"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Material do tubo
            </label>
            <select
              value={tubeMat}
              onChange={(e) => setTubeMat(e.target.value as TubeMaterial)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {TUBE_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
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
              onChange={(e) => setFinMat(e.target.value as FinMaterial)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {FIN_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Bateria de Reaquecimento
      </button>
    </div>
  );
}
