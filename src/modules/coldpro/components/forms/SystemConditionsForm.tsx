import { TechnicalField } from "../ui/TechnicalField";
import { validateRequired } from "../../utils/validation";

export interface SystemConditions {
  ambient_temp_c: number;
  required_airflow_m3_h: number;
}

interface SystemConditionsFormProps {
  value: Partial<SystemConditions>;
  onChange: (value: Partial<SystemConditions>) => void;
}

export function SystemConditionsForm({ value, onChange }: SystemConditionsFormProps) {
  const set = (field: keyof SystemConditions, raw: string) => {
    const n = parseFloat(raw);
    onChange({ ...value, [field]: isNaN(n) ? undefined : n });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Condições do Sistema</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TechnicalField
          label="T ambiente"
          value={value.ambient_temp_c}
          onChange={(v) => set("ambient_temp_c", v)}
          type="number"
          unit="°C"
          required
          validation={validateRequired(value.ambient_temp_c)}
          help={{
            description: "Temperatura do ar ambiente onde o sistema opera.",
            unit: "Graus Celsius [°C]",
            typicalRange: "15°C a 45°C",
            example: "25",
            impact: "Afeta a temperatura de condensação e a eficiência.",
          }}
        />
        <TechnicalField
          label="Vazão de ar requerida"
          value={value.required_airflow_m3_h}
          onChange={(v) => set("required_airflow_m3_h", v)}
          type="number"
          unit="m³/h"
          required
          validation={validateRequired(value.required_airflow_m3_h)}
          help={{
            description: "Vazão de ar necessária no evaporador.",
            unit: "Metros cúbicos por hora [m³/h]",
            typicalRange: "500 m³/h a 20.000 m³/h",
            example: "3000",
            impact: "Usada para verificar utilização do ventilador e transferência de calor.",
          }}
        />
      </div>
    </section>
  );
}
