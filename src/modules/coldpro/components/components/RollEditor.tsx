import { Plus, Trash2 } from "lucide-react";
import type { RollGeometry } from "@/modules/coldpro_v2";

interface RollEditorProps {
  rolls: RollGeometry[];
  onChange: (rolls: RollGeometry[]) => void;
}

export function RollEditor({ rolls, onChange }: RollEditorProps) {
  const addRoll = () =>
    onChange([...rolls, { fin_spacing_mm: 6, rows_in_roll: 2 }]);
  const removeRoll = (i: number) =>
    onChange(rolls.filter((_, idx) => idx !== i));
  const updateRoll = (
    i: number,
    field: keyof RollGeometry,
    value: number,
  ) => {
    onChange(rolls.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Rolls (grupos de fileiras) — ordem: maior espaçamento → menor
        </p>
        <button
          type="button"
          onClick={addRoll}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-[#1E6FD9] hover:text-[#1E6FD9]"
        >
          <Plus className="h-3 w-3" />
          Adicionar roll
        </button>
      </div>

      <div className="space-y-2">
        {rolls.map((roll, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <span className="w-12 text-xs font-semibold text-slate-500">
              Roll {i + 1}
            </span>
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
                  Passo aleta (mm)
                </label>
                <input
                  type="number"
                  value={roll.fin_spacing_mm}
                  onChange={(e) =>
                    updateRoll(
                      i,
                      "fin_spacing_mm",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  step="0.5"
                  min="1"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
                  Fileiras no roll
                </label>
                <input
                  type="number"
                  value={roll.rows_in_roll}
                  onChange={(e) =>
                    updateRoll(
                      i,
                      "rows_in_roll",
                      parseInt(e.target.value, 10) || 0,
                    )
                  }
                  step="1"
                  min="1"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]/30"
                />
              </div>
            </div>
            {rolls.length > 1 && (
              <button
                type="button"
                onClick={() => removeRoll(i)}
                className="text-slate-300 transition-colors hover:text-red-500"
                aria-label="Remover roll"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        Rolls com maior passo de aleta ficam na entrada do ar (mais sujos). O
        motor calcula cada roll separadamente.
      </p>
    </div>
  );
}
