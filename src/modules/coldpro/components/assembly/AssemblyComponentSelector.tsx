import { useMemo } from "react";

interface SelectOption {
  id: string;
  name: string;
}

interface AssemblyComponentSelectorProps {
  label: string;
  required?: boolean;
  options: SelectOption[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  emptyHint?: string;
}

export function AssemblyComponentSelector({
  label,
  required,
  options,
  value,
  onChange,
  emptyHint,
}: AssemblyComponentSelectorProps) {
  const sorted = useMemo(
    () => [...options].sort((a, b) => a.name.localeCompare(b.name)),
    [options],
  );

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="">— Nenhum —</option>
        {sorted.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {sorted.length === 0 && emptyHint && (
        <p className="mt-1 text-[11px] text-amber-600">{emptyHint}</p>
      )}
    </div>
  );
}
