import type { OperatingPoint } from "@/modules/coldpro_v2";

export interface GridConfig {
  evap_temps: number[];
  cond_temps: number[];
}

interface OperatingGridFormProps {
  value: GridConfig;
  onChange: (value: GridConfig) => void;
}

export function generateGrid(config: GridConfig): OperatingPoint[] {
  const points: OperatingPoint[] = [];
  for (const evap of config.evap_temps) {
    for (const cond of config.cond_temps) {
      points.push({ evap_temp_c: evap, cond_temp_c: cond });
    }
  }
  return points;
}

function parseList(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
}

export function OperatingGridForm({ value, onChange }: OperatingGridFormProps) {
  const grid = generateGrid(value);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Grade de Pontos Operacionais</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Temperaturas de evaporação <span className="text-xs text-slate-400">(°C, separadas por vírgula)</span>
          </label>
          <input
            type="text"
            defaultValue={value.evap_temps.join(", ")}
            onBlur={(e) => onChange({ ...value, evap_temps: parseList(e.target.value) })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1E6FD9] focus:ring-2 focus:ring-blue-200"
            placeholder="-15, -10, -5, 0"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Temperaturas de condensação <span className="text-xs text-slate-400">(°C, separadas por vírgula)</span>
          </label>
          <input
            type="text"
            defaultValue={value.cond_temps.join(", ")}
            onBlur={(e) => onChange({ ...value, cond_temps: parseList(e.target.value) })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1E6FD9] focus:ring-2 focus:ring-blue-200"
            placeholder="30, 35, 40, 45"
          />
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          Grade gerada: <span className="font-semibold text-slate-900">{grid.length}</span> pontos (
          {value.evap_temps.length} T_evap × {value.cond_temps.length} T_cond)
        </div>
      </div>
    </section>
  );
}
