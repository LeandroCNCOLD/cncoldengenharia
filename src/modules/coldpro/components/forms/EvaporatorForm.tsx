// Form completo do Evaporador (geometria + condições do ar) usado na tela
// de Equilíbrio do Sistema. Permite pré-preenchimento via catálogo CN COLD
// e edição manual. Mantém também o helper buildMinimalEvaporatorInput usado
// como fallback quando nenhum dado vem do catálogo.
import { TechnicalField } from "../ui/TechnicalField";
import type { ProgressiveCoilInput, CompressorSpec } from "@/modules/coldpro_v2";
import type { SystemConditions } from "./SystemConditionsForm";

export type EvaporatorFormValue = Partial<
  Omit<ProgressiveCoilInput, "rolls" | "tube_material" | "fin_material">
> & {
  tube_material?: ProgressiveCoilInput["tube_material"];
  fin_material?: ProgressiveCoilInput["fin_material"];
  /** Espaçamento de aletas representativo (mm). Para simulação detalhada
   *  com múltiplos rolos, use o modo Profissional. */
  fin_spacing_mm?: number;
  /** Número total de fileiras de tubos. */
  rows_total?: number;
  /** Vazão volumétrica de ar (m³/h) — convertida internamente para kg/s. */
  airflow_m3_h?: number;
};

interface EvaporatorFormProps {
  value: EvaporatorFormValue;
  onChange: (value: EvaporatorFormValue) => void;
}

const AIR_DENSITY_KG_M3 = 1.2;

export function EvaporatorForm({ value, onChange }: EvaporatorFormProps) {
  const setNum = (field: keyof EvaporatorFormValue, raw: string) => {
    const n = parseFloat(raw);
    onChange({ ...value, [field]: isNaN(n) ? undefined : n });
  };
  const setStr = <K extends keyof EvaporatorFormValue>(
    field: K,
    v: EvaporatorFormValue[K],
  ) => {
    onChange({ ...value, [field]: v });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Evaporador</h3>

      {/* Bloco: condições do ar */}
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Condições do ar
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TechnicalField
          label="T evaporação"
          value={value.T_evaporating_c}
          onChange={(v) => setNum("T_evaporating_c", v)}
          type="number"
          unit="°C"
          required
          help={{
            description: "Temperatura de evaporação do refrigerante na serpentina.",
            unit: "Graus Celsius [°C]",
            typicalRange: "−40°C a 15°C",
            example: "-10",
            impact: "Define o ΔT com o ar de entrada e impacta diretamente a capacidade.",
          }}
        />
        <TechnicalField
          label="Vazão de ar"
          value={value.airflow_m3_h}
          onChange={(v) => setNum("airflow_m3_h", v)}
          type="number"
          unit="m³/h"
          help={{
            description: "Vazão volumétrica de ar passando pelo evaporador.",
            unit: "Metros cúbicos por hora [m³/h]",
            typicalRange: "500 a 30.000 m³/h",
            example: "3000",
            impact: "Convertida para fluxo mássico considerando ρ ≈ 1,2 kg/m³.",
          }}
        />
        <TechnicalField
          label="T ar entrada"
          value={value.air_temperature_in_c}
          onChange={(v) => setNum("air_temperature_in_c", v)}
          type="number"
          unit="°C"
          help={{
            description: "Temperatura do ar entrando no evaporador.",
            unit: "Graus Celsius [°C]",
            typicalRange: "−25°C a 35°C",
            example: "0",
            impact: "Define a entalpia inicial do ar e o ΔT disponível.",
          }}
        />
        <TechnicalField
          label="UR ar entrada"
          value={value.air_relative_humidity_in}
          onChange={(v) => setNum("air_relative_humidity_in", v)}
          type="number"
          unit="—"
          help={{
            description: "Umidade relativa do ar de entrada (0 a 1).",
            unit: "Fração decimal",
            typicalRange: "0,50 a 0,95",
            example: "0.85",
            impact: "Controla a taxa de desumidificação e a carga latente.",
          }}
        />
      </div>

      {/* Bloco: geometria da serpentina */}
      <div className="mt-5 mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Geometria da serpentina
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TechnicalField
          label="Ø tubo externo"
          value={value.tube_outer_diameter_mm}
          onChange={(v) => setNum("tube_outer_diameter_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Diâmetro externo dos tubos da serpentina.",
            unit: "Milímetros [mm]",
            typicalRange: "7 a 16 mm",
            example: "9.525",
          }}
        />
        <TechnicalField
          label="Ø tubo interno"
          value={value.tube_inner_diameter_mm}
          onChange={(v) => setNum("tube_inner_diameter_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Diâmetro interno dos tubos.",
            unit: "Milímetros [mm]",
            typicalRange: "6 a 15 mm",
            example: "8.925",
          }}
        />
        <TechnicalField
          label="Passo transversal"
          value={value.tube_pitch_transverse_mm}
          onChange={(v) => setNum("tube_pitch_transverse_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Distância entre tubos na direção transversal ao escoamento.",
            unit: "Milímetros [mm]",
            typicalRange: "20 a 35 mm",
            example: "27",
          }}
        />
        <TechnicalField
          label="Passo longitudinal"
          value={value.tube_pitch_longitudinal_mm}
          onChange={(v) => setNum("tube_pitch_longitudinal_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Distância entre tubos na direção do escoamento.",
            unit: "Milímetros [mm]",
            typicalRange: "20 a 35 mm",
            example: "31.5",
          }}
        />
        <TechnicalField
          label="Espaçamento de aletas"
          value={value.fin_spacing_mm}
          onChange={(v) => setNum("fin_spacing_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Distância entre aletas adjacentes (passo de aleta).",
            unit: "Milímetros [mm]",
            typicalRange: "3 a 10 mm",
            example: "5",
          }}
        />
        <TechnicalField
          label="Número de fileiras"
          value={value.rows_total}
          onChange={(v) => setNum("rows_total", v)}
          type="number"
          unit="—"
          help={{
            description: "Número total de fileiras de tubos no sentido do escoamento.",
            unit: "Adimensional",
            typicalRange: "2 a 8",
            example: "3",
          }}
        />
        <TechnicalField
          label="Espessura da aleta"
          value={value.fin_thickness_mm}
          onChange={(v) => setNum("fin_thickness_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Espessura da chapa da aleta.",
            unit: "Milímetros [mm]",
            typicalRange: "0,10 a 0,20 mm",
            example: "0.12",
          }}
        />
        <TechnicalField
          label="Altura da aleta"
          value={value.fin_height_mm}
          onChange={(v) => setNum("fin_height_mm", v)}
          type="number"
          unit="mm"
          help={{
            description: "Altura útil da aleta.",
            unit: "Milímetros [mm]",
            typicalRange: "200 a 600 mm",
            example: "300",
          }}
        />
        <TechnicalField
          label="Largura da serpentina"
          value={value.coil_width_m}
          onChange={(v) => setNum("coil_width_m", v)}
          type="number"
          unit="m"
          help={{
            description: "Largura física da serpentina (dimensão transversal ao escoamento).",
            unit: "Metros [m]",
            typicalRange: "0,3 a 2,0 m",
            example: "0.6",
          }}
        />
        <TechnicalField
          label="Altura da serpentina"
          value={value.coil_height_m}
          onChange={(v) => setNum("coil_height_m", v)}
          type="number"
          unit="m"
          help={{
            description: "Altura física da serpentina.",
            unit: "Metros [m]",
            typicalRange: "0,2 a 1,5 m",
            example: "0.3",
          }}
        />

        {/* Materiais */}
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-700">Material do tubo</label>
          <select
            value={value.tube_material ?? ""}
            onChange={(e) =>
              setStr(
                "tube_material",
                (e.target.value || undefined) as EvaporatorFormValue["tube_material"],
              )
            }
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
          >
            <option value="">—</option>
            <option value="copper">Cobre</option>
            <option value="aluminum">Alumínio</option>
            <option value="steel">Aço</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-700">Material da aleta</label>
          <select
            value={value.fin_material ?? ""}
            onChange={(e) =>
              setStr(
                "fin_material",
                (e.target.value || undefined) as EvaporatorFormValue["fin_material"],
              )
            }
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
          >
            <option value="">—</option>
            <option value="copper">Cobre</option>
            <option value="aluminum">Alumínio</option>
            <option value="steel">Aço</option>
          </select>
        </div>
      </div>
    </section>
  );
}

