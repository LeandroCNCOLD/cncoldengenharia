import type { CatalogFilter } from "../data/equipmentCatalog.types";

interface Props {
  filter: CatalogFilter;
  onChange: (filter: CatalogFilter) => void;
  total: number;
  filteredTotal: number;
}

export function CatalogFilters({ filter, onChange, total, filteredTotal }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          placeholder="Buscar modelo, compressor, fabricante…"
          value={filter.search ?? ""}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30"
        />

        <select
          value={filter.application ?? "all"}
          onChange={(e) => onChange({ ...filter, application: e.target.value as CatalogFilter["application"] })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Aplicação (todas)</option>
          <option value="LT">LT — Congelados</option>
          <option value="MT">MT — Resfriados</option>
          <option value="HT">HT — Climatizados</option>
        </select>

        <select
          value={filter.refrigerant ?? "all"}
          onChange={(e) => onChange({ ...filter, refrigerant: e.target.value as CatalogFilter["refrigerant"] })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Fluido (todos)</option>
          <option value="R404A">R404A</option>
          <option value="R507A">R507A</option>
          <option value="R134a">R134a</option>
          <option value="R448A">R448A</option>
          <option value="R449A">R449A</option>
          <option value="R452A">R452A</option>
          <option value="R290">R290</option>
          <option value="R22">R22</option>
        </select>

        <select
          value={String(filter.voltage ?? "all")}
          onChange={(e) =>
            onChange({
              ...filter,
              voltage: e.target.value === "all" ? "all" : Number(e.target.value),
            })
          }
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Tensão (todas)</option>
          <option value="220">220 V</option>
          <option value="380">380 V</option>
          <option value="440">440 V</option>
        </select>

        <select
          value={String(filter.phases ?? "all")}
          onChange={(e) =>
            onChange({
              ...filter,
              phases: e.target.value === "all" ? "all" : Number(e.target.value),
            })
          }
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Fases (todas)</option>
          <option value="1">1F</option>
          <option value="3">3F</option>
        </select>
      </div>

      <p className="text-xs text-gray-600">
        Exibindo <span className="font-semibold">{filteredTotal}</span> de{" "}
        <span className="font-semibold">{total}</span> equipamentos
      </p>
    </div>
  );
}
