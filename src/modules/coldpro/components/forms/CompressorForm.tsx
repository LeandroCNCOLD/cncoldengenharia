import { TechnicalField } from "../ui/TechnicalField";
import {
  validateCapacityW,
  validateEvapTemp,
  validateCondTemp,
  validateRequired,
} from "../../utils/validation";
import type { CompressorSpec } from "@/modules/coldpro_v2";

interface CompressorFormProps {
  value: Partial<CompressorSpec>;
  onChange: (value: Partial<CompressorSpec>) => void;
}

export function CompressorForm({ value, onChange }: CompressorFormProps) {
  const setNum = (field: keyof CompressorSpec, raw: string) => {
    const n = parseFloat(raw);
    onChange({ ...value, [field]: isNaN(n) ? undefined : n });
  };
  const setStr = (field: keyof CompressorSpec, raw: string) => {
    onChange({ ...value, [field]: raw });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Compressor</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TechnicalField
          label="Capacidade nominal"
          value={value.cooling_capacity_w}
          onChange={(v) => setNum("cooling_capacity_w", v)}
          type="number"
          unit="W"
          required
          validation={validateCapacityW(value.cooling_capacity_w)}
          help={{
            description: "Capacidade frigorífica nominal do compressor.",
            unit: "Watts [W]",
            typicalRange: "1.000 W a 100.000 W",
            example: "5000",
            impact: "Define o limite superior de capacidade do sistema.",
          }}
        />
        <TechnicalField
          label="Potência elétrica"
          value={value.power_w}
          onChange={(v) => setNum("power_w", v)}
          type="number"
          unit="W"
          required
          validation={validateCapacityW(value.power_w)}
          help={{
            description: "Potência elétrica consumida pelo compressor.",
            unit: "Watts [W]",
            typicalRange: "500 W a 30.000 W",
            example: "2000",
            impact: "Usado para calcular o COP: COP = capacidade / potência.",
          }}
        />
        <TechnicalField
          label="T evap nominal"
          value={value.evap_temp_c}
          onChange={(v) => setNum("evap_temp_c", v)}
          type="number"
          unit="°C"
          required
          validation={validateEvapTemp(value.evap_temp_c)}
          help={{
            description: "Temperatura de evaporação nas condições nominais.",
            unit: "Graus Celsius [°C]",
            typicalRange: "-30°C a +10°C",
            example: "-10",
            impact: "Ponto de referência para interpolação da capacidade.",
          }}
        />
        <TechnicalField
          label="T cond nominal"
          value={value.cond_temp_c}
          onChange={(v) => setNum("cond_temp_c", v)}
          type="number"
          unit="°C"
          required
          validation={validateCondTemp(value.cond_temp_c)}
          help={{
            description: "Temperatura de condensação nas condições nominais.",
            unit: "Graus Celsius [°C]",
            typicalRange: "30°C a 55°C",
            example: "40",
            impact: "Ponto de referência para interpolação da capacidade.",
          }}
        />
        <div className="md:col-span-2">
          <TechnicalField
            label="Refrigerante"
            value={value.refrigerant}
            onChange={(v) => setStr("refrigerant", v)}
            type="text"
            required
            placeholder="Ex: R404A, R134a, R290"
            validation={validateRequired(value.refrigerant)}
            help={{
              description: "Identificador do fluido refrigerante.",
              unit: "Texto (código ASHRAE)",
              typicalRange: "R404A, R134a, R290, R448A, R449A",
              example: "R404A",
              impact: "Deve ser consistente com as propriedades termodinâmicas.",
            }}
          />
        </div>
      </div>
    </section>
  );
}