/** Constrói um ProgressiveCoilInput a partir do form do evaporador, recorrendo
 *  a defaults e às condições do sistema/compressor para campos não preenchidos. */
export function buildEvaporatorInputFromForm(
  ev: EvaporatorFormValue,
  compressor: Partial<CompressorSpec>,
  conditions: Partial<SystemConditions>,
): ProgressiveCoilInput {
  const airflowM3H =
    ev.airflow_m3_h ?? conditions.required_airflow_m3_h ?? 0;
  const finSpacing = ev.fin_spacing_mm ?? 7;
  const rowsTotal = ev.rows_total ?? 2;
  return {
    tube_outer_diameter_mm: ev.tube_outer_diameter_mm ?? 12,
    tube_inner_diameter_mm: ev.tube_inner_diameter_mm ?? 10,
    tube_pitch_transverse_mm: ev.tube_pitch_transverse_mm ?? 30,
    tube_pitch_longitudinal_mm: ev.tube_pitch_longitudinal_mm ?? 26,
    fin_height_mm: ev.fin_height_mm ?? 300,
    fin_thickness_mm: ev.fin_thickness_mm ?? 0.12,
    coil_width_m: ev.coil_width_m ?? 0.6,
    coil_height_m: ev.coil_height_m ?? 0.3,
    tube_material: ev.tube_material ?? "copper",
    fin_material: ev.fin_material ?? "aluminum",
    rolls: [{ fin_spacing_mm: finSpacing, rows_in_roll: rowsTotal }],
    air_temperature_in_c:
      ev.air_temperature_in_c ?? conditions.ambient_temp_c ?? 25,
    air_relative_humidity_in: ev.air_relative_humidity_in ?? 0.8,
    air_mass_flow_kg_s: (airflowM3H * AIR_DENSITY_KG_M3) / 3600,
    T_evaporating_c: ev.T_evaporating_c ?? compressor.evap_temp_c ?? -10,
    refrigerant: compressor.refrigerant,
  };
}

/** @deprecated Use buildEvaporatorInputFromForm com EvaporatorFormValue.
 *  Mantido para compatibilidade com SimulationPage até a migração estar completa. */
export function buildMinimalEvaporatorInput(
  compressor: Partial<CompressorSpec>,
  conditions: Partial<SystemConditions>,
): ProgressiveCoilInput {
  return buildEvaporatorInputFromForm({}, compressor, conditions);
}
