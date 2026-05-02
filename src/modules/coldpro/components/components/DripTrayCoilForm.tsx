import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type {
  DripTrayCoilInput,
  DripTrayCondition,
} from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

type TubeMaterial = "copper" | "aluminum" | "steel" | "stainless_steel";

const MATERIALS: TubeMaterial[] = [
  "copper",
  "aluminum",
  "steel",
  "stainless_steel",
];

const TRAY_CONDITIONS: { value: DripTrayCondition; label: string }[] = [
  { value: "water", label: "Água acumulada" },
  { value: "melting_ice", label: "Gelo derretendo" },
  { value: "dry_air", label: "Ar seco" },
];

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function DripTrayCoilForm({ onSaved }: Props) {
  const addDripTrayCoil = useComponentStore((s) => s.addDripTrayCoil);
  const [name, setName] = useState("");
  const [refrigerant, setRefrigerant] = useState("R404A");
  const [tubeOdM, setTubeOdM] = useState(0.012);
  const [tubeThicknessM, setTubeThicknessM] = useState(0.001);
  const [tubeMat, setTubeMat] = useState<TubeMaterial>("copper");
  const [trayLengthM, setTrayLengthM] = useState(0.8);
  const [bends, setBends] = useState(4);
  const [pitchM, setPitchM] = useState(0.05);
  const [liquidFlow, setLiquidFlow] = useState(0.05);
  const [tLiquidIn, setTLiquidIn] = useState(35);
  const [trayCondition, setTrayCondition] =
    useState<DripTrayCondition>("water");
  const [tTray, setTTray] = useState(2);

  const canSave =
    name.trim().length > 0 &&
    tubeOdM > 0 &&
    tubeThicknessM > 0 &&
    trayLengthM > 0 &&
    bends > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: DripTrayCoilInput = {
      refrigerant,
      tube_outer_diameter_m: tubeOdM,
      tube_thickness_m: tubeThicknessM,
      tube_material: tubeMat,
      tray_length_m: trayLengthM,
      number_of_bends: bends,
      pitch_m: pitchM,
      liquid_mass_flow_kgs: liquidFlow,
      T_liquid_in_c: tLiquidIn,
      tray_condition: trayCondition,
      T_tray_c: tTray,
    };
    addDripTrayCoil(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome / código"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: Bandeja Cu 12mm"
        required
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TechnicalField
          label="Diâm. externo do tubo"
          value={tubeOdM}
          onChange={(v) => setTubeOdM(num(v))}
          type="number"
          unit="m"
          help={{
            description: "Diâmetro externo do tubo da serpentina de bandeja.",
            unit: "m",
            typicalRange: "0.006 – 0.025 m",
            example: "0.012",
            impact: "Determina a área externa de troca.",
          }}
        />
        <TechnicalField
          label="Espessura do tubo"
          value={tubeThicknessM}
          onChange={(v) => setTubeThicknessM(num(v))}
          type="number"
          unit="m"
        />
        <TechnicalField
          label="Comprimento da bandeja"
          value={trayLengthM}
          onChange={(v) => setTrayLengthM(num(v))}
          type="number"
          unit="m"
        />
        <TechnicalField
          label="Nº de curvas"
          value={bends}
          onChange={(v) => setBends(num(v))}
          type="number"
        />
        <TechnicalField
          label="Passo entre passes"
          value={pitchM}
          onChange={(v) => setPitchM(num(v))}
          type="number"
          unit="m"
        />
        <TechnicalField
          label="Vazão de líquido"
          value={liquidFlow}
          onChange={(v) => setLiquidFlow(num(v))}
          type="number"
          unit="kg/s"
        />
        <TechnicalField
          label="T líquido entrada"
          value={tLiquidIn}
          onChange={(v) => setTLiquidIn(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="T da bandeja"
          value={tTray}
          onChange={(v) => setTTray(num(v))}
          type="number"
          unit="°C"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Material do tubo
          </label>
          <select
            value={tubeMat}
            onChange={(e) => setTubeMat(e.target.value as TubeMaterial)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {MATERIALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Condição da bandeja
          </label>
          <select
            value={trayCondition}
            onChange={(e) =>
              setTrayCondition(e.target.value as DripTrayCondition)
            }
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {TRAY_CONDITIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
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

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Serpentina de Bandeja
      </button>
    </div>
  );
}
