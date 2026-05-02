import type { EquipmentAssembly } from "../../stores/useComponentStore";
import { useComponentStore } from "../../stores/useComponentStore";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface AssemblyPreviewProps {
  assembly: EquipmentAssembly;
}

interface Row {
  label: string;
  value: string | undefined;
  required?: boolean;
}

export function AssemblyPreview({ assembly }: AssemblyPreviewProps) {
  const store = useComponentStore();

  const nameOf = (
    list: { id: string; name: string }[],
    id: string | undefined,
  ): string | undefined => list.find((c) => c.id === id)?.name;

  const rows: Row[] = [
    {
      label: "Compressor",
      value: nameOf(store.compressors, assembly.compressorId),
      required: true,
    },
    {
      label: "Serpentina evaporadora",
      value: nameOf(store.coils, assembly.evaporatorCoilId),
      required: true,
    },
    {
      label: "Condensador",
      value: nameOf(store.condensers, assembly.condenserId),
      required: true,
    },
    {
      label: "Ventilador do evaporador",
      value: nameOf(store.fans, assembly.evaporatorFanId),
    },
    {
      label: "Ventilador do condensador",
      value: nameOf(store.fans, assembly.condenserFanId),
    },
    {
      label: "Válvula de expansão",
      value: nameOf(store.expansionValves, assembly.expansionValveId),
    },
    {
      label: "Válvula 4 vias",
      value: nameOf(store.fourWayValves, assembly.fourWayValveId),
    },
    {
      label: "Serpentina de bandeja",
      value: nameOf(store.dripTrayCoils, assembly.dripTrayCoilId),
    },
    {
      label: "Configuração de degelo",
      value: nameOf(store.defrostConfigs, assembly.defrostConfigId),
    },
    {
      label: "Configuração AGRO",
      value: nameOf(store.agroConfigs, assembly.agroConfigId),
    },
    {
      label: "Bateria de reaquecimento",
      value: nameOf(store.reheatCoils, assembly.reheatCoilId),
    },
    {
      label: "Configuração de gelo",
      value: nameOf(store.frostConfigs, assembly.frostConfigId),
    },
  ];

  const valid = rows.every((r) => !r.required || !!r.value);
  const built = store.buildSystemInput(assembly.id);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {assembly.name}
          </h3>
          {assembly.description && (
            <p className="mt-0.5 text-xs text-slate-500">{assembly.description}</p>
          )}
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            valid && built
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {valid && built ? (
            <>
              <CheckCircle2 className="h-3 w-3" /> Pronto
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" /> Incompleto
            </>
          )}
        </span>
      </header>

      <ul className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-3 border-b border-slate-50 py-1 last:border-b-0"
          >
            <span className="text-slate-500">
              {r.label}
              {r.required && <span className="ml-0.5 text-red-500">*</span>}
            </span>
            <span
              className={`truncate text-right font-medium ${
                r.value
                  ? "text-slate-800"
                  : r.required
                    ? "text-red-500"
                    : "text-slate-300"
              }`}
            >
              {r.value ?? "—"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <div>
          <p className="uppercase tracking-wider">T ambiente</p>
          <p className="font-mono text-slate-800">
            {assembly.systemConditions.ambient_temp_c.toFixed(1)} °C
          </p>
        </div>
        <div>
          <p className="uppercase tracking-wider">Vazão requerida</p>
          <p className="font-mono text-slate-800">
            {assembly.systemConditions.required_airflow_m3_h} m³/h
          </p>
        </div>
      </div>
    </div>
  );
}
