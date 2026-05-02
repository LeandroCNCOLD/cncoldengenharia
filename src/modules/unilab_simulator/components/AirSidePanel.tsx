import { useEffect, useState } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import {
  validateAirSideInputs,
  type PsychrometricValidationResult,
} from "../services/psychrometrics";

interface FanCatalogItem {
  id: string;
  manufacturer?: string;
  model?: string;
  airflow_m3h?: number;
}

const FANS_CATALOG_URL = "/data/catalogs/fans_clean.json";

export function AirSidePanel() {
  const airFlow_m3h = useUnilabSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useUnilabSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useUnilabSimulationStore((s) => s.rhIn_pct);
  const foulingFactorAir = useUnilabSimulationStore((s) => s.foulingFactorAir);
  const selectedFanId = useUnilabSimulationStore((s) => s.selectedFanId);
  const setAirFlow = useUnilabSimulationStore((s) => s.setAirFlow);
  const setTempInDB = useUnilabSimulationStore((s) => s.setTempInDB);
  const setRhIn = useUnilabSimulationStore((s) => s.setRhIn);
  const setFoulingFactorAir = useUnilabSimulationStore((s) => s.setFoulingFactorAir);
  const setSelectedFan = useUnilabSimulationStore((s) => s.setSelectedFan);

  const [fans, setFans] = useState<FanCatalogItem[]>([]);

  // Carregamento opcional do catálogo de ventiladores. Se o arquivo não
  // existir, simplesmente escondemos o dropdown — sem mocks.
  useEffect(() => {
    let cancelled = false;
    fetch(FANS_CATALOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list: FanCatalogItem[] = Array.isArray(data) ? data : [];
        setFans(list.filter((f) => typeof f?.airflow_m3h === "number" && f.airflow_m3h! > 0));
      })
      .catch(() => {
        // arquivo ausente ou inválido — ignorar silenciosamente
        if (!cancelled) setFans([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const validation: PsychrometricValidationResult = validateAirSideInputs({
    tempInDB_C,
    rhIn_pct,
    foulingFactorAir,
  });

  const handleFanChange = (id: string) => {
    setSelectedFan(id || undefined);
    const fan = fans.find((f) => f.id === id);
    if (fan?.airflow_m3h && fan.airflow_m3h > 0) {
      setAirFlow(fan.airflow_m3h);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">
          Lado Ar / Ventilação
        </h4>

        <div className="space-y-3">
          {fans.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Ventilador (opcional)
              </label>
              <select
                value={selectedFanId ?? ""}
                onChange={(e) => handleFanChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
              >
                <option value="">Selecione um ventilador…</option>
                {fans.map((f) => (
                  <option key={f.id} value={f.id}>
                    {[f.manufacturer, f.model].filter(Boolean).join(" ") || f.id}
                    {" — "}
                    {f.airflow_m3h} m³/h
                  </option>
                ))}
              </select>
            </div>
          )}

          <NumberInput
            label="Vazão de Ar (m³/h)"
            value={airFlow_m3h}
            onChange={setAirFlow}
            min={0}
          />
          <NumberInput
            label="Temperatura de Entrada DB (°C)"
            value={tempInDB_C}
            onChange={setTempInDB}
          />
          <NumberInput
            label="Umidade Relativa de Entrada (%)"
            value={rhIn_pct}
            onChange={setRhIn}
          />
          <NumberInput
            label="Fator de Erro (Fouling) (m²·K/W)"
            value={foulingFactorAir}
            onChange={setFoulingFactorAir}
            min={0}
            step={0.0001}
          />

          {!validation.valid && (
            <ul className="mt-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              {validation.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">
          Resultados do Lado Ar
        </h4>
        <div className="space-y-2">
          <ReadOnlyOutput label="Capacidade (W)" tone="gray" />
          <ReadOnlyOutput label="Velocidade Frontal (m/s)" tone="gray" />
          <ReadOnlyOutput label="Temperatura de Saída DB (°C)" tone="green" />
          <ReadOnlyOutput label="Umidade Relativa de Saída (%)" tone="green" />
          <ReadOnlyOutput label="Queda de Pressão (Pa)" tone="gray" />
        </div>
        <p className="mt-3 text-[11px] italic text-slate-500">
          Resultados calculados na Etapa 5 (motor de simulação).
        </p>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step ?? "any"}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
      />
    </div>
  );
}

function ReadOnlyOutput({
  label,
  tone,
}: {
  label: string;
  tone: "gray" | "green";
}) {
  const bg = tone === "green" ? "bg-emerald-50" : "bg-slate-100";
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <input
        type="text"
        value="---"
        readOnly
        disabled
        className={`w-full cursor-not-allowed rounded-md border border-slate-200 ${bg} px-2.5 py-1.5 text-sm text-slate-500`}
      />
    </div>
  );
}
